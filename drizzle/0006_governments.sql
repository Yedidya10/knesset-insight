-- Government ministries lookup table
CREATE TABLE IF NOT EXISTS "gov_ministries" (
  "id" serial PRIMARY KEY NOT NULL,
  "knesset_id" integer NOT NULL UNIQUE,
  "name" text NOT NULL,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

-- Governments table
CREATE TABLE IF NOT EXISTS "governments" (
  "id" serial PRIMARY KEY NOT NULL,
  "government_num" integer NOT NULL UNIQUE,
  "knesset_num" integer NOT NULL,
  "name" text NOT NULL,
  "start_date" date,
  "end_date" date,
  "pm_member_id" integer REFERENCES "members"("id"),
  "alternate_pm_member_id" integer REFERENCES "members"("id"),
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

-- Government positions (ministers, deputy ministers, PM, etc.)
CREATE TABLE IF NOT EXISTS "government_positions" (
  "id" serial PRIMARY KEY NOT NULL,
  "government_id" integer NOT NULL REFERENCES "governments"("id") ON DELETE CASCADE,
  "member_id" integer REFERENCES "members"("id"),
  "member_knesset_id" integer NOT NULL,
  "position_id" integer NOT NULL,
  "position_desc" text,
  "gov_ministry_id" integer REFERENCES "gov_ministries"("id"),
  "faction_knesset_id" integer,
  "start_date" date,
  "end_date" date,
  "is_current" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  UNIQUE("government_id", "member_knesset_id", "position_id", "gov_ministry_id", "start_date")
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS "idx_gov_positions_government" ON "government_positions" ("government_id");
CREATE INDEX IF NOT EXISTS "idx_gov_positions_member" ON "government_positions" ("member_id");
CREATE INDEX IF NOT EXISTS "idx_governments_knesset_num" ON "governments" ("knesset_num");
