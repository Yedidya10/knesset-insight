CREATE TABLE IF NOT EXISTS "member_presence" (
  "id" serial PRIMARY KEY NOT NULL,
  "member_id" integer NOT NULL REFERENCES "members"("id"),
  "date" date NOT NULL,
  "total_attended_hours" integer NOT NULL,
  CONSTRAINT "member_presence_member_id_date_unique" UNIQUE("member_id", "date")
);
