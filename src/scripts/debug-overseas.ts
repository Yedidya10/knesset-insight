import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('../lib/db');
  const { electionCityResults, electionCityPartyResults } =
    await import('../lib/db/schema');
  const { eq, and, desc } = await import('drizzle-orm');

  // Get overseas city result for K25
  const [overseas] = await db
    .select()
    .from(electionCityResults)
    .where(
      and(
        eq(electionCityResults.knessetNum, 25),
        eq(electionCityResults.cityCode, '9999'),
      ),
    );
  console.log('Overseas row:', JSON.stringify(overseas, null, 2));

  // Get party breakdown for overseas
  const parties = await db
    .select()
    .from(electionCityPartyResults)
    .where(eq(electionCityPartyResults.cityResultId, overseas.id))
    .orderBy(desc(electionCityPartyResults.votes));
  console.log('\nParty breakdown (' + parties.length + ' parties):');
  for (const p of parties) {
    console.log(
      p.ballotLetters.padEnd(4),
      p.partyName.padEnd(40),
      'votes:',
      p.votes,
      'pct:',
      p.votePercent + '%',
    );
  }

  // Check all knesset nums for overseas
  const allOverseas = await db
    .select({
      knessetNum: electionCityResults.knessetNum,
      cityCode: electionCityResults.cityCode,
      cityName: electionCityResults.cityName,
      eligible: electionCityResults.eligibleVoters,
      actual: electionCityResults.actualVoters,
      valid: electionCityResults.validVotes,
    })
    .from(electionCityResults)
    .where(eq(electionCityResults.cityCode, '9999'));
  console.log('\nOverseas across all knessets:');
  for (const o of allOverseas) {
    console.log(
      'K' + o.knessetNum,
      o.cityName,
      'eligible:',
      o.eligible,
      'actual:',
      o.actual,
      'valid:',
      o.valid,
    );
  }

  process.exit(0);
}
main();
