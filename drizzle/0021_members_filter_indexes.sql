-- Additional indexes for Members advanced filter upgrade.
-- Apply via: pnpm tsx src/scripts/apply-migration.ts 0021_members_filter_indexes.sql

-- Age / seniority range filters + sorts
CREATE INDEX IF NOT EXISTS members_birth_date_idx
  ON members (birth_date);
CREATE INDEX IF NOT EXISTS members_start_date_idx
  ON members (start_date);

-- Political group filter — joined from members via faction
CREATE INDEX IF NOT EXISTS factions_political_group_idx
  ON factions (political_group_id);

-- Member role filter (chair/deputy/member) — reverse of committee_members_committee_position_idx
CREATE INDEX IF NOT EXISTS committee_members_member_position_idx
  ON committee_members (member_id, position_id);
