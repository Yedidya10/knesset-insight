-- Computed filter columns for votes and bills.
--
-- votes.activity_type replaces the 5-branch title regex on the votes page
--   (bill | noConfidence | agenda | plenary). Classified by
--   src/lib/votes/activity-type.ts.
--
-- bills.current_stage + bills.stage_special_status persist the output of
--   computeBillStage() from src/lib/knesset/bill-stages.ts, enabling
--   server-side stage filtering with an index instead of per-row JS
--   post-processing.

ALTER TABLE votes
  ADD COLUMN IF NOT EXISTS activity_type text;

ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS current_stage smallint;

ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS stage_special_status text;

CREATE INDEX IF NOT EXISTS votes_activity_type_date_idx
  ON votes (activity_type, vote_date DESC);

CREATE INDEX IF NOT EXISTS bills_current_stage_knesset_idx
  ON bills (current_stage, knesset_num);
