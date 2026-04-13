CREATE TABLE IF NOT EXISTS "bill_history_initiators" (
	"id" serial PRIMARY KEY NOT NULL,
	"knesset_id" integer NOT NULL,
	"bill_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"is_initiator" boolean DEFAULT false,
	"start_date" date,
	"end_date" date,
	"reason_id" integer,
	"reason_desc" text,
	CONSTRAINT "bill_history_initiators_knesset_id_unique" UNIQUE("knesset_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bill_history_initiators" ADD CONSTRAINT "bill_history_initiators_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bill_history_initiators" ADD CONSTRAINT "bill_history_initiators_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
