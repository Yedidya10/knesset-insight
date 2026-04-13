-- Election results by city/settlement (historical elections data)
CREATE TABLE IF NOT EXISTS election_city_results (
  id SERIAL PRIMARY KEY,
  knesset_num INTEGER NOT NULL,
  city_code TEXT NOT NULL,
  city_name TEXT NOT NULL,
  district_code INTEGER,
  eligible_voters INTEGER NOT NULL,
  actual_voters INTEGER NOT NULL,
  valid_votes INTEGER NOT NULL,
  invalid_votes INTEGER NOT NULL DEFAULT 0,
  turnout_percent NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(knesset_num, city_code)
);

-- Party results per city per election
CREATE TABLE IF NOT EXISTS election_city_party_results (
  id SERIAL PRIMARY KEY,
  city_result_id INTEGER NOT NULL REFERENCES election_city_results(id) ON DELETE CASCADE,
  ballot_letters TEXT NOT NULL,
  party_name TEXT NOT NULL,
  votes INTEGER NOT NULL,
  vote_percent NUMERIC(5,2),
  UNIQUE(city_result_id, ballot_letters)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_election_city_results_knesset ON election_city_results(knesset_num);
CREATE INDEX IF NOT EXISTS idx_election_city_results_city ON election_city_results(city_code);
CREATE INDEX IF NOT EXISTS idx_election_city_results_district ON election_city_results(knesset_num, district_code);
CREATE INDEX IF NOT EXISTS idx_election_city_party_results_city ON election_city_party_results(city_result_id);
