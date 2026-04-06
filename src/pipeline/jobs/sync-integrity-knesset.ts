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
 * Ethics Committee IDs from Knesset OData.
 * 1 = ועדת האתיקה, 2 = ועדת הכנסת (House Committee)
 * These IDs may vary — we query by committee name patterns.
 */
const ETHICS_COMMITTEE_NAMES = ['ועדת האתיקה', 'ועדת הכנסת'];

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
      // Find ethics-related committees in our DB
      const ethicsCommittees = await db
        .select({ id: committees.id, name: committees.name })
        .from(committees)
        .where(
          sql`${committees.name} ILIKE ANY(ARRAY['%אתיקה%', '%ועדת הכנסת%'])`,
        );

      if (ethicsCommittees.length === 0) {
        console.log('[sync:integrity-knesset] No ethics committees found in DB — skipping');
        return 0;
      }

      const committeeIds = ethicsCommittees.map((c) => c.id);
      console.log(
        `[sync:integrity-knesset] Found ${committeeIds.length} ethics-related committees`,
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
        const updatedDate =
          session.LastUpdatedDate ?? session.StartDate;

        if (updatedDate > maxTimestamp) {
          maxTimestamp = updatedDate;
        }

        // Upsert a placeholder integrity case for tracking
        // The Note field may contain relevant info about the session topic
        if (session.Note) {
          // Try to match member names from the note
          const matchedMembers = await findMentionedMembers(session.Note);

          for (const member of matchedMembers) {
            await db
              .insert(integrityCases)
              .values({
                memberId: member.id,
                category: 'ethics_complaint',
                severity: 'info',
                status: 'reported',
                title: session.Note.substring(0, 200),
                sourceType: 'knesset_ethics_committee',
                sourceName: ETHICS_COMMITTEE_NAMES[0],
                sourceDocId: String(session.CommitteeSessionID),
                eventDate: sessionDate,
              })
              .onConflictDoNothing();
            count++;
          }
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
