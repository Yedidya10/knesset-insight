CREATE TABLE IF NOT EXISTS "admin_activity_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "details" jsonb,
  "admin_identifier" text DEFAULT 'admin' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);
