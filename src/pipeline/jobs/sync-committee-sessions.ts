import { sql, inArray } from 'drizzle-orm';
import { db } from '../../lib/db';
import { committees, committeeSessions } from '../../lib/db/schema';
import { fetchOData } from '../../lib/knesset/odata-client';
import { runSyncJob, type SyncCheckpoint } from '../utils';
import { SUPPORTED_COMMITTEE_KNESSETS } from '../../lib/committees/scope';

const BATCH_SIZE = 200;
/** Knesset OData v2 doesn't support `in (…)` — we use `or`-chained equality
 *  instead, so the chunk size has to stay modest to keep URLs sane. */
const COMMITTEE_IDS_PER_QUERY = 40;

interface KnsCommitteeSession {
  CommitteeSessionID: number;
  CommitteeID: number;
  Number: number | null;
  StartDate: string;
  FinishDate: string | null;
  Note: string | null;
  LastUpdatedDate: string | null;
}

interface KnsCmtSessionItem {
  ItemID: number;
  CommitteeSessionID: number;
  Name: string | null;
  Ordinal: number | null;
}

/**
 * Sync committee sessions (+ agenda items as topics) from OData for Knessets
 * in SUPPORTED_COMMITTEE_KNESSETS. Incremental via LastUpdatedDate.
 *
 * Uses KNS_CommitteeSession (Note → title, StartDate → sessionDate with time).
 * Agenda items come from KNS_CmtSessionItem, aggregated into topics[].
 */
