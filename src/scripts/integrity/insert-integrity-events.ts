/**
 * Phase 3 — Insert integrity events from analysis JSONs into `integrity_cases`.
 *
 * Reads all tmp/integrity-k25/analysis/batch-NN.analysis.json files,
 * iterates every event, and upserts into the DB.
 *
 * Verification policy: EVERY inserted row starts with `verified = false`
 * and is routed to the admin review queue at /admin/integrity. No source
 * is auto-approved, regardless of domain or AI confidence.
 *
 * Source-URL blocklist: rows whose sourceUrl matches an entry in
 * BLOCKED_SOURCE_URL_PATTERNS are skipped entirely (e.g. the Knesset
 * Research Dept. immunity PDF — it only cites MKs as footnote examples
 * and is not a primary integrity source).
 *
 * Idempotent: uses (memberId, category, eventDate, sourceUrl) as a
 * deduplication key — skips rows that already exist.
 *
 * Run with:  pnpm tsx src/scripts/integrity/insert-integrity-events.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ANALYSIS_DIR = join(process.cwd(), 'tmp', 'integrity-k25', 'analysis');

/**
 * Source URLs that must NEVER be inserted as integrity evidence.
 * These are documents that merely cite MKs as footnote examples, not
 * primary integrity sources (e.g. Knesset research papers on immunity
 * law where MK names appear only as illustrative case citations).
 */
const BLOCKED_SOURCE_URL_PATTERNS = [
  '5559962', // Knesset Research Dept. — "חסינות חברי הכנסת" research paper
];

function isBlockedSourceUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return BLOCKED_SOURCE_URL_PATTERNS.some((pat) => url.includes(pat));
}

// Map analysis category → source_type for DB
function inferSourceType(domain: string, category: string): string {
  if (domain?.includes('knesset.gov.il')) return 'knesset_ethics_committee';
  if (domain?.includes('mevaker.gov.il') || domain?.includes('library.mevaker'))
    return 'state_comptroller';
  if (domain?.includes('supremedecisions.court.gov.il')) return 'court_ruling';
  if (domain?.includes('gov.il')) return 'attorney_general';
  if (
    category === 'criminal_investigation' ||
    category === 'indictment' ||
    category === 'criminal_conviction'
  ) {
    return 'police_investigation';
  }
  return 'official_gazette';
}

// Generate a short title from the event (used as `title` column)
function makeTitle(event: AnalysisEvent): string {
  const CAT_LABELS: Record<string, string> = {
    criminal_conviction: 'הרשעה פלילית',
    criminal_investigation: 'חקירה פלילית',
    indictment: 'כתב אישום',
    ethics_complaint: 'קובלנת אתיקה',
    civil_lawsuit: 'תביעה אזרחית',
  };
  const catHe = CAT_LABELS[event.category] ?? event.category;
  const status = event.status ? ` (${event.status})` : '';
  // Truncate description to ~80 chars for title
  const shortDesc = event.description?.slice(0, 80) ?? catHe;
  return `${catHe}${status}: ${shortDesc}`;
}

interface AnalysisEvent {
  member_name: string;
  category: string;
  severity: string;
  status: string;
  description: string;
  description_en?: string;
  decision?: string;
  sanction_type?: string;
  financial_amount?: number | null;
  event_date?: string | null;
  confidence: number;
  metadata: {
    source_url?: string;
    source_title?: string;
    tavily_score?: number;
    domain?: string;
    case_number?: string;
    unreliable_date?: boolean;
    date_note?: string;
    corroborating_source?: string;
    [key: string]: unknown;
  };
  notes?: string;
}

interface AnalysisMember {
  memberId: number;
  memberName: string;
  events: AnalysisEvent[];
  notes?: string;
}

interface AnalysisBatch {
  batchIndex: number;
  analyzedBy: string;
  analyzedAt: string;
  members: AnalysisMember[];
}

