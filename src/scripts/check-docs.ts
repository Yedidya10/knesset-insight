import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('../lib/db');
  const { billDocuments } = await import('../lib/db/schema');
  const { count, sql } = await import('drizzle-orm');

  const [r] = await db.select({ c: count() }).from(billDocuments);
  console.log('Total bill_documents:', r.c);

  // Fix double prefix if present
  await db.execute(sql`
    UPDATE bill_documents 
    SET file_path = REPLACE(file_path, 'https://fs.knesset.gov.il/https://fs.knesset.gov.il/', 'https://fs.knesset.gov.il/')
    WHERE file_path LIKE 'https://fs.knesset.gov.il/https://fs.knesset.gov.il/%'
  `);
  console.log('Fixed double prefixes');

  // Fix backslash paths from OData v4
  await db.execute(
    sql.raw(
      `UPDATE bill_documents SET file_path = REPLACE(file_path, E'\\\\', '/') WHERE file_path LIKE E'%\\\\%'`,
    ),
  );
  console.log('Fixed backslash paths');

  const samples = await db
    .select({ path: billDocuments.filePath, type: billDocuments.groupTypeId })
    .from(billDocuments)
    .limit(5);
  console.log('Sample paths:');
  samples.forEach((s) => console.log(' ', s.type, s.path));

  process.exit(0);
}
main();
