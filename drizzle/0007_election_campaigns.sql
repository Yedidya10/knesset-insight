-- Election Campaigns (2026+)
CREATE TABLE IF NOT EXISTS "election_campaigns" (
  "id" serial PRIMARY KEY,
  "knesset_num" integer NOT NULL UNIQUE,
  "election_date" date,
  "status" text NOT NULL DEFAULT 'pre_campaign',
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "election_candidate_lists" (
  "id" serial PRIMARY KEY,
  "campaign_id" integer NOT NULL REFERENCES "election_campaigns"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "short_name" text,
  "slug" text NOT NULL UNIQUE,
  "ballot_letters" text,
  "political_group_id" integer REFERENCES "political_groups"("id"),
  "leader_name" text,
  "leader_member_id" integer REFERENCES "members"("id"),
  "status" text NOT NULL DEFAULT 'potential',
  "color" text,
  "logo_url" text,
  "platform_summary" text,
  "platform_url" text,
  "estimated_seats" integer,
  "political_position" text,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "election_candidates" (
  "id" serial PRIMARY KEY,
  "candidate_list_id" integer NOT NULL REFERENCES "election_candidate_lists"("id") ON DELETE CASCADE,
  "member_id" integer REFERENCES "members"("id"),
  "slug" text NOT NULL UNIQUE,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "position" integer,
  "status" text NOT NULL DEFAULT 'potential',
  "is_leader" boolean DEFAULT false,
  "bio" text,
  "image_url" text,
  "birth_year" integer,
  "residence" text,
  "profession" text,
  "education" text,
  "civic_activity" text,
  "public_statements" text,
  "platform_url" text,
  "integrity_notes" text,
  "financial_disclosure" text,
  "conflicts_of_interest" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "election_polls" (
  "id" serial PRIMARY KEY,
  "campaign_id" integer NOT NULL REFERENCES "election_campaigns"("id") ON DELETE CASCADE,
  "pollster_name" text NOT NULL,
  "publish_date" date NOT NULL,
  "sample_size" integer,
  "margin_of_error" numeric(3, 1),
  "source_url" text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "election_poll_results" (
  "id" serial PRIMARY KEY,
  "poll_id" integer NOT NULL REFERENCES "election_polls"("id") ON DELETE CASCADE,
  "candidate_list_id" integer NOT NULL REFERENCES "election_candidate_lists"("id") ON DELETE CASCADE,
  "predicted_seats" integer NOT NULL,
  UNIQUE("poll_id", "candidate_list_id")
);

CREATE TABLE IF NOT EXISTS "election_timeline_events" (
  "id" serial PRIMARY KEY,
  "campaign_id" integer NOT NULL REFERENCES "election_campaigns"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text,
  "event_date" date NOT NULL,
  "type" text NOT NULL,
  "is_completed" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now()
);
