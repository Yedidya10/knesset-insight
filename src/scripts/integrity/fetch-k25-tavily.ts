/**
 * Phase 1 — Tavily snippet fetch for all K25 Knesset members.
 *
 * For each MK who served in K25 (active or retired), runs the integrity-
 * focused Tavily search and writes the raw snippets to
 *   tmp/integrity-k25/<memberId>.json
 *
 * Phase 2 (manual, done by Claude Opus in-conversation) reads these files
 * and produces <memberId>.analysis.json. Phase 3 inserts into integrity_cases.
 *
 * Resumable: MKs with an existing <id>.json are skipped. Delete a file to
 * re-fetch that MK.
 *
 * Run with:  pnpm tsx src/scripts/integrity/fetch-k25-tavily.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { mkdirSync, existsSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = join(process.cwd(), 'tmp', 'integrity-k25');
const MANIFEST = join(OUT_DIR, '_manifest.json');

interface FetchRecord {
  memberId: number;
  memberName: string;
  knessetId: number;
  isCurrent: boolean | null;
  factionName: string | null;
  fetchedAt: string;
  snippetCount: number;
  snippets: unknown[];
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  if (!process.env.TAVILY_API_KEY) {
    console.error('[fetch-k25] TAVILY_API_KEY missing in .env.local');
    process.exit(1);
  }

  const { db } = await import('../../lib/db');
  const { members, memberFactionHistory, factions } =
    await import('../../lib/db/schema');
  const { eq, and, sql, inArray } = await import('drizzle-orm');
  const { searchMkIntegrity } =
    await import('../../lib/ai/integrity/web-search-integrity');

  // Members who served in K25 (active or retired) — distinct member_ids from
  // memberFactionHistory with knesset_num = 25.
  const k25MemberIds = await db
    .selectDistinct({ id: memberFactionHistory.memberId })
    .from(memberFactionHistory)
    .where(eq(memberFactionHistory.knessetNum, 25));

  const ids = k25MemberIds.map((r) => r.id);
  console.log(`[fetch-k25] Found ${ids.length} distinct K25 members`);

  const mkRows = await db
    .select({
      id: members.id,
      knessetId: members.knessetId,
      firstName: members.firstName,
      lastName: members.lastName,
      isCurrent: members.isCurrent,
      factionName: factions.name,
    })
    .from(members)
    .leftJoin(factions, eq(members.factionId, factions.id))
    .where(inArray(members.id, ids))
    .orderBy(members.lastName, members.firstName);

  const existing = new Set(
    readdirSync(OUT_DIR)
      .filter((f) => /^\d+\.json$/.test(f))
      .map((f) => f.replace('.json', '')),
  );

  console.log(
    `[fetch-k25] ${existing.size} members already fetched — skipping those`,
  );

  let fetched = 0;
  let totalHits = 0;
  const start = Date.now();

  for (const mk of mkRows) {
    const idStr = String(mk.id);
    if (existing.has(idStr)) continue;

    const fullName = `${mk.firstName} ${mk.lastName}`.trim();
    process.stdout.write(
      `[fetch-k25] (${fetched + 1}/${mkRows.length - existing.size}) ${fullName}… `,
    );

    let snippets: unknown[] = [];
    try {
      snippets = await searchMkIntegrity(fullName);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`FAILED (${msg})`);
      continue;
    }

    const record: FetchRecord = {
      memberId: mk.id,
      memberName: fullName,
      knessetId: mk.knessetId,
      isCurrent: mk.isCurrent,
      factionName: mk.factionName,
      fetchedAt: new Date().toISOString(),
      snippetCount: snippets.length,
      snippets,
    };

    writeFileSync(
      join(OUT_DIR, `${mk.id}.json`),
      JSON.stringify(record, null, 2),
      'utf8',
    );

    console.log(`${snippets.length} hits`);
    fetched++;
    totalHits += snippets.length;

    // Gentle pacing: 400ms between calls (Tavily free tier ~30 req/min)
    await new Promise((r) => setTimeout(r, 400));
  }

  // Write manifest with summary for Phase 2
  const allFiles = readdirSync(OUT_DIR).filter((f) => /^\d+\.json$/.test(f));
  const manifest = {
    generatedAt: new Date().toISOString(),
    totalMembers: mkRows.length,
    totalFetched: allFiles.length,
    byHits: {} as Record<string, number>,
    membersWithHits: [] as Array<{
      memberId: number;
      memberName: string;
      snippetCount: number;
    }>,
  };

  for (const f of allFiles) {
    const content = JSON.parse(
      (await import('node:fs')).readFileSync(join(OUT_DIR, f), 'utf8'),
    ) as FetchRecord;
    const bucket =
      content.snippetCount === 0
        ? '0'
        : content.snippetCount < 3
          ? '1-2'
          : content.snippetCount < 6
            ? '3-5'
            : '6+';
    manifest.byHits[bucket] = (manifest.byHits[bucket] ?? 0) + 1;
    if (content.snippetCount > 0) {
      manifest.membersWithHits.push({
        memberId: content.memberId,
        memberName: content.memberName,
        snippetCount: content.snippetCount,
      });
    }
  }

  manifest.membersWithHits.sort((a, b) => b.snippetCount - a.snippetCount);

  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log('\n[fetch-k25] Done.');
  console.log(`  Fetched this run: ${fetched} members`);
  console.log(`  Total hits:       ${totalHits}`);
  console.log(`  Members with ≥1:  ${manifest.membersWithHits.length}`);
  console.log(`  Time:             ${elapsed}s`);
  console.log(`  Manifest:         ${MANIFEST}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('[fetch-k25] Fatal:', err);
  process.exit(1);
});
