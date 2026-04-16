import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('../lib/db');
  const { sql } = await import('drizzle-orm');

  // Pipeline runs
  const runs = await db.execute(sql`
    SELECT id, run_status, items_processed, items_failed, items_skipped, tokens_used,
           estimated_cost_usd, started_at, completed_at
    FROM pipeline_run_log
    WHERE job_name = 'classify-vote-stances'
    ORDER BY started_at DESC
  `);
  console.log('\n=== PIPELINE RUNS ===');
  for (const r of runs) {
    console.log(
      `  Run #${r.id}: ${r.run_status} | processed=${r.items_processed} failed=${r.items_failed} skipped=${r.items_skipped} | tokens=${r.tokens_used} | cost=$${r.estimated_cost_usd}`,
    );
  }

  // Policy stances
  const stances = await db.execute(sql`
    SELECT id, label->>'he' as he, domain, vote_count, stance_type
    FROM policy_stances ORDER BY id
  `);
  console.log('\n=== POLICY STANCES ===');
  for (const s of stances) {
    console.log(
      `  [${s.id}] ${s.he} | domain=${s.domain} | type=${s.stance_type} | votes=${s.vote_count}`,
    );
  }

  // Alignments summary
  const alignments = await db.execute(sql`
    SELECT COUNT(*) as total,
           COUNT(*) FILTER (WHERE alignment = 'supports') as supports,
           COUNT(*) FILTER (WHERE alignment = 'opposes') as opposes,
           COUNT(*) FILTER (WHERE needs_review = true) as needs_review,
           ROUND(AVG(confidence)::numeric, 3) as avg_confidence
    FROM vote_stance_alignment
  `);
  console.log('\n=== ALIGNMENT STATS ===');
  console.log(JSON.stringify(alignments[0]));

  // Remaining votes to classify
  const remaining = await db.execute(sql`
    SELECT COUNT(*) as remaining
    FROM votes v
    JOIN bills b ON b.id = v.bill_id
    WHERE b.ai_summary IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM vote_stance_alignment WHERE vote_id = v.id)
  `);
  console.log(
    `\nRemaining votes with AI summaries to classify: ${remaining[0]?.remaining}`,
  );

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
