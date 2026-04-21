import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const postgres = (await import('postgres')).default;
  const client = postgres(process.env.DATABASE_URL!, {
    prepare: false,
    max: 1,
  });

  const expected = [
    'votes_title_trgm_idx',
    'votes_vote_date_idx',
    'member_votes_vote_member_idx',
    'member_votes_member_vote_idx',
    'bills_name_trgm_idx',
    'bills_knesset_type_status_idx',
    'bills_proposed_date_idx',
    'bill_initiators_member_bill_idx',
    'members_knesset_current_idx',
    'member_faction_history_member_knesset_idx',
    'committees_name_trgm_idx',
    'committee_members_committee_position_idx',
  ];

  const rows =
    await client`SELECT indexname FROM pg_indexes WHERE indexname = ANY(${expected})`;
  const found = new Set(rows.map((r) => r.indexname));

  console.log('── Index presence ──');
  for (const name of expected) {
    console.log(`  ${found.has(name) ? '✓' : '✗'} ${name}`);
  }
  const missing = expected.filter((n) => !found.has(n));

  console.log('\n── Committees filter smoke queries ──');

  const typeCount = await client`
    SELECT count(distinct committee_type) AS c FROM committees
    WHERE knesset_num IN (22,23,24,25) AND committee_type IS NOT NULL
  `;
  console.log(`  distinct committee types (k22-25): ${typeCount[0].c}`);

  const chairCount = await client`
    SELECT count(distinct c.chairman_id) AS c
    FROM committees c
    WHERE c.knesset_num IN (22,23,24,25) AND c.chairman_id IS NOT NULL
  `;
  console.log(`  distinct chairmen: ${chairCount[0].c}`);

  const committeeCount = await client`
    SELECT count(*) AS c FROM committees WHERE knesset_num IN (22,23,24,25)
  `;
  console.log(`  committees in-scope: ${committeeCount[0].c}`);

  const activeCount = await client`
    SELECT count(*) AS c FROM committees
    WHERE knesset_num IN (22,23,24,25) AND is_active = true
  `;
  console.log(`  active committees: ${activeCount[0].c}`);

  console.log('\n── Trigram search test (ilike on committees.name) ──');
  const trigramTest = await client`
    EXPLAIN (FORMAT JSON) SELECT id, name FROM committees
    WHERE name ILIKE '%חינוך%' LIMIT 10
  `;
  // drizzle postgres returns as string[] of plan lines
  console.log(JSON.stringify(trigramTest[0], null, 2).slice(0, 500));

  await client.end();

  if (missing.length > 0) {
    console.error(`\n✗ ${missing.length} index(es) missing`);
    process.exit(1);
  }
  console.log('\n✓ all indexes present');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
