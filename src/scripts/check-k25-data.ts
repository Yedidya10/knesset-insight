/**
 * Check K25 vote data status and explore Open Knesset data sources.
 */
import { db } from '../lib/db';
import { memberVotes, votes } from '../lib/db/schema';
import { eq, sql, and } from 'drizzle-orm';

async function main() {
  // 1. Check K25 member_votes count in our DB
  const k25Votes = await db.select({ count: sql<number>`count(*)` })
    .from(votes)
    .where(eq(votes.knessetNum, 25));
  console.log(`K25 votes in DB: ${k25Votes[0].count}`);

  const k25MemberVotes = await db.select({ count: sql<number>`count(*)` })
    .from(memberVotes)
    .innerJoin(votes, eq(memberVotes.voteId, votes.id))
    .where(eq(votes.knessetNum, 25));
  console.log(`K25 member_votes in DB: ${k25MemberVotes[0].count}`);

  // 2. Check a specific vote to see how many member results we have
  const vote45854 = await db.select({ count: sql<number>`count(*)` })
    .from(memberVotes)
    .innerJoin(votes, eq(memberVotes.voteId, votes.id))
    .where(eq(votes.knessetId, 45854));
  console.log(`Vote 45854 member_votes in DB: ${vote45854[0].count}`);

  // 3. Sample K25 votes with their member_vote counts
  const sampleVotes = await db.select({
    voteId: votes.id,
    knessetId: votes.knessetId,
    title: votes.title,
    mvCount: sql<number>`count(${memberVotes.id})`,
  })
    .from(votes)
    .leftJoin(memberVotes, eq(memberVotes.voteId, votes.id))
    .where(eq(votes.knessetNum, 25))
    .groupBy(votes.id, votes.knessetId, votes.title)
    .orderBy(sql`count(${memberVotes.id}) desc`)
    .limit(10);
  console.log('\nTop 10 K25 votes by member_vote count:');
  for (const v of sampleVotes) {
    console.log(`  knessetId=${v.knessetId}: ${v.mvCount} member_votes — ${v.title?.substring(0, 60)}`);
  }

  // 4. K25 votes with 0 member_votes
  const emptyVotes = await db.select({
    count: sql<number>`count(*)`,
  })
    .from(votes)
    .leftJoin(memberVotes, eq(memberVotes.voteId, votes.id))
    .where(and(eq(votes.knessetNum, 25), sql`${memberVotes.id} is null`));
  console.log(`\nK25 votes with 0 member_votes: ${emptyVotes[0].count}`);

  // 5. Try Open Knesset data for vote results
  console.log('\n=== Checking Open Knesset data sources ===');
  const oknessetPaths = [
    'people/members/joined-mks/all_member_votes_per_mk.csv',
    'votes/all_votes.csv', 
    'votes/view_vote_rslts_hdr_approved.csv',
    'votes/vote_rslts_kmmbr_shadow.csv',
    'people/members/joined-mks',
  ];

  for (const path of oknessetPaths) {
    try {
      const url = `https://production.oknesset.org/pipelines/data/${path}`;
      const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10_000) });
      console.log(`  ${path}: ${res.status} ${res.statusText} (${res.headers.get('content-length') || 'unknown'} bytes)`);
    } catch (err: any) {
      console.log(`  ${path}: ERROR - ${err.message}`);
    }
  }

  // 6. Check directory listing at Open Knesset
  try {
    const res = await fetch('https://production.oknesset.org/pipelines/data/votes/', {
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text();
    // Extract links from directory listing
    const links = text.match(/href="[^"]+"/g) || [];
    console.log('\nOpen Knesset /votes/ directory:');
    for (const link of links.slice(0, 30)) {
      console.log(`  ${link}`);
    }
  } catch (err: any) {
    console.log(`Directory listing error: ${err.message}`);
  }

  process.exit(0);
}

main().catch(console.error);
