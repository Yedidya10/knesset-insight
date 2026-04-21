import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../lib/db';
import {
  integrityCases,
  members,
  committeeSessions,
  committees,
} from '../../lib/db/schema';
import { runSyncJob, type SyncCheckpoint } from '../utils';
import { fetchOData } from '../../lib/knesset/odata-client';

/**
 * Integrity-relevant Knesset committees:
 * - ועדת האתיקה — primary authority over MK ethics complaints.
 * - ועדת הכנסת — mostly procedural; relevant ONLY when item relates to
 *   immunity removal (הסרת חסינות) or sanctions against speaker/chair.
 * We narrow House Committee matching to those topical keywords only.
 */
const ETHICS_COMMITTEE_NAMES = ['ועדת האתיקה'];
const HOUSE_COMMITTEE_KEYWORDS = [
  'הסרת חסינות',
  'חסינות',
  'סנקצי',
  'התנהגות',
  'קובלנה',
];

interface KnsCommitteeSession {
  CommitteeSessionID: number;
  CommitteeID: number;
  Number: number;
  StartDate: string;
  FinishDate: string | null;
  Note: string | null;
  LastUpdatedDate: string | null;
}

/**
 * Sync integrity-related committee sessions from the Ethics Committee.
 * Phase 1: Imports the session metadata and creates placeholder integrity cases.
 * AI analysis (Phase 2) fills in the event details from protocol text.
 */
export async function syncIntegrityKnesset(): Promise<void> {
  await runSyncJob(
    'integrity-knesset',
    async (prevCheckpoint: SyncCheckpoint | null) => {
      // Find ethics committee + House Committee (filtered by topic later) in our DB
      const relevantCommittees = await db
        .select({ id: committees.id, name: committees.name })
        .from(committees)
        .where(
          sql`${committees.name} ILIKE ANY(ARRAY['%אתיקה%', '%ועדת הכנסת%'])`,
        );

      if (relevantCommittees.length === 0) {
        console.log(
          '[sync:integrity-knesset] No relevant committees found in DB — skipping',
        );
        return 0;
      }

      const ethicsCommitteeIds = new Set(
        relevantCommittees
          .filter((c) => c.name?.includes('אתיקה'))
          .map((c) => c.id),
      );
      const houseCommitteeIds = new Set(
        relevantCommittees
          .filter((c) => c.name?.includes('ועדת הכנסת'))
          .map((c) => c.id),
      );
      const committeeIds = relevantCommittees.map((c) => c.id);
      console.log(
        `[sync:integrity-knesset] Found ${ethicsCommitteeIds.size} ethics + ${houseCommitteeIds.size} house committees`,
      );

      // Fetch sessions since last checkpoint
      const lastTimestamp = prevCheckpoint?.lastItemTimestamp;
      const filter = lastTimestamp
        ? `CommitteeID in (${committeeIds.join(',')}) and LastUpdatedDate gt datetime'${lastTimestamp}'`
        : `CommitteeID in (${committeeIds.join(',')})`;

      const sessions = await fetchOData<KnsCommitteeSession>(
        'ParliamentInfo',
        'KNS_CommitteeSession',
        {
          $filter: filter,
          $orderby: 'StartDate desc',
          $top: 100,
        },
      );

      if (sessions.length === 0) {
        console.log('[sync:integrity-knesset] No new ethics sessions');
        return { count: 0, checkpoint: prevCheckpoint ?? {} };
      }

      console.log(
        `[sync:integrity-knesset] Processing ${sessions.length} ethics committee sessions`,
      );

      let count = 0;
      let maxTimestamp = lastTimestamp ?? '';

      for (const session of sessions) {
        const sessionDate = session.StartDate.split('T')[0];
        const updatedDate = session.LastUpdatedDate ?? session.StartDate;

        if (updatedDate > maxTimestamp) {
          maxTimestamp = updatedDate;
        }

        if (!session.Note) continue;

        const isEthics = ethicsCommitteeIds.has(session.CommitteeID);
        const isHouse = houseCommitteeIds.has(session.CommitteeID);

        // For House Committee: only accept items whose topic mentions
        // immunity removal / sanctions / conduct complaints.
        if (isHouse) {
          const matchesTopic = HOUSE_COMMITTEE_KEYWORDS.some((kw) =>
            session.Note!.includes(kw),
          );
          if (!matchesTopic) continue;
        }

        const { category, sourceType, sourceName } = isHouse
          ? {
              category: 'immunity_request',
              sourceType: 'knesset_house_committee',
              sourceName: 'ועדת הכנסת',
            }
          : {
              category: 'ethics_complaint',
              sourceType: 'knesset_ethics_committee',
              sourceName: 'ועדת האתיקה',
            };

        if (!isEthics && !isHouse) continue;

        const matchedMembers = await findMentionedMembers(session.Note);
        for (const member of matchedMembers) {
          await db
            .insert(integrityCases)
            .values({
              memberId: member.id,
              category,
              severity: 'info',
              status: 'reported',
              title: session.Note.substring(0, 200),
              sourceType,
              sourceName,
              sourceDocId: String(session.CommitteeSessionID),
              eventDate: sessionDate,
            })
            .onConflictDoNothing();
          count++;
        }
      }

      return {
        count,
        checkpoint: {
          ...prevCheckpoint,
          lastItemTimestamp: maxTimestamp,
        },
      };
    },
  );
}

/**
 * Search for member names mentioned in a session note text.
 * Returns matched members from the DB.
 */
async function findMentionedMembers(
  text: string,
): Promise<Array<{ id: number; firstName: string; lastName: string }>> {
  // Get current members for matching
  const allMembers = await db
    .select({
      id: members.id,
      firstName: members.firstName,
      lastName: members.lastName,
    })
    .from(members)
    .where(eq(members.isCurrent, true));

  return allMembers.filter((m) => {
    const fullName = `${m.firstName} ${m.lastName}`;
    return text.includes(fullName);
  });
}
