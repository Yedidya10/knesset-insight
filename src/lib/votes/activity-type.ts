/**
 * Parliamentary activity type classification for plenum votes.
 *
 * Derived from vote title + billId linkage. Single source of truth reused by
 * the sync pipeline (persisted on insert/upsert) and the votes filter UI
 * (filters via indexed column instead of runtime title regex).
 */

export type VoteActivityType = 'bill' | 'noConfidence' | 'agenda' | 'plenary';

const PAT_NO_CONFIDENCE = /אי[ \u00A0-]?אמון/;
const PAT_AGENDA = /סדר היום/;
const PAT_LAW = /חוק/;
const PAT_GOV_ANNOUNCEMENT = /הודעת הממשלה/;

/**
 * Classify a plenum vote based on its title and bill linkage.
 *
 * Rules (applied in order):
 * 1. `noConfidence` — title matches "אי אמון" / "אי-אמון".
 * 2. `agenda` — title mentions "סדר היום" (motion of the day).
 * 3. `bill` — linked to a bill row, OR title mentions "חוק" while not
 *    matching the non-legislative patterns above or a government-announcement.
 * 4. `plenary` — everything else (general plenum debates, announcements).
 */
export function classifyVoteActivity(
  title: string | null | undefined,
  billId: number | null | undefined,
): VoteActivityType {
  const t = title ?? '';

  if (PAT_NO_CONFIDENCE.test(t)) return 'noConfidence';
  if (PAT_AGENDA.test(t)) return 'agenda';

  if (billId != null) return 'bill';

  if (PAT_LAW.test(t) && !PAT_GOV_ANNOUNCEMENT.test(t)) {
    return 'bill';
  }

  return 'plenary';
}
