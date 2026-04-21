/**
 * Phase 1b — Cross-MK snippet merge.
 *
 * Problem: Tavily is queried per MK, but articles often mention multiple
 * MKs in the same piece (e.g. the Haaretz article about both ואטורי and
 * סמוטריץ' surfaces only on Smotrich's search, so Vatori's snippet file
 * ends up empty). The analyzer then never sees the Vatori half of the
 * story.
 *
 * This script reads every `tmp/integrity-k25/<id>.json`, scans all
 * snippet content for any K25 MK name, and appends the snippet to the
 * file of every MK it mentions (idempotent: by URL).
 *
 * Run AFTER fetch-k25-tavily.ts and BEFORE build-scan-batches.ts:
 *   pnpm tsx src/scripts/integrity/cross-mk-merge.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface Snippet {
  title: string;
  url: string;
  domain: string;
  content: string;
  score: number;
  queryTag?: string;
  /** Set on snippets merged in from another MK's search. */
  borrowedFrom?: number;
}

interface MkFile {
  memberId: number;
  memberName: string;
  knessetId: number;
  isCurrent: boolean | null;
  factionName: string | null;
  fetchedAt: string;
  snippetCount: number;
  snippets: Snippet[];
}

const DIR = join(process.cwd(), 'tmp', 'integrity-k25');

function main() {
  const files = readdirSync(DIR)
    .filter((f) => /^\d+\.json$/.test(f))
    .sort((a, b) => parseInt(a) - parseInt(b));

  // Load everything first so we can do all-vs-all in memory.
  const mks: MkFile[] = files.map(
    (f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as MkFile,
  );

  // Build name → member map. Use full name; also try "first last" and
  // "last, first" variants that news articles sometimes use.
  const byName = new Map<string, MkFile>();
  for (const mk of mks) {
    const variants = nameVariants(mk.memberName);
    for (const v of variants) byName.set(v, mk);
  }

  // Index all existing snippet URLs per MK to keep the merge idempotent.
  const seenUrlsPerMk = new Map<number, Set<string>>();
  for (const mk of mks) {
    seenUrlsPerMk.set(mk.memberId, new Set(mk.snippets.map((s) => s.url)));
  }

  let mergedCount = 0;

  for (const source of mks) {
    for (const snippet of source.snippets) {
      if (snippet.borrowedFrom) continue; // already a cross-ref itself
      const haystack = `${snippet.title}\n${snippet.content}`;
      for (const [name, target] of byName) {
        if (target.memberId === source.memberId) continue;
        if (!haystack.includes(name)) continue;
        const seen = seenUrlsPerMk.get(target.memberId)!;
        if (seen.has(snippet.url)) continue;
        target.snippets.push({
          ...snippet,
          borrowedFrom: source.memberId,
        });
        seen.add(snippet.url);
        mergedCount++;
      }
    }
  }

  // Write back only files that changed.
  let filesUpdated = 0;
  for (const mk of mks) {
    if (mk.snippets.length === mk.snippetCount) continue;
    mk.snippetCount = mk.snippets.length;
    writeFileSync(
      join(DIR, `${mk.memberId}.json`),
      JSON.stringify(mk, null, 2),
      'utf8',
    );
    filesUpdated++;
  }

  console.log(`[cross-mk-merge] merged ${mergedCount} cross-references`);
  console.log(`[cross-mk-merge] updated ${filesUpdated} MK files`);
}

function nameVariants(fullName: string): string[] {
  const variants = new Set<string>();
  variants.add(fullName);
  // Common orthographic variants — spaces vs. nbsp, trailing titles.
  variants.add(fullName.replace(/\s+/g, ' ').trim());
  return Array.from(variants).filter((v) => v.length >= 5);
}

main();
