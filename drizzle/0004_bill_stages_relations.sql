-- Add new columns to bills table
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "sub_type_id" integer;
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "is_continuation_bill" boolean;
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "committee_id" integer;

-- Create bill_unions table
CREATE TABLE IF NOT EXISTS "bill_unions" (
  "id" serial PRIMARY KEY,
  "knesset_id" integer NOT NULL UNIQUE,
  "main_bill_id" integer NOT NULL REFERENCES "bills"("id"),
  "union_bill_id" integer NOT NULL REFERENCES "bills"("id"),
  "last_updated" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_bill_unions_main_union" ON "bill_unions"("main_bill_id", "union_bill_id");

-- Create bill_splits table
CREATE TABLE IF NOT EXISTS "bill_splits" (
  "id" serial PRIMARY KEY,
  "knesset_id" integer NOT NULL UNIQUE,
  "main_bill_id" integer NOT NULL REFERENCES "bills"("id"),
  "split_bill_id" integer NOT NULL REFERENCES "bills"("id"),
  "name" text,
  "last_updated" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_bill_splits_main_split" ON "bill_splits"("main_bill_id", "split_bill_id");

-- Create bill_names table
CREATE TABLE IF NOT EXISTS "bill_names" (
  "id" serial PRIMARY KEY,
  "knesset_id" integer NOT NULL UNIQUE,
  "bill_id" integer NOT NULL REFERENCES "bills"("id"),
  "name" text NOT NULL,
  "name_history_type_id" integer,
  "name_history_type_desc" text,
  "last_updated" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now()
);
