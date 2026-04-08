import { sql, eq } from 'drizzle-orm';
import { db } from '../../lib/db';
import { votes } from '../../lib/db/schema';
import { runSyncJob } from '../utils';

/** Generic vote titles that need enrichment from sess_item_dscr */
const GENERIC_TITLES = [
  'הסתייגות', 'להעביר את הצעת החוק לוועדה', 'קריאה שנייה',
  'אישור החוק', 'הצעת ועדה', 'הצעת ועדת הכנסת',
  'להעביר את הנושא לוועדה', 'הצבעה', 'שם החוק',
  'להעביר את הצעת החוק לוועדה שתקבע ועדת הכנסת',
  'העברת הנושא לוועדה שתקבע ועדת הכנסת',
  'להחיל דין רציפות',
];

const REQUEST_DELAY = 300; // ms between API requests to be polite

/**
 * Fetch one vote from the legacy Votes.svc to get sess_item_dscr for a sessItemId.
 */
async function fetchSessItemDescription(sessItemId: number): Promise<string | null> {
  const url = `https://knesset.gov.il/Odata/Votes.svc/View_vote_rslts_hdr_Approved?$filter=sess_item_id eq ${sessItemId}&$top=1&$select=sess_item_dscr&$format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) return null;
  const data = await res.json();
  const items = data.d?.results ?? data.value ?? [];
  return items[0]?.sess_item_dscr?.trim() || null;
}

/**
 * Enrich votes that have generic titles (e.g. "הסתייגות") by fetching
 * the full session item description (sess_item_dscr) from the Knesset
 * legacy Votes.svc API and prepending it to the title.
 *
 * Strategy: group by sessItemId, fetch one API call per group, bulk-update.
 * ~200 unique sessItemIds instead of ~9000 individual votes.
 *
 * Example: "הסתייגות" → "הצעת חוק חדלות פירעון ... — הסתייגות"
 */
export async function enrichVoteTitles(): Promise<void> {
  await runSyncJob('enrich-vote-titles', async () => {
    // Find distinct sessItemIds that have generic-titled votes (K≤24)
    const groups = await db.execute<{ sess_item_id: number; cnt: string }>(sql`
      SELECT sess_item_id, COUNT(*) as cnt
      FROM votes
      WHERE title IN (${sql.join(GENERIC_TITLES.map((t) => sql`${t}`), sql`, `)})
        AND knesset_num <= 24
        AND sess_item_id IS NOT NULL
      GROUP BY sess_item_id
      ORDER BY cnt DESC
    `);

    const totalVotes = groups.reduce((sum, g) => sum + Number(g.cnt), 0);
    console.log(`[enrich-vote-titles] ${groups.length} unique sessItemIds covering ${totalVotes} votes`);
    if (groups.length === 0) return 0;

    let enrichedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < groups.length; i++) {
      const { sess_item_id: sessItemId, cnt } = groups[i];

      try {
        const description = await fetchSessItemDescription(sessItemId);
        if (!description) {
          skippedCount += Number(cnt);
          continue;
        }

        // Bulk update all generic-titled votes in this sessItemId group
        const result = await db.execute(sql`
          UPDATE votes
          SET title = ${description} || ' — ' || title,
              updated_at = NOW()
          WHERE sess_item_id = ${sessItemId}
            AND title IN (${sql.join(GENERIC_TITLES.map((t) => sql`${t}`), sql`, `)})
        `);

        enrichedCount += Number(cnt);
      } catch (err: any) {
        failedCount += Number(cnt);
        console.warn(`[enrich-vote-titles] sessItemId=${sessItemId} failed: ${err.message}`);
      }

      if ((i + 1) % 50 === 0 || i === groups.length - 1) {
        console.log(
          `[enrich-vote-titles] ${i + 1}/${groups.length} groups (enriched: ${enrichedCount}, skipped: ${skippedCount}, failed: ${failedCount})`,
        );
      }

      // Rate-limit API requests
      if (i + 1 < groups.length) {
        await new Promise((r) => setTimeout(r, REQUEST_DELAY));
      }
    }

    // Also update votes without sessItemId — fetch individually
    const noSessVotes = await db.execute<{ id: number; knesset_id: number; title: string }>(sql`
      SELECT id, knesset_id, title FROM votes
      WHERE title IN (${sql.join(GENERIC_TITLES.map((t) => sql`${t}`), sql`, `)})
        AND knesset_num <= 24
        AND sess_item_id IS NULL
    `);

    if (noSessVotes.length > 0) {
      console.log(`[enrich-vote-titles] ${noSessVotes.length} votes without sessItemId — fetching individually`);
      for (const vote of noSessVotes) {
        try {
          const url = `https://knesset.gov.il/Odata/Votes.svc/View_vote_rslts_hdr_Approved?$filter=vote_id eq ${vote.knesset_id}&$top=1&$select=sess_item_dscr&$format=json`;
          const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
          if (!res.ok) continue;
          const data = await res.json();
          const items = data.d?.results ?? data.value ?? [];
          const dscr = items[0]?.sess_item_dscr?.trim();
          if (dscr) {
            await db.update(votes).set({ title: `${dscr} — ${vote.title}` }).where(eq(votes.id, vote.id));
            enrichedCount++;
          }
        } catch {
          failedCount++;
        }
        await new Promise((r) => setTimeout(r, REQUEST_DELAY));
      }
    }

    console.log(
      `[enrich-vote-titles] DONE: enriched=${enrichedCount} skipped=${skippedCount} failed=${failedCount}`,
    );
    return enrichedCount;
  });
}
