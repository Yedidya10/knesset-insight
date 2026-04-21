-- Additional indexes for Legislation (bills) advanced filter upgrade.
-- Apply via: pnpm tsx src/scripts/apply-migration.ts 0022_bills_filter_indexes.sql

-- Committee filter — bills.committee_id IN (...)
CREATE INDEX IF NOT EXISTS bills_committee_idx
  ON bills (committee_id);
