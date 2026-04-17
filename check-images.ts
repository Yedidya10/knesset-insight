import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('./src/lib/db');
  const { sql } = await import('drizzle-orm');

  // Check distinct image URL patterns
  const rows = await db.execute(sql`
    SELECT DISTINCT LEFT(image_url, 80) as url_prefix, image_source, COUNT(*) as cnt
    FROM members
    WHERE image_url IS NOT NULL
    GROUP BY LEFT(image_url, 80), image_source
    ORDER BY cnt DESC
    LIMIT 30
  `);
  console.table(rows);

  // Check a few actual full URLs for wikidata images
  const wikiSample = await db.execute(sql`
    SELECT first_name, last_name, knesset_id, image_url, image_source
    FROM members
    WHERE image_source = 'wikidata'
    LIMIT 5
  `);
  console.log('\n=== Wikidata samples ===');
  console.table(wikiSample);

  // Check oknesset images
  const okSample = await db.execute(sql`
    SELECT first_name, last_name, knesset_id, image_url, image_source
    FROM members
    WHERE image_source = 'oknesset' OR image_source IS NULL
    LIMIT 5
  `);
  console.log('\n=== Oknesset/null samples ===');
  console.table(okSample);

  // Count by source
  const counts = await db.execute(sql`
    SELECT image_source, COUNT(*) as cnt
    FROM members
    WHERE image_url IS NOT NULL
    GROUP BY image_source
    ORDER BY cnt DESC
  `);
  console.log('\n=== Counts by source ===');
  console.table(counts);

  // Check how many already local
  const local = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM members WHERE image_url LIKE '/images/%'
  `);
  console.log('\nAlready local:', local[0]);

  process.exit(0);
}
main();
