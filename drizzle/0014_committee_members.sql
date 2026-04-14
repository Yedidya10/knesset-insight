CREATE TABLE IF NOT EXISTS "committee_members" (
  "id" serial PRIMARY KEY NOT NULL,
  "committee_id" integer NOT NULL REFERENCES "committees"("id"),
  "member_id" integer NOT NULL REFERENCES "members"("id"),
  "position_id" integer,
  "duty_desc" text,
  "knesset_num" integer,
  "is_current" boolean DEFAULT true,
  "start_date" timestamp with time zone,
  "finish_date" timestamp with time zone,
  "knesset_position_id" integer UNIQUE,
  "attended_meetings" integer,
  "protocol_meetings" integer,
  "attendance_percent" real,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "committee_members_committee_id_member_id_knesset_num_unique" UNIQUE("committee_id","member_id","knesset_num")
);

CREATE INDEX IF NOT EXISTS "idx_committee_members_committee" ON "committee_members" ("committee_id");
CREATE INDEX IF NOT EXISTS "idx_committee_members_member" ON "committee_members" ("member_id");
CREATE INDEX IF NOT EXISTS "idx_committee_members_current" ON "committee_members" ("is_current") WHERE "is_current" = true;
