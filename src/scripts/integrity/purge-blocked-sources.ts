/**
 * One-off cleanup — delete integrity_cases rows whose source is in the
 * URL blocklist (currently: the Knesset Research Dept. immunity PDF,
 * 25_ls_bk_5559962, which only cites MKs in footnote examples and is
 * not a primary integrity source).
 *
 * Kept in sync with BLOCKED_SOURCE_URL_PATTERNS in insert-integrity-events.ts.
 *
 * Run with:  pnpm tsx src/scripts/integrity/purge-blocked-sources.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

const BLOCKED_URL_PATTERNS = ['5559962'];

async function main() {
  const { db } = await import('../../lib/db/index');
  const { integrityCases } = await import('../../lib/db/schema');
  const { like, or } = await import('drizzle-orm');

  const clauses = BLOCKED_URL_PATTERNS.map((p) =>
    like(integrityCases.sourceUrl, `%${p}%`),
  );
  const whereClause = clauses.length === 1 ? clauses[0] : or(...clauses);

  const rows = await db
    .select({
      id: integrityCases.id,
      memberId: integrityCases.memberId,
      category: integrityCases.category,
      sourceUrl: integrityCases.sourceUrl,
    })
    .from(integrityCases)
    .where(whereClause);

  console.log(`Found ${rows.length} rows matching blocked URL patterns:`);
  for (const r of rows) {
    console.log(
      `  id=${r.id}  member=${r.memberId}  category=${r.category}  url=${r.sourceUrl}`,
    );
  }

  if (rows.length === 0) {
    console.log('Nothing to purge.');
    process.exit(0);
  }

  const deleted = await db.delete(integrityCases).where(whereClause).returning({
    id: integrityCases.id,
  });

  console.log(`\nDeleted ${deleted.length} rows.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
