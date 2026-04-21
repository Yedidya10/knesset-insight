import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('../../lib/db/index');
  const { integrityCases } = await import('../../lib/db/schema');
  const { like } = await import('drizzle-orm');
  const rows = await db
    .select({
      id: integrityCases.id,
      memberId: integrityCases.memberId,
      category: integrityCases.category,
      status: integrityCases.status,
      sourceUrl: integrityCases.sourceUrl,
      sourceType: integrityCases.sourceType,
      title: integrityCases.title,
    })
    .from(integrityCases)
    .where(like(integrityCases.sourceUrl, '%5559962%'));
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}
main();
