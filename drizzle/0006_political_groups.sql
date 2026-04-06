-- Political Groups: canonical cross-term political identities
CREATE TABLE IF NOT EXISTS "political_groups" (
  "id" serial PRIMARY KEY NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "canonical_name" text NOT NULL,
  "short_name" text,
  "color" text,
  "logo_url" text,
  "founded_year" integer,
  "dissolved_year" integer,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

-- Political Group Lineage: mergers, splits, renames between groups
CREATE TABLE IF NOT EXISTS "political_group_lineage" (
  "id" serial PRIMARY KEY NOT NULL,
  "source_group_id" integer NOT NULL REFERENCES "political_groups"("id") ON DELETE CASCADE,
  "target_group_id" integer NOT NULL REFERENCES "political_groups"("id") ON DELETE CASCADE,
  "relationship_type" text NOT NULL,
  "knesset_num" integer,
  "year" integer,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "political_group_lineage_source_target_type_unique" UNIQUE("source_group_id", "target_group_id", "relationship_type")
);

-- Add political_group_id FK to factions
ALTER TABLE "factions" ADD COLUMN IF NOT EXISTS "political_group_id" integer REFERENCES "political_groups"("id");

-- Faction Composition History: which parties make up which faction per knesset
CREATE TABLE IF NOT EXISTS "faction_composition_history" (
  "id" serial PRIMARY KEY NOT NULL,
  "faction_id" integer NOT NULL REFERENCES "factions"("id") ON DELETE CASCADE,
  "party_id" integer NOT NULL REFERENCES "political_parties"("id") ON DELETE CASCADE,
  "knesset_num" integer NOT NULL,
  "role" text NOT NULL DEFAULT 'partner',
  "join_date" date,
  "leave_date" date,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "faction_composition_history_faction_party_knesset_unique" UNIQUE("faction_id", "party_id", "knesset_num")
);
