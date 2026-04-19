-- 0018: Policy Stances v2 — reservation flag + vote weight
-- Adds is_reservation to votes (marks reservation votes for Phase 2 handling)
-- Adds vote_weight to vote_stance_alignment (differential weighting)

ALTER TABLE votes ADD COLUMN IF NOT EXISTS is_reservation BOOLEAN DEFAULT false;

ALTER TABLE vote_stance_alignment ADD COLUMN IF NOT EXISTS vote_weight REAL DEFAULT 1.0;

-- Backfill: mark existing reservation votes based on title regex
UPDATE votes
SET is_reservation = true
WHERE title ~* 'הסתייגו'
  AND is_reservation = false;

-- Index for filtering reservation votes
CREATE INDEX IF NOT EXISTS idx_votes_is_reservation ON votes(is_reservation);
