import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('../lib/db');
  const { electionCityResults } = await import('../lib/db/schema');
  const { eq, isNull, and, sql } = await import('drizzle-orm');

  // Rows with NULL districtCode
  const nullRows = await db
    .select({
      cityCode: electionCityResults.cityCode,
      cityName: electionCityResults.cityName,
      eligible: electionCityResults.eligibleVoters,
      actual: electionCityResults.actualVoters,
    })
    .from(electionCityResults)
    .where(
      and(
        eq(electionCityResults.knessetNum, 25),
        isNull(electionCityResults.districtCode),
      ),
    );

  console.log('NULL districtCode rows (K25):', nullRows.length);
  let totalE = 0,
    totalA = 0;
  for (const r of nullRows) {
    totalE += r.eligible;
    totalA += r.actual;
    if (r.actual > 500)
      console.log(
        r.cityCode,
        JSON.stringify(r.cityName),
        'e:',
        r.eligible,
        'a:',
        r.actual,
      );
  }
  console.log('Total eligible NULL:', totalE, 'Total actual NULL:', totalA);

  // District code breakdown
  const codes = await db.execute(
    sql`SELECT district_code, COUNT(*)::int as cnt, SUM(actual_voters)::int as voters FROM election_city_results WHERE knesset_num=25 GROUP BY district_code ORDER BY district_code`,
  );
  console.log('\nDistrict codes:');
  for (const c of codes) {
    console.log('dc:', c.district_code, 'rows:', c.cnt, 'voters:', c.voters);
  }

  process.exit(0);
}
main();
