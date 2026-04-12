import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('../lib/db/index.ts');
  const { bills, billSplits, billUnions } = await import('../lib/db/schema.ts');
  const { eq, sql, inArray } = await import('drizzle-orm');

  // Count total splits and unions
  const [splitCount] = await db.select({ c: sql`count(*)` }).from(billSplits);
  const [unionCount] = await db.select({ c: sql`count(*)` }).from(billUnions);
  console.log('Total splits:', splitCount.c, 'Total unions:', unionCount.c);

  // Get bill 27 details (the parent budget bill)
  const [b27] = await db
    .select({
      id: bills.id,
      name: bills.name,
      status: bills.status,
      subTypeId: bills.subTypeId,
    })
    .from(bills)
    .where(eq(bills.id, 27));
  console.log('\nBill 27:', JSON.stringify(b27));

  // All splits FROM bill 27
  const splits27 = await db
    .select()
    .from(billSplits)
    .where(eq(billSplits.mainBillId, 27));
  console.log('\nSplits FROM 27:', splits27.length);
  splits27.forEach((s) =>
    console.log('  splitBillId:', s.splitBillId, 'date:', s.lastUpdated),
  );

  // All unions INTO bill 27
  const unions27 = await db
    .select()
    .from(billUnions)
    .where(eq(billUnions.mainBillId, 27));
  console.log('\nUnions INTO 27:', unions27.length);
  unions27.forEach((u) =>
    console.log('  unionBillId:', u.unionBillId, 'date:', u.lastUpdated),
  );

  // Check bill 56
  const [b56] = await db
    .select({ id: bills.id, name: bills.name, status: bills.status })
    .from(bills)
    .where(eq(bills.id, 56));
  console.log('\nBill 56:', JSON.stringify(b56));

  // Bill 56 relationships
  const split56 = await db
    .select()
    .from(billSplits)
    .where(eq(billSplits.splitBillId, 56));
  console.log(
    'Bill 56 split FROM:',
    split56.map((s) => ({ mainBillId: s.mainBillId, date: s.lastUpdated })),
  );

  const union56 = await db
    .select()
    .from(billUnions)
    .where(eq(billUnions.unionBillId, 56));
  console.log(
    'Bill 56 union INTO:',
    union56.map((u) => ({ mainBillId: u.mainBillId, date: u.lastUpdated })),
  );

  // Get all split children statuses
  const splitBillIds = splits27.map((s) => s.splitBillId);
  if (splitBillIds.length > 0) {
    const childBills = await db
      .select({ id: bills.id, name: bills.name, status: bills.status })
      .from(bills)
      .where(inArray(bills.id, splitBillIds));
    console.log('\nChild bills of 27:');
    childBills.forEach((b) =>
      console.log(
        '  id:',
        b.id,
        'status:',
        b.status,
        'name:',
        b.name?.substring(0, 80),
      ),
    );
  }

  // Look at a broader sample: find bills that are BOTH split AND merged
  const bothSplitAndMerged = await db.execute(sql`
    SELECT bs.split_bill_id, 
           bs.main_bill_id as split_from,
           bs.last_updated as split_date,
           bu.main_bill_id as merged_into,
           bu.last_updated as merge_date
    FROM bill_splits bs
    INNER JOIN bill_unions bu ON bu.union_bill_id = bs.split_bill_id
    LIMIT 20
  `);
  console.log('\nBills that are BOTH split from AND merged into:');
  for (const row of bothSplitAndMerged) {
    console.log(
      `  Bill ${row.split_bill_id}: split from ${row.split_from} (${row.split_date}) -> merged into ${row.merged_into} (${row.merge_date})`,
    );
  }

  // Check if split_from and merged_into are typically the SAME parent bill
  const sameParent = await db.execute(sql`
    SELECT COUNT(*) as same_parent_count
    FROM bill_splits bs
    INNER JOIN bill_unions bu ON bu.union_bill_id = bs.split_bill_id
    WHERE bs.main_bill_id = bu.main_bill_id
  `);
  console.log('\nSame parent (split from = merged into):', sameParent[0]);

  const diffParent = await db.execute(sql`
    SELECT COUNT(*) as diff_parent_count
    FROM bill_splits bs
    INNER JOIN bill_unions bu ON bu.union_bill_id = bs.split_bill_id
    WHERE bs.main_bill_id != bu.main_bill_id
  `);
  console.log('Different parent:', diffParent[0]);

  // What bill statuses have splits?
  const statusesWithSplits = await db.execute(sql`
    SELECT b.status, COUNT(*) as cnt
    FROM bills b 
    INNER JOIN bill_splits bs ON bs.split_bill_id = b.id
    GROUP BY b.status
    ORDER BY cnt DESC
  `);
  console.log('\nStatuses of split child bills:');
  for (const row of statusesWithSplits) {
    console.log(`  status ${row.status}: ${row.cnt} bills`);
  }

  // What bill statuses are the parents of splits?
  const parentStatuses = await db.execute(sql`
    SELECT b.status, COUNT(*) as cnt
    FROM bills b 
    INNER JOIN bill_splits bs ON bs.main_bill_id = b.id
    GROUP BY b.status
    ORDER BY cnt DESC
  `);
  console.log('\nStatuses of split PARENT bills:');
  for (const row of parentStatuses) {
    console.log(`  status ${row.status}: ${row.cnt} bills`);
  }

  process.exit(0);
}

main();
