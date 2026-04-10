-- Bill Documents (synced from KNS_DocumentBill OData v4)
CREATE TABLE IF NOT EXISTS "bill_documents" (
  "id" serial PRIMARY KEY NOT NULL,
  "knesset_doc_id" integer UNIQUE NOT NULL,
  "bill_id" integer REFERENCES "bills"("id"),
  "knesset_bill_id" integer NOT NULL,
  "group_type_id" integer NOT NULL,
  "group_type_desc" text NOT NULL,
  "application_desc" text NOT NULL,
  "file_path" text NOT NULL,
  "last_updated" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_bill_documents_bill_id" ON "bill_documents" ("bill_id");
CREATE INDEX IF NOT EXISTS "idx_bill_documents_type" ON "bill_documents" ("group_type_id");

-- Bill Stage Summaries (per-stage AI summaries history)
CREATE TABLE IF NOT EXISTS "bill_stage_summaries" (
  "id" serial PRIMARY KEY NOT NULL,
  "bill_id" integer NOT NULL REFERENCES "bills"("id"),
  "stage" integer NOT NULL,
  "summary" jsonb NOT NULL,
  "topics" jsonb,
  "source_doc_type" integer,
  "source_doc_id" integer REFERENCES "bill_documents"("id"),
  "generated_at" timestamp with time zone DEFAULT now(),
  UNIQUE("bill_id", "stage")
);

CREATE INDEX IF NOT EXISTS "idx_bill_stage_summaries_bill" ON "bill_stage_summaries" ("bill_id");
