/**
 * Per-MK integrity web-search runner (LOCAL).
 *
 * Runs Tavily + Claude for each current Knesset 25 MK to discover
 * integrity events on the public web. Writes rows to `integrity_cases`
 * with verified=false for admin review.
 *
 * Usage:
 *   pnpm tsx src/scripts/ai/run-integrity-web-search.ts [options]
 *
 * Options (flags):
 *   --limit=N         Only process first N MKs (e.g. --limit=2 for canary)
 *   --batch=N         Batch size for progress logging (default: 10)
 *   --knesset=N       Knesset number (default: 25)
 *   --ids=1,2,3       Only process these member IDs (comma-separated)
 *   --dry-run         Skip DB writes, print events only
 *
 * Example (canary on 2 MKs):
 *   pnpm tsx src/scripts/ai/run-integrity-web-search.ts --limit=2
 *
 * Example (full K25 run):
 *   pnpm tsx src/scripts/ai/run-integrity-web-search.ts --knesset=25
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

interface Args {
  limit: number | null;
  batch: number;
  knesset: number;
  ids: number[] | null;
  dryRun: boolean;
}

function parseArgs(): Args {
  const out: Args = {
    limit: null,
    batch: 10,
    knesset: 25,
    ids: null,
    dryRun: false,
  };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') out.dryRun = true;
    else if (arg.startsWith('--limit=')) out.limit = Number(arg.split('=')[1]);
    else if (arg.startsWith('--batch=')) out.batch = Number(arg.split('=')[1]);
    else if (arg.startsWith('--knesset='))
      out.knesset = Number(arg.split('=')[1]);
    else if (arg.startsWith('--ids='))
      out.ids = arg
        .split('=')[1]
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n));
  }
  return out;
}

async function main() {
  const args = parseArgs();
  console.log('=== MK Integrity Web Search ===');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Args:`, args);
  console.log('');

  if (!process.env.TAVILY_API_KEY) {
    console.error('Missing TAVILY_API_KEY in .env.local');
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Missing ANTHROPIC_API_KEY in .env.local');
    process.exit(1);
  }

  const { db } = await import('../../lib/db');
  const { members, integrityCases } = await import('../../lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { appConfig } = await import('../../../app.config');
  const { searchMkIntegrity, analyzeWebSnippets } =
    await import('../../lib/ai/integrity/web-search-integrity');

  // Fetch current MKs
  const rows = await db
    .select({
      memberId: members.id,
      knessetId: members.knessetId,
      firstName: members.firstName,
      lastName: members.lastName,
      knessetNum: members.knessetNum,
    })
    .from(members)
    .where(eq(members.isCurrent, true));

  let candidates = rows.filter(
    (r) => r.knessetNum === args.knesset || r.knessetNum === null,
  );

  if (args.ids) {
    const allow = new Set(args.ids);
    candidates = candidates.filter((c) => allow.has(c.memberId));
  }
  if (args.limit) {
    candidates = candidates.slice(0, args.limit);
  }

  console.log(`Found ${candidates.length} MKs for K${args.knesset}`);
  console.log('');

  const { governmentDomains, confidenceThreshold } =
    appConfig.integrity.webSearch;
  const govSet = new Set(governmentDomains);

  const totals = {
    mksProcessed: 0,
    mksWithEvents: 0,
    snippetsFound: 0,
    eventsExtracted: 0,
    casesInserted: 0,
    autoVerified: 0,
    routedToReview: 0,
    errors: 0,
  };

  const startAll = Date.now();

  for (let i = 0; i < candidates.length; i++) {
    const mk = candidates[i];
    const fullName = `${mk.firstName} ${mk.lastName}`.trim();
    const prefix = `[${i + 1}/${candidates.length}] ${fullName}`;

    try {
      const tStart = Date.now();
      const snippets = await searchMkIntegrity(fullName);
      totals.snippetsFound += snippets.length;

      if (snippets.length === 0) {
        console.log(`${prefix} — no snippets`);
        totals.mksProcessed++;
        continue;
      }

      const events = await analyzeWebSnippets(fullName, snippets);
      totals.eventsExtracted += events.length;
      if (events.length === 0) {
        console.log(
          `${prefix} — ${snippets.length} snippets, 0 events (${((Date.now() - tStart) / 1000).toFixed(1)}s)`,
        );
        totals.mksProcessed++;
        continue;
      }

      totals.mksWithEvents++;
      let insertedThisMk = 0;
      let autoThisMk = 0;
      let reviewThisMk = 0;

      for (const ev of events) {
        const domain = ev.metadata?.domain ?? '';
        const isGovSource = [...govSet].some(
          (d) => domain === d || domain.endsWith('.' + d),
        );
        const autoVerify = isGovSource && ev.confidence >= confidenceThreshold;

        if (args.dryRun) {
          console.log(
            `   DRY: [${ev.confidence.toFixed(2)}] ${ev.category} @ ${domain} — ${ev.description.slice(0, 80)}`,
          );
          continue;
        }

        const inserted = await db
          .insert(integrityCases)
          .values({
            memberId: mk.memberId,
            category: ev.category,
            severity: (ev.severity as string) ?? 'info',
            status: (ev.status as string) ?? 'reported',
            title: ev.description.substring(0, 200),
            titleEn: ev.description_en?.substring(0, 200) ?? null,
            description: ev.description,
            descriptionEn: ev.description_en ?? null,
            sourceType: isGovSource
              ? mapGovDomainToSourceType(domain)
              : 'web_search',
            sourceName: ev.metadata?.source_title ?? domain,
            sourceUrl: ev.metadata?.source_url ?? null,
            sourceDocId: null,
            eventDate: ev.event_date,
            decision: ev.decision ?? null,
            sanctionType: ev.sanction_type ?? null,
            financialAmount:
              ev.financial_amount != null ? String(ev.financial_amount) : null,
            metadata: ev.metadata as Record<string, unknown>,
            aiSummary: ev.description,
            aiConfidence: ev.confidence,
            verified: autoVerify,
            verifiedBy: autoVerify ? 'auto:gov-source' : null,
            verifiedAt: autoVerify ? new Date() : null,
          })
          .returning({ id: integrityCases.id });

        if (inserted.length > 0) {
          insertedThisMk++;
          if (autoVerify) autoThisMk++;
          else reviewThisMk++;
        }
      }

      totals.casesInserted += insertedThisMk;
      totals.autoVerified += autoThisMk;
      totals.routedToReview += reviewThisMk;

      console.log(
        `${prefix} — ${snippets.length} snippets, ${events.length} events, ` +
          `${insertedThisMk} inserted (${autoThisMk} auto, ${reviewThisMk} review) ` +
          `(${((Date.now() - tStart) / 1000).toFixed(1)}s)`,
      );
    } catch (err) {
      totals.errors++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${prefix} — ERROR: ${msg}`);
    }

    totals.mksProcessed++;

    // Progress checkpoint every batch
    if ((i + 1) % args.batch === 0) {
      const elapsed = ((Date.now() - startAll) / 1000).toFixed(1);
      console.log('');
      console.log(
        `--- Checkpoint: ${i + 1}/${candidates.length} MKs in ${elapsed}s ` +
          `| ${totals.casesInserted} cases inserted ` +
          `(${totals.autoVerified} auto, ${totals.routedToReview} review) ---`,
      );
      console.log('');
    }
  }

  const elapsed = ((Date.now() - startAll) / 1000).toFixed(1);
  console.log('');
  console.log('=== Run complete ===');
  console.log(`Elapsed: ${elapsed}s`);
  console.log(`MKs processed: ${totals.mksProcessed}`);
  console.log(`MKs with events: ${totals.mksWithEvents}`);
  console.log(`Snippets fetched: ${totals.snippetsFound}`);
  console.log(`Events extracted: ${totals.eventsExtracted}`);
  console.log(
    `Cases inserted: ${totals.casesInserted} ` +
      `(${totals.autoVerified} auto-verified, ${totals.routedToReview} review queue)`,
  );
  console.log(`Errors: ${totals.errors}`);

  process.exit(0);
}

function mapGovDomainToSourceType(domain: string): string {
  if (domain.includes('mevaker.gov.il')) return 'state_comptroller';
  if (domain.includes('court.gov.il')) return 'court_ruling';
  if (domain.includes('justice.gov.il')) return 'government_registry';
  if (domain.includes('knesset.gov.il')) return 'knesset_ethics_committee';
  return 'government_registry';
}

main().catch((e) => {
  console.error('Script failed:', e);
  process.exit(1);
});
