-- Advanced filter performance indexes
-- Supports trigram search on vote/bill/committee titles, plus composite indexes
-- for the EXISTS/JOIN patterns used by the shared filter system.
-- Apply manually via psql or `pnpm tsx src/scripts/apply-migration-0019.ts`;
-- `drizzle-kit push` is known-broken in this repo.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Votes: title search + date sort + member-vote joins
CREATE INDEX IF NOT EXISTS votes_title_trgm_idx
  ON votes USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS votes_vote_date_idx
  ON votes (vote_date DESC);
CREATE INDEX IF NOT EXISTS member_votes_vote_member_idx
  ON member_votes (vote_id, member_id);
CREATE INDEX IF NOT EXISTS member_votes_member_vote_idx
  ON member_votes (member_id, vote_id);

-- Bills: list filters (knesset + type + status) + initiator joins + name search
CREATE INDEX IF NOT EXISTS bills_name_trgm_idx
  ON bills USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS bills_knesset_type_status_idx
  ON bills (knesset_num, bill_type, status);
CREATE INDEX IF NOT EXISTS bills_proposed_date_idx
  ON bills (proposed_date DESC);
CREATE INDEX IF NOT EXISTS bill_initiators_member_bill_idx
  ON bill_initiators (member_id, bill_id);

-- Members: current/past + Knesset term + faction-history joins
CREATE INDEX IF NOT EXISTS members_knesset_current_idx
  ON members (knesset_num, is_current);
CREATE INDEX IF NOT EXISTS member_faction_history_member_knesset_idx
  ON member_faction_history (member_id, knesset_num);

-- Committees: name search + role/position filters
CREATE INDEX IF NOT EXISTS committees_name_trgm_idx
  ON committees USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS committee_members_committee_position_idx
  ON committee_members (committee_id, position_id);
