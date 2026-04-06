-- Create faction_coalition_periods table for temporal coalition/opposition tracking
CREATE TABLE IF NOT EXISTS "faction_coalition_periods" (
  "id" serial PRIMARY KEY,
  "faction_id" integer NOT NULL REFERENCES "factions"("id") ON DELETE CASCADE,
  "knesset_num" integer NOT NULL,
  "government_num" integer NOT NULL,
  "start_date" date,
  "end_date" date,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  UNIQUE ("faction_id", "knesset_num", "government_num")
);

-- Add index for efficient knesset-based lookups
CREATE INDEX IF NOT EXISTS "idx_fcp_knesset_num" ON "faction_coalition_periods" ("knesset_num");