async function main() {
  const { db } = await import('../../lib/db/index');
  const { integrityCases } = await import('../../lib/db/schema');
  const { eq, and } = await import('drizzle-orm');

  // Collect all analysis batch files
  const files = readdirSync(ANALYSIS_DIR)
    .filter((f) => f.endsWith('.analysis.json'))
    .sort();

  console.log(`Found ${files.length} analysis batch files`);

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const file of files) {
    const batch: AnalysisBatch = JSON.parse(
      readFileSync(join(ANALYSIS_DIR, file), 'utf-8'),
    );

    for (const member of batch.members) {
      if (!member.events?.length) continue;

      for (const event of member.events) {
        const domain = event.metadata?.domain ?? '';
        const sourceUrl = event.metadata?.source_url ?? null;
        const confidence = event.confidence ?? 0;

        if (isBlockedSourceUrl(sourceUrl)) {
          console.log(
            `  BLOCK ${member.memberName} [${event.category}] — blocked source: ${sourceUrl}`,
          );
          totalSkipped++;
          continue;
        }

        // Use event_date if available; fall back to a sentinel date
        // (DB requires NOT NULL, use 1970-01-01 if unknown — admin must fix)
        const rawDate = event.event_date;
        const eventDate =
          rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
            ? rawDate
            : '1970-01-01';
        const hasReliableDate = rawDate && !event.metadata?.unreliable_date;

        const sourceType = inferSourceType(domain, event.category);

        const title = makeTitle(event);

        try {
          // Check for existing row by memberId + category + sourceUrl
          const existing = await db
            .select({ id: integrityCases.id })
            .from(integrityCases)
            .where(
              and(
                eq(integrityCases.memberId, member.memberId),
                eq(integrityCases.category, event.category),
                sourceUrl
                  ? eq(integrityCases.sourceUrl, sourceUrl)
                  : eq(integrityCases.sourceUrl, ''),
              ),
            )
            .limit(1);

          if (existing.length > 0) {
            console.log(
              `  SKIP ${member.memberName} [${event.category}] — already exists (id=${existing[0].id})`,
            );
            totalSkipped++;
            continue;
          }

          await db.insert(integrityCases).values({
            memberId: member.memberId,
            category: event.category,
            severity: event.severity ?? 'info',
            status: event.status ?? 'reported',
            title: title.slice(0, 500),
            titleEn: event.description_en?.slice(0, 200) ?? null,
            description: event.description ?? null,
            descriptionEn: event.description_en ?? null,
            sourceType,
            sourceName: event.metadata?.source_title ?? domain,
            sourceUrl,
            sourceDocId: event.metadata?.case_number ?? null,
            eventDate,
            reportedDate: hasReliableDate ? rawDate : null,
            decision: event.decision ?? null,
            sanctionType: event.sanction_type ?? null,
            financialAmount: event.financial_amount
              ? String(event.financial_amount)
              : null,
            metadata: {
              tavilyScore: event.metadata?.tavily_score,
              domain,
              dateNote: event.metadata?.date_note ?? null,
              unreliableDate: event.metadata?.unreliable_date ?? false,
              corroboratingSource: event.metadata?.corroborating_source ?? null,
              analystNotes: event.notes ?? null,
              analyzedBy: batch.analyzedBy,
              analyzedAt: batch.analyzedAt,
              batchIndex: batch.batchIndex,
            },
            aiSummary: event.description,
            aiConfidence: confidence,
            verified: false,
            verifiedBy: null,
            verifiedAt: null,
          });

          console.log(
            `  INSERT ${member.memberName} [${event.category}] → admin review`,
          );
          totalInserted++;
        } catch (err) {
          console.error(
            `  ERROR ${member.memberName} [${event.category}]:`,
            err,
          );
          totalErrors++;
        }
      }
    }
  }

  console.log('\n── Summary ──────────────────────────────');
  console.log(`  Inserted : ${totalInserted}`);
  console.log(`  Skipped  : ${totalSkipped}`);
  console.log(`  Errors   : ${totalErrors}`);

  process.exit(totalErrors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
