-- Bill Clusters: unified legislation entities
-- Requires pgvector extension for embedding storage

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ──────────────────────────────────────
-- bill_clusters: groups related bills into a single legislative story
-- ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS bill_clusters (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  primary_bill_id INTEGER,
  current_stage INTEGER,
  special_status TEXT,
  bill_type TEXT,
  latest_knesset_num INTEGER,
  bill_count INTEGER DEFAULT 1,
  has_unions BOOLEAN DEFAULT FALSE,
  has_splits BOOLEAN DEFAULT FALSE,
  has_cross_term_bills BOOLEAN DEFAULT FALSE,
  ai_processed BOOLEAN DEFAULT FALSE,
  ai_confidence REAL,
  latest_update TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────
-- bill_cluster_members: links bills to their cluster
-- ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS bill_cluster_members (
  id SERIAL PRIMARY KEY,
  cluster_id INTEGER NOT NULL REFERENCES bill_clusters(id),
  bill_id INTEGER NOT NULL REFERENCES bills(id),
  relationship_type TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  is_origin BOOLEAN DEFAULT FALSE,
  is_primary BOOLEAN DEFAULT FALSE,
  ai_reasoning TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (bill_id)
);

-- ──────────────────────────────────────
-- bill_embeddings: pgvector embeddings for similarity search
-- ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS bill_embeddings (
  id SERIAL PRIMARY KEY,
  bill_id INTEGER NOT NULL REFERENCES bills(id) UNIQUE,
  embedding vector(768),
  model TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────
-- Add cluster_id to bills (denormalized for fast queries)
-- ──────────────────────────────────────
ALTER TABLE bills ADD COLUMN IF NOT EXISTS cluster_id INTEGER;

-- ──────────────────────────────────────
-- Add bill_stage to votes (derived from vote title keywords)
-- ──────────────────────────────────────
ALTER TABLE votes ADD COLUMN IF NOT EXISTS bill_stage INTEGER;

-- ──────────────────────────────────────
-- Foreign key constraints (deferred to avoid circular dependency)
-- ──────────────────────────────────────
ALTER TABLE bills
  ADD CONSTRAINT fk_bills_cluster
  FOREIGN KEY (cluster_id) REFERENCES bill_clusters(id);

ALTER TABLE bill_clusters
  ADD CONSTRAINT fk_bill_clusters_primary_bill
  FOREIGN KEY (primary_bill_id) REFERENCES bills(id);

-- ──────────────────────────────────────
-- Indexes for performance
-- ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bill_clusters_category ON bill_clusters(category);
CREATE INDEX IF NOT EXISTS idx_bill_clusters_latest_knesset ON bill_clusters(latest_knesset_num);
CREATE INDEX IF NOT EXISTS idx_bill_clusters_ai_processed ON bill_clusters(ai_processed) WHERE ai_processed = FALSE;
CREATE INDEX IF NOT EXISTS idx_bill_cluster_members_cluster ON bill_cluster_members(cluster_id);
CREATE INDEX IF NOT EXISTS idx_bill_cluster_members_bill ON bill_cluster_members(bill_id);
CREATE INDEX IF NOT EXISTS idx_bills_cluster_id ON bills(cluster_id);
CREATE INDEX IF NOT EXISTS idx_votes_bill_stage ON votes(bill_stage) WHERE bill_stage IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_votes_bill_id ON votes(bill_id) WHERE bill_id IS NOT NULL;

-- pg_trgm index for name similarity search
CREATE INDEX IF NOT EXISTS idx_bills_name_trgm ON bills USING gin (name gin_trgm_ops);
