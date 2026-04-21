/**
 * Phase 2a — Condense per-MK Tavily JSONs into scan batches for Opus.
 *
 * Each MK snippet file is ~20 KB (full snippet content). Reading 129 of them
 * uncondensed blows context. This aggregator trims snippet.content to
 * 1000 chars and packs 10 MKs per batch file.
 *
 *   tmp/integrity-k25/<id>.json  →  tmp/integrity-k25/scan-batches/batch-NN.json
 *
 * Opus reads batch files, emits per-MK analysis to
 *   tmp/integrity-k25/analysis/<id>.analysis.json
 *
 * Run with:  pnpm tsx src/scripts/integrity/build-scan-batches.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INPUT_DIR = join(process.cwd(), 'tmp', 'integrity-k25');
const BATCH_DIR = join(INPUT_DIR, 'scan-batches');
const ANALYSIS_DIR = join(INPUT_DIR, 'analysis');

const MAX_CONTENT_CHARS = 700;
const MKS_PER_BATCH = 7;

interface MkScanEntry {
  memberId: number;
  memberName: string;
  factionName: string | null;
  snippets: Array<{
    title: string;
    url: string;
    domain: string;
    score: number;
    contentTrimmed: string;
  }>;
}

function main() {
  mkdirSync(BATCH_DIR, { recursive: true });
  mkdirSync(ANALYSIS_DIR, { recursive: true });

  const files = readdirSync(INPUT_DIR)
    .filter((f) => /^\d+\.json$/.test(f))
    .sort((a, b) => parseInt(a) - parseInt(b));

  const withHits: MkScanEntry[] = [];

  for (const f of files) {
    const data = JSON.parse(readFileSync(join(INPUT_DIR, f), 'utf8')) as {
      memberId: number;
      memberName: string;
      factionName: string | null;
      snippetCount: number;
      snippets: Array<{
        title: string;
        url: string;
        domain: string;
        content: string;
        score: number;
      }>;
    };

    if (data.snippetCount === 0) continue;

    withHits.push({
      memberId: data.memberId,
      memberName: data.memberName,
      factionName: data.factionName,
      snippets: data.snippets.map((s) => ({
        title: s.title,
        url: s.url,
        domain: s.domain,
        score: s.score,
        contentTrimmed:
          s.content.length > MAX_CONTENT_CHARS
            ? s.content.slice(0, MAX_CONTENT_CHARS) + '…'
            : s.content,
      })),
    });
  }

  console.log(`[scan-batches] ${withHits.length} MKs with hits`);

  // Pack into batches
  let batchIdx = 1;
  for (let i = 0; i < withHits.length; i += MKS_PER_BATCH) {
    const batch = withHits.slice(i, i + MKS_PER_BATCH);
    const batchFile = join(
      BATCH_DIR,
      `batch-${String(batchIdx).padStart(2, '0')}.json`,
    );
    writeFileSync(
      batchFile,
      JSON.stringify(
        {
          batchIndex: batchIdx,
          memberCount: batch.length,
          members: batch,
        },
        null,
        2,
      ),
      'utf8',
    );
    console.log(
      `[scan-batches]   batch-${String(batchIdx).padStart(2, '0')}: ${batch.length} MKs`,
    );
    batchIdx++;
  }

  const totalBatches = batchIdx - 1;
  const indexFile = join(BATCH_DIR, '_index.json');
  writeFileSync(
    indexFile,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalBatches,
        totalMembers: withHits.length,
        batchSize: MKS_PER_BATCH,
      },
      null,
      2,
    ),
    'utf8',
  );

  console.log(`[scan-batches] Done. ${totalBatches} batches → ${BATCH_DIR}`);
}

main();
