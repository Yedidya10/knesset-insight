/**
 * Sanity-check — confirm the unrestricted Tavily config actually surfaces
 * the articles we know should be there (used during the pipeline rework
 * to validate that dropping includeDomains fixed the coverage gap).
 *
 * Prints the top URLs per query for two canary MKs:
 *   - ניסים ואטורי (should include mako / Haaretz pieces on "לשרוף את עזה")
 *   - איתמר בן גביר (should include pre-Knesset conviction coverage)
 *
 * Run with:  pnpm tsx src/scripts/integrity/verify-tavily-coverage.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  if (!process.env.TAVILY_API_KEY) {
    console.error('TAVILY_API_KEY missing in .env.local');
    process.exit(1);
  }

  const { searchMkIntegrity } =
    await import('../../lib/ai/integrity/web-search-integrity');

  const CANARIES = ['ניסים ואטורי', 'איתמר בן גביר'];

  for (const name of CANARIES) {
    console.log(`\n=== ${name} ===`);
    const snippets = await searchMkIntegrity(name);
    console.log(`Total unique snippets: ${snippets.length}`);
    for (const s of snippets.slice(0, 15)) {
      console.log(
        `  [${s.queryTag}] (${s.score.toFixed(2)}) ${s.domain}\n    ${s.title}\n    ${s.url}`,
      );
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
