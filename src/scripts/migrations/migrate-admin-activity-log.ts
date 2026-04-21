import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('../../lib/db');
  const { sql } = await import('drizzle-orm');

  console.log('Applying migration: create admin_activity_log table...');

  await db.execute(
    sql.raw(`
    CREATE TABLE IF NOT EXISTS "admin_activity_log" (
      "id" serial PRIMARY KEY NOT NULL,
      "action" text NOT NULL,
      "entity_type" text NOT NULL,
      "entity_id" text NOT NULL,
      "details" jsonb,
      "admin_identifier" text DEFAULT 'admin' NOT NULL,
      "created_at" timestamp with time zone DEFAULT now()
    );
  `),
  );

  console.log('  Created admin_activity_log table');
  console.log('Migration applied successfully');
  process.exit(0);
}

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
