-- Indexes for fast session lookups: by committee (detail page) and by date
-- (future cross-committee overlap queries, e.g. "was MK X elsewhere at that time?")
CREATE INDEX IF NOT EXISTS "idx_committee_sessions_committee_date"
  ON "committee_sessions" ("committee_id", "session_date" DESC);

CREATE INDEX IF NOT EXISTS "idx_committee_sessions_date"
  ON "committee_sessions" ("session_date");
