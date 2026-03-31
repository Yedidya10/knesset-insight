CREATE TABLE "bill_initiators" (
	"id" serial PRIMARY KEY NOT NULL,
	"bill_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"is_primary" boolean DEFAULT false,
	CONSTRAINT "bill_initiators_bill_id_member_id_unique" UNIQUE("bill_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" serial PRIMARY KEY NOT NULL,
	"knesset_id" integer NOT NULL,
	"name" text NOT NULL,
	"summary" text,
	"status" text,
	"bill_type" text,
	"knesset_num" integer,
	"proposed_date" date,
	"last_update" timestamp with time zone,
	"category" text,
	"full_text_url" text,
	"ai_summary" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "bills_knesset_id_unique" UNIQUE("knesset_id")
);
--> statement-breakpoint
CREATE TABLE "budget_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_code" text NOT NULL,
	"year" integer NOT NULL,
	"title" text NOT NULL,
	"amount_allocated" bigint,
	"amount_used" bigint,
	"parent_code" text,
	"depth" integer,
	"ministry" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "budget_items_budget_code_year_unique" UNIQUE("budget_code","year")
);
--> statement-breakpoint
CREATE TABLE "committee_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"knesset_id" integer NOT NULL,
	"committee_id" integer NOT NULL,
	"session_date" timestamp with time zone,
	"title" text,
	"protocol_url" text,
	"topics" text[],
	"ai_summary" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "committee_sessions_knesset_id_unique" UNIQUE("knesset_id")
);
--> statement-breakpoint
CREATE TABLE "committees" (
	"id" serial PRIMARY KEY NOT NULL,
	"knesset_id" integer NOT NULL,
	"name" text NOT NULL,
	"committee_type" text,
	"knesset_num" integer,
	"is_active" boolean DEFAULT true,
	"chairman_id" integer,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "committees_knesset_id_unique" UNIQUE("knesset_id")
);
--> statement-breakpoint
CREATE TABLE "member_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"vote_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"vote_value" text NOT NULL,
	CONSTRAINT "member_votes_vote_id_member_id_unique" UNIQUE("vote_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" serial PRIMARY KEY NOT NULL,
	"knesset_id" integer NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"party_id" integer,
	"is_current" boolean DEFAULT false,
	"gender" text,
	"birth_date" date,
	"image_url" text,
	"email" text,
	"phone" text,
	"start_date" date,
	"end_date" date,
	"knesset_num" integer,
	"is_coalition" boolean,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "members_knesset_id_unique" UNIQUE("knesset_id")
);
--> statement-breakpoint
CREATE TABLE "parties" (
	"id" serial PRIMARY KEY NOT NULL,
	"knesset_id" integer NOT NULL,
	"name" text NOT NULL,
	"knesset_num" integer,
	"is_coalition" boolean DEFAULT false,
	"seats" integer,
	"color" text,
	"logo_url" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "parties_knesset_id_unique" UNIQUE("knesset_id")
);
--> statement-breakpoint
CREATE TABLE "sync_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity" text NOT NULL,
	"last_sync_at" timestamp with time zone NOT NULL,
	"record_count" integer,
	"status" text NOT NULL,
	"error_message" text,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "sync_log_entity_unique" UNIQUE("entity")
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"knesset_id" integer NOT NULL,
	"title" text NOT NULL,
	"vote_date" timestamp with time zone NOT NULL,
	"vote_type" text,
	"knesset_num" integer,
	"session_id" integer,
	"sess_item_id" integer,
	"bill_id" integer,
	"for_count" integer DEFAULT 0,
	"against_count" integer DEFAULT 0,
	"abstain_count" integer DEFAULT 0,
	"is_accepted" boolean,
	"summary" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "votes_knesset_id_unique" UNIQUE("knesset_id")
);
--> statement-breakpoint
ALTER TABLE "bill_initiators" ADD CONSTRAINT "bill_initiators_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_initiators" ADD CONSTRAINT "bill_initiators_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_sessions" ADD CONSTRAINT "committee_sessions_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committees" ADD CONSTRAINT "committees_chairman_id_members_id_fk" FOREIGN KEY ("chairman_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_votes" ADD CONSTRAINT "member_votes_vote_id_votes_id_fk" FOREIGN KEY ("vote_id") REFERENCES "public"."votes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_votes" ADD CONSTRAINT "member_votes_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;