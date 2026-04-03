-- Migration: Rename parties → factions + add political entity tables
-- Run this against your Supabase DB before deploying the new code.

-- ──────────────────────────────────────
-- 1. Rename parties table → factions
-- ──────────────────────────────────────
ALTER TABLE "parties" RENAME TO "factions";

-- Add new columns to factions
ALTER TABLE "factions" ADD COLUMN IF NOT EXISTS "start_date" date;
ALTER TABLE "factions" ADD COLUMN IF NOT EXISTS "finish_date" date;
ALTER TABLE "factions" ADD COLUMN IF NOT EXISTS "is_current" boolean DEFAULT false;
ALTER TABLE "factions" ADD COLUMN IF NOT EXISTS "electoral_list_id" integer;

-- ──────────────────────────────────────
-- 2. Rename members.party_id → faction_id
-- ──────────────────────────────────────
ALTER TABLE "members" RENAME COLUMN "party_id" TO "faction_id";

-- ──────────────────────────────────────
-- 3. Create new tables
-- ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS "political_parties" (
  "id" serial PRIMARY KEY NOT NULL,
  "registrar_number" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "name_en" text,
  "type" text NOT NULL DEFAULT 'party',
  "registration_year" integer,
  "phone" text,
  "fax" text,
  "email" text,
  "address" text,
  "goals" text,
  "logo_url" text,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "electoral_lists" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "ballot_letters" text NOT NULL,
  "knesset_num" integer NOT NULL,
  "total_votes" integer,
  "vote_percentage" numeric(5,2),
  "seats" integer NOT NULL DEFAULT 0,
  "is_elected" boolean NOT NULL DEFAULT false,
  "election_date" date,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "electoral_lists_ballot_letters_knesset_num_unique" UNIQUE("ballot_letters", "knesset_num")
);

-- Now add the FK from factions to electoral_lists
ALTER TABLE "factions"
  ADD CONSTRAINT "factions_electoral_list_id_electoral_lists_id_fk"
  FOREIGN KEY ("electoral_list_id") REFERENCES "electoral_lists"("id");

CREATE TABLE IF NOT EXISTS "party_financial_reports" (
  "id" serial PRIMARY KEY NOT NULL,
  "party_id" integer NOT NULL REFERENCES "political_parties"("id") ON DELETE CASCADE,
  "year" integer NOT NULL,
  "report_type" text NOT NULL,
  "pdf_url" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "party_financial_reports_party_id_year_report_type_unique" UNIQUE("party_id", "year", "report_type")
);

CREATE TABLE IF NOT EXISTS "electoral_list_parties" (
  "id" serial PRIMARY KEY NOT NULL,
  "electoral_list_id" integer NOT NULL REFERENCES "electoral_lists"("id") ON DELETE CASCADE,
  "party_id" integer NOT NULL REFERENCES "political_parties"("id") ON DELETE CASCADE,
  CONSTRAINT "electoral_list_parties_electoral_list_id_party_id_unique" UNIQUE("electoral_list_id", "party_id")
);

CREATE TABLE IF NOT EXISTS "party_faction_links" (
  "id" serial PRIMARY KEY NOT NULL,
  "party_id" integer NOT NULL REFERENCES "political_parties"("id") ON DELETE CASCADE,
  "faction_id" integer NOT NULL REFERENCES "factions"("id") ON DELETE CASCADE,
  CONSTRAINT "party_faction_links_party_id_faction_id_unique" UNIQUE("party_id", "faction_id")
);

CREATE TABLE IF NOT EXISTS "member_faction_history" (
  "id" serial PRIMARY KEY NOT NULL,
  "member_id" integer NOT NULL REFERENCES "members"("id") ON DELETE CASCADE,
  "faction_id" integer NOT NULL REFERENCES "factions"("id") ON DELETE CASCADE,
  "knesset_num" integer NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date,
  CONSTRAINT "member_faction_history_member_id_faction_id_start_date_unique" UNIQUE("member_id", "faction_id", "start_date")
);

-- ──────────────────────────────────────
-- 4. Update sync_log entity names
-- ──────────────────────────────────────
UPDATE "sync_log" SET "entity" = 'factions' WHERE "entity" = 'parties';
