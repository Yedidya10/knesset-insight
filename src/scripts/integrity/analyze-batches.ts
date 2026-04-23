/**
 * Phase 2b — Automated analysis of scan batches via Claude (Sonnet 4).
 *
 * Reads each tmp/integrity-k25/scan-batches/batch-NN.json, runs the
 * web-source-parser skill per MK, and writes the combined result to
 *   tmp/integrity-k25/analysis/batch-NN.analysis.json
 *
 * Resumable: batches whose .analysis.json already exists are skipped.
 * Delete the file to re-analyze.
 *
 * Run with: pnpm tsx src/scripts/integrity/analyze-batches.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const BATCH_DIR = join(process.cwd(), 'tmp', 'integrity-k25', 'scan-batches');
const ANALYSIS_DIR = join(process.cwd(), 'tmp', 'integrity-k25', 'analysis');

interface BatchSnippet {
  title: string;
  url: string;
  domain: string;
  score: number;
  contentTrimmed: string;
}

interface BatchMember {
  memberId: number;
  memberName: string;
  factionName: string | null;
  snippets: BatchSnippet[];
}

interface Batch {
  batchIndex: number;
  memberCount: number;
  members: BatchMember[];
}

async function main() {
  mkdirSync(ANALYSIS_DIR, { recursive: true });

  const { generateText } = await import('ai');
  const { getIntegrityModel } = await import('../../lib/ai/integrity/provider');
  const { WEB_SOURCE_PARSER_SKILL } =
    await import('../../lib/ai/integrity/skills/web-source-parser');
  const { appConfig } = await import('../../../app.config');

  const model = getIntegrityModel();
  const { maxTokens } = appConfig.integrity.ai;

  const batchFiles = readdirSync(BATCH_DIR)
    .filter((f) => /^batch-\d+\.json$/.test(f))
    .sort();

  console.log(`[analyze] ${batchFiles.length} batches found`);

  for (const file of batchFiles) {
    const outFile = join(ANALYSIS_DIR, file.replace('.json', '.analysis.json'));
    if (existsSync(outFile)) {
      console.log(`[analyze] SKIP ${file} (already analyzed)`);
      continue;
    }

    const batch: Batch = JSON.parse(
      readFileSync(join(BATCH_DIR, file), 'utf8'),
    );
    console.log(`[analyze] ${file}: ${batch.members.length} members`);

    const members: Array<{
      memberId: number;
      memberName: string;
      events: unknown[];
      notes?: string;
    }> = [];

    for (const mk of batch.members) {
      process.stdout.write(
        `[analyze]   ${mk.memberName} (${mk.snippets.length} snippets)… `,
      );
      if (mk.snippets.length === 0) {
        console.log('no snippets → skip');
        members.push({
          memberId: mk.memberId,
          memberName: mk.memberName,
          events: [],
        });
        continue;
      }

      const snippetsPayload = mk.snippets.map((s, i) => ({
        index: i,
        title: s.title,
        url: s.url,
        content: s.contentTrimmed,
        tavily_score: s.score,
        domain: s.domain,
      }));

      try {
        const { text } = await generateText({
          model,
          maxOutputTokens: maxTokens,
          system: WEB_SOURCE_PARSER_SKILL,
          prompt: `Target Knesset Member: ${mk.memberName}

Analyze the following web search snippets and extract integrity events
ONLY about this specific person. Be conservative with confidence.

Snippets:
${JSON.stringify(snippetsPayload, null, 2)}`,
        });

        const events = parseEvents(text, mk.memberName);
        console.log(`${events.length} events`);
        members.push({
          memberId: mk.memberId,
          memberName: mk.memberName,
          events,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`FAILED (${msg})`);
        members.push({
          memberId: mk.memberId,
          memberName: mk.memberName,
          events: [],
          notes: `analysis_failed: ${msg}`,
        });
      }

      // Gentle pacing
      await new Promise((r) => setTimeout(r, 300));
    }

    const out = {
      batchIndex: batch.batchIndex,
      analyzedBy: appConfig.integrity.ai.model,
      analyzedAt: new Date().toISOString(),
      members,
    };
    writeFileSync(outFile, JSON.stringify(out, null, 2), 'utf8');
    const total = members.reduce((s, m) => s + m.events.length, 0);
    console.log(`[analyze] → ${outFile} (${total} events)`);
  }

  console.log('[analyze] Done.');
  process.exit(0);
}

function parseEvents(text: string, expectedName: string): unknown[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];
    const firstToken = expectedName.split(' ')[0] ?? '';
    return parsed.filter((item: unknown) => {
      if (typeof item !== 'object' || item === null) return false;
      const rec = item as Record<string, unknown>;
      return (
        typeof rec.member_name === 'string' &&
        rec.member_name.includes(firstToken) &&
        typeof rec.category === 'string' &&
        typeof rec.confidence === 'number' &&
        typeof rec.metadata === 'object'
      );
    });
  } catch {
    return [];
  }
}

main().catch((err) => {
  console.error('[analyze] Fatal:', err);
  process.exit(1);
});
