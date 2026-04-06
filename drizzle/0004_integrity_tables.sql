-- Migration: Add integrity & ethics tables
-- Tracks ethics complaints, criminal cases, corporate affiliations, and lobbyist connections

-- ──────────────────────────────────────
-- 1. Integrity Cases (core events)
-- ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS "integrity_cases" (
  "id" serial PRIMARY KEY NOT NULL,
  "member_id" integer NOT NULL REFERENCES "members"("id"),
  "category" text NOT NULL,
  "severity" text NOT NULL DEFAULT 'info',
  "status" text NOT NULL DEFAULT 'reported',
  "title" text NOT NULL,
  "title_en" text,
  "description" text,
  "description_en" text,
  "source_type" text NOT NULL,
  "source_name" text NOT NULL,
  "source_url" text,
  "source_doc_id" text,
  "event_date" date NOT NULL,
  "reported_date" date,
  "resolution_date" date,
  "decision" text,
  "sanction_type" text,
  "financial_amount" numeric,
  "metadata" jsonb,
  "ai_summary" text,
  "ai_confidence" real,
  "verified" boolean DEFAULT false,
  "verified_by" text,
  "verified_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

-- ──────────────────────────────────────
-- 2. Integrity Case Links (relationships between cases)
-- ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS "integrity_case_links" (
  "id" serial PRIMARY KEY NOT NULL,
  "case_id" integer NOT NULL REFERENCES "integrity_cases"("id") ON DELETE CASCADE,
  "related_case_id" integer NOT NULL REFERENCES "integrity_cases"("id") ON DELETE CASCADE,
  "link_type" text NOT NULL,
  UNIQUE("case_id", "related_case_id")
);

-- ──────────────────────────────────────
-- 3. Integrity Documents (attached source docs)
-- ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS "integrity_documents" (
  "id" serial PRIMARY KEY NOT NULL,
  "case_id" integer NOT NULL REFERENCES "integrity_cases"("id") ON DELETE CASCADE,
  "doc_type" text NOT NULL,
  "title" text NOT NULL,
  "url" text,
  "file_path" text,
  "published_at" date,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now()
);

-- ──────────────────────────────────────
-- 4. Member Corporate Affiliations
-- ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS "member_corporate_affiliations" (
  "id" serial PRIMARY KEY NOT NULL,
  "member_id" integer NOT NULL REFERENCES "members"("id"),
  "company_number" text NOT NULL,
  "company_name" text NOT NULL,
  "role" text NOT NULL,
  "status" text DEFAULT 'active',
  "start_date" date,
  "end_date" date,
  "source_url" text,
  "potential_conflict" boolean DEFAULT false,
  "conflict_description" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  UNIQUE("member_id", "company_number", "role")
);

-- ──────────────────────────────────────
-- 5. Member Lobbyist Connections
-- ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS "member_lobbyist_connections" (
  "id" serial PRIMARY KEY NOT NULL,
  "member_id" integer NOT NULL REFERENCES "members"("id"),
  "lobbyist_name" text NOT NULL,
  "lobbyist_number" text,
  "client_name" text,
  "connection_type" text NOT NULL,
  "event_date" date,
  "source_url" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  UNIQUE("member_id", "lobbyist_name", "event_date")
);

-- ──────────────────────────────────────
-- 6. Indexes for performance
-- ──────────────────────────────────────

CREATE INDEX IF NOT EXISTS "idx_integrity_cases_member" ON "integrity_cases"("member_id");
CREATE INDEX IF NOT EXISTS "idx_integrity_cases_category" ON "integrity_cases"("category");
CREATE INDEX IF NOT EXISTS "idx_integrity_cases_status" ON "integrity_cases"("status");
CREATE INDEX IF NOT EXISTS "idx_integrity_cases_event_date" ON "integrity_cases"("event_date");
CREATE INDEX IF NOT EXISTS "idx_integrity_docs_case" ON "integrity_documents"("case_id");
CREATE INDEX IF NOT EXISTS "idx_corporate_aff_member" ON "member_corporate_affiliations"("member_id");
CREATE INDEX IF NOT EXISTS "idx_lobbyist_conn_member" ON "member_lobbyist_connections"("member_id");