async function syncCommitteeSessionRecords(
  prevCheckpoint: SyncCheckpoint | null,
): Promise<{ count: number; checkpoint: SyncCheckpoint }> {
  const sinceIso = prevCheckpoint?.lastItemTimestamp as string | undefined;

  // Load committees we care about (scoped Knessets) and their knessetId → db id
  const rows = await db
    .select({
      id: committees.id,
      knessetId: committees.knessetId,
      knessetNum: committees.knessetNum,
    })
    .from(committees)
    .where(inArray(committees.knessetNum, [...SUPPORTED_COMMITTEE_KNESSETS]));

  if (rows.length === 0) {
    console.log('  [committee-sessions] No committees in supported Knessets');
    return { count: 0, checkpoint: prevCheckpoint ?? {} };
  }

  const committeeIdByKnessetId = new Map(rows.map((r) => [r.knessetId, r.id]));
  const committeeKnessetIds = rows.map((r) => r.knessetId);
  console.log(
    `  [committee-sessions] ${rows.length} committees in K${SUPPORTED_COMMITTEE_KNESSETS.join('/')}`,
  );

  // Fetch sessions in committee-id batches to keep URLs reasonable
  const sessions: KnsCommitteeSession[] = [];
  let maxUpdated = sinceIso;

  for (
    let i = 0;
    i < committeeKnessetIds.length;
    i += COMMITTEE_IDS_PER_QUERY
  ) {
    const chunk = committeeKnessetIds.slice(i, i + COMMITTEE_IDS_PER_QUERY);
    const idFilter =
      '(' + chunk.map((id) => `CommitteeID eq ${id}`).join(' or ') + ')';
    const parts = [idFilter];
    if (sinceIso) {
      const iso = new Date(sinceIso).toISOString().replace('Z', '');
      parts.push(`LastUpdatedDate gt datetime'${iso}'`);
    }

    // Knesset OData v2 hard-caps responses at 100 rows regardless of $top.
    // Paginate by actual page length and only stop when a page is empty.
    let skip = 0;
    const PAGE = 100;
    while (true) {
      const page = await fetchOData<KnsCommitteeSession>(
        'ParliamentInfo',
        'KNS_CommitteeSession',
        {
          $filter: parts.join(' and '),
          $orderby: 'StartDate desc',
          $top: PAGE,
          $skip: skip,
        },
      );
      if (page.length === 0) break;
      sessions.push(...page);
      for (const s of page) {
        if (
          s.LastUpdatedDate &&
          (!maxUpdated || s.LastUpdatedDate > maxUpdated)
        ) {
          maxUpdated = s.LastUpdatedDate;
        }
      }
      skip += page.length;
    }
    console.log(
      `  [committee-sessions] committees ${i}..${i + chunk.length}: total sessions ${sessions.length}`,
    );
  }

  if (sessions.length === 0) {
    console.log('  [committee-sessions] No new sessions');
    return {
      count: 0,
      checkpoint: { ...(prevCheckpoint ?? {}), lastItemTimestamp: maxUpdated },
    };
  }

  // OData pagination isn't guaranteed stable — dedupe by CommitteeSessionID
  // to avoid "ON CONFLICT cannot affect row a second time" in the upsert batch.
  const seenIds = new Set<number>();
  const dedupedSessions: KnsCommitteeSession[] = [];
  for (const s of sessions) {
    if (seenIds.has(s.CommitteeSessionID)) continue;
    seenIds.add(s.CommitteeSessionID);
    dedupedSessions.push(s);
  }
  if (dedupedSessions.length !== sessions.length) {
    console.log(
      `  [committee-sessions] Deduped ${sessions.length - dedupedSessions.length} overlapping pagination duplicates`,
    );
  }

  // Fetch agenda items for these sessions → aggregate into topics[]
  const sessionIdList = dedupedSessions.map((s) => s.CommitteeSessionID);
  const topicsBySession = await fetchAgendaTopics(sessionIdList);

  // Upsert sessions
  const toInsert = dedupedSessions
    .map((s) => {
      const dbCommitteeId = committeeIdByKnessetId.get(s.CommitteeID);
      if (!dbCommitteeId) return null;
      const topics = topicsBySession.get(s.CommitteeSessionID) ?? [];
      return {
        knessetId: s.CommitteeSessionID,
        committeeId: dbCommitteeId,
        sessionDate: s.StartDate ? new Date(s.StartDate) : null,
        title: s.Note?.trim() || null,
        topics: topics.length > 0 ? topics : null,
        metadata: {
          finishDate: s.FinishDate,
          number: s.Number,
          lastUpdated: s.LastUpdatedDate,
        },
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  let upserted = 0;
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    await db
      .insert(committeeSessions)
      .values(batch)
      .onConflictDoUpdate({
        target: committeeSessions.knessetId,
        set: {
          sessionDate: sql`excluded.session_date`,
          title: sql`excluded.title`,
          topics: sql`excluded.topics`,
          metadata: sql`excluded.metadata`,
        },
      });
    upserted += batch.length;
  }

  console.log(`  [committee-sessions] Upserted ${upserted} sessions`);

  return {
    count: upserted,
    checkpoint: { ...(prevCheckpoint ?? {}), lastItemTimestamp: maxUpdated },
  };
}

/**
 * Fetch KNS_CmtSessionItem rows for the given session IDs and collect
 * agenda item names grouped by session. Queries in ID chunks to keep URLs sane.
 */
async function fetchAgendaTopics(
  sessionIds: number[],
): Promise<Map<number, string[]>> {
  const byItems = new Map<number, Array<{ order: number; name: string }>>();
  // OData v2 doesn't support `in (…)` so we or-chain. 40 is a safe chunk size
  // for URL length (40 × ~28 chars ≈ 1.1KB).
  const CHUNK = 40;
  for (let i = 0; i < sessionIds.length; i += CHUNK) {
    const chunk = sessionIds.slice(i, i + CHUNK);
    const filter =
      '(' + chunk.map((id) => `CommitteeSessionID eq ${id}`).join(' or ') + ')';
    // Server caps pages at 100 — paginate by actual length, stop on empty.
    const items: KnsCmtSessionItem[] = [];
    let skip = 0;
    while (true) {
      const page = await fetchOData<KnsCmtSessionItem>(
        'ParliamentInfo',
        'KNS_CmtSessionItem',
        {
          $filter: filter,
          $select: 'ItemID,CommitteeSessionID,Name,Ordinal',
          $top: 100,
          $skip: skip,
        },
      );
      if (page.length === 0) break;
      items.push(...page);
      skip += page.length;
    }
    for (const it of items) {
      const name = it.Name?.trim();
      if (!name) continue;
      if (!byItems.has(it.CommitteeSessionID)) {
        byItems.set(it.CommitteeSessionID, []);
      }
      byItems
        .get(it.CommitteeSessionID)!
        .push({ order: it.Ordinal ?? 0, name });
    }
  }

  const topics = new Map<number, string[]>();
  for (const [sessionId, items] of byItems) {
    items.sort((a, b) => a.order - b.order);
    const seen = new Set<string>();
    const names: string[] = [];
    for (const it of items) {
      if (seen.has(it.name)) continue;
      seen.add(it.name);
      names.push(it.name);
    }
    topics.set(sessionId, names);
  }
  return topics;
}

export async function syncCommitteeSessions(): Promise<void> {
  await runSyncJob('committee-sessions', syncCommitteeSessionRecords);
}
