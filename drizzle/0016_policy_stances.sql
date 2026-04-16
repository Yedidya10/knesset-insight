-- Policy Stances — curated policy positions (TheyVoteForYou-inspired)
CREATE TABLE policy_stances (
  id SERIAL PRIMARY KEY,
  label JSONB NOT NULL,
  description JSONB,
  domain TEXT,
  stance_type TEXT NOT NULL DEFAULT 'direct'
    CHECK (stance_type IN ('direct', 'derived')),
  is_active BOOLEAN DEFAULT true,
  vote_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_policy_stances_domain ON policy_stances(domain);
CREATE INDEX idx_policy_stances_type ON policy_stances(stance_type);

-- Vote Stance Alignment — per-vote directional classification
CREATE TABLE vote_stance_alignment (
  id SERIAL PRIMARY KEY,
  vote_id INTEGER REFERENCES votes(id) NOT NULL,
  stance_id INTEGER REFERENCES policy_stances(id) NOT NULL,
  alignment TEXT NOT NULL CHECK (alignment IN ('supports', 'opposes')),
  pro_position JSONB NOT NULL,
  confidence REAL NOT NULL,
  needs_review BOOLEAN DEFAULT false,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vote_id, stance_id)
);

CREATE INDEX idx_vsa_stance ON vote_stance_alignment(stance_id);
CREATE INDEX idx_vsa_review ON vote_stance_alignment(needs_review) WHERE needs_review = true;
CREATE INDEX idx_vsa_vote ON vote_stance_alignment(vote_id);

-- Bill Classification Context — cached context for incremental backfill
CREATE TABLE bill_classification_context (
  bill_id INTEGER PRIMARY KEY REFERENCES bills(id),
  document_text TEXT,
  tavily_context TEXT,
  ai_topics TEXT[],
  ai_summary JSONB,
  context_created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stance Backfill Log — tracks incremental backfill per stance
CREATE TABLE stance_backfill_log (
  stance_id INTEGER REFERENCES policy_stances(id) PRIMARY KEY,
  backfill_status TEXT NOT NULL CHECK (backfill_status IN
    ('pending', 'in_progress', 'completed', 'failed')),
  bills_scanned INTEGER DEFAULT 0,
  bills_matched INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

-- Pipeline Run Log — per-job execution tracking
CREATE TABLE pipeline_run_log (
  id SERIAL PRIMARY KEY,
  job_name TEXT NOT NULL,
  run_status TEXT NOT NULL CHECK (run_status IN
    ('running', 'completed', 'failed', 'partial')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  items_processed INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  items_skipped INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  tavily_calls INTEGER DEFAULT 0,
  estimated_cost_usd REAL DEFAULT 0,
  config_snapshot JSONB,
  checkpoint TEXT,
  error_summary TEXT,
  metadata JSONB
);

CREATE INDEX idx_prl_job ON pipeline_run_log(job_name, started_at DESC);

-- Pipeline Item Log — per-item execution tracking
CREATE TABLE pipeline_item_log (
  id SERIAL PRIMARY KEY,
  run_id INTEGER REFERENCES pipeline_run_log(id) NOT NULL,
  item_type TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN
    ('success', 'failed', 'skipped', 'needs_review')),
  duration_ms INTEGER,
  tokens_used INTEGER,
  error_code TEXT,
  error_message TEXT,
  ai_response JSONB,
  tavily_results JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pil_run ON pipeline_item_log(run_id);
CREATE INDEX idx_pil_status ON pipeline_item_log(status) WHERE status = 'failed';
CREATE INDEX idx_pil_error ON pipeline_item_log(error_code) WHERE error_code IS NOT NULL;
CREATE INDEX idx_pil_item ON pipeline_item_log(item_type, item_id);
