import { generateText, stepCountIs } from 'ai';
import { appConfig } from '../../../../app.config';
import { getSummaryModel } from './summary-provider';
import { BILL_SUMMARY_SKILL } from './skills/bill-summary';

const { createAnthropic } = require('@ai-sdk/anthropic');
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY,
});

export interface BillForSummary {
  id: number;
  knessetId: number;
  name: string;
  knessetNum: number | null;
  billType: string | null;
  status: string | null;
  proposedDate: string | null;
}

export interface SummaryResult {
  billId: number;
  summary: Record<string, string> | null;
  topics: Record<string, string[]> | null;
  tokensUsed: number;
}

/**
 * Generate an AI summary for a single bill using Claude with web search.
 * The model uses web search to ground the summary in official Knesset sources,
 * ensuring the summary reflects the bill's latest state (post-committee,
 * post-reservations, etc.) rather than just the initial proposal.
 */
export async function generateBillSummary(
  bill: BillForSummary,
): Promise<SummaryResult> {
  const model = getSummaryModel();
  const { maxTokens } = appConfig.billSummary.ai;

  const knessetUrl = `https://main.knesset.gov.il/Activity/Legislation/Laws/Pages/LawBill.aspx?t=LawsTable&lawItemID=${bill.knessetId}`;

  const prompt = `Generate a summary for this Israeli bill:

- Bill Name: ${bill.name}
- Knesset: ${bill.knessetNum ?? 'unknown'}
- Type: ${bill.billType ?? 'unknown'}
- Status: ${bill.status ?? 'unknown'}
- Proposed Date: ${bill.proposedDate ?? 'unknown'}
- Official Knesset Page: ${knessetUrl}

Search for this bill on the Knesset website and news sources. Focus on the bill's LATEST version — if it went through committee discussions or readings, describe the current state, not just the original proposal.`;

  const webSearchTool = anthropic.tools.webSearch_20250305({
    maxUses: 3,
    allowedDomains: [
      'knesset.gov.il',
      'main.knesset.gov.il',
      'ynet.co.il',
      'mako.co.il',
      'kan.org.il',
      'walla.co.il',
      'haaretz.co.il',
      'globes.co.il',
      'calcalist.co.il',
    ],
    userLocation: {
      type: 'approximate',
      country: 'IL',
      region: 'Tel Aviv',
      city: 'Tel Aviv',
      timezone: 'Asia/Jerusalem',
    },
  });

  const { text, usage, sources } = await generateText({
    model,
    maxOutputTokens: maxTokens,
    system: BILL_SUMMARY_SKILL,
    prompt,
    tools: {
      web_search: webSearchTool,
    },
    stopWhen: stepCountIs(3),
  });

  const tokensUsed = usage?.totalTokens ?? 0;
  const trimmed = text.trim();

  if (trimmed === 'NO_SUMMARY' || trimmed.length < 10) {
    console.log(
      `[bill-summary] No summary generated for bill ${bill.knessetId} (${bill.name})`,
    );
    return { billId: bill.id, summary: null, topics: null, tokensUsed };
  }

  // Parse JSON response: { summary: {he, en, ar, ru}, topics: {he: [...], ...} }
  let summary: Record<string, string> | null = null;
  let topics: Record<string, string[]> | null = null;
  try {
    const parsed = JSON.parse(trimmed);

    // Validate summary object has at least Hebrew
    if (
      parsed.summary &&
      typeof parsed.summary === 'object' &&
      parsed.summary.he
    ) {
      summary = parsed.summary;
    } else if (typeof parsed.summary === 'string') {
      // Fallback: model returned flat string summary
      summary = { he: parsed.summary };
    }

    // Validate topics object
    if (
      parsed.topics &&
      typeof parsed.topics === 'object' &&
      !Array.isArray(parsed.topics)
    ) {
      topics = {};
      for (const [lang, tags] of Object.entries(parsed.topics)) {
        if (Array.isArray(tags)) {
          topics[lang] = (tags as unknown[]).filter(
            (t): t is string => typeof t === 'string' && t.length > 0,
          );
        }
      }
      if (Object.keys(topics).length === 0) topics = null;
    } else if (Array.isArray(parsed.topics)) {
      // Fallback: model returned flat Hebrew topics array
      topics = {
        he: parsed.topics.filter(
          (t: unknown): t is string => typeof t === 'string' && t.length > 0,
        ),
      };
    }
  } catch {
    // Fallback: model returned plain text instead of JSON
    summary = { he: trimmed };
  }

  if (!summary || !summary.he || summary.he.length < 10) {
    return { billId: bill.id, summary: null, topics: null, tokensUsed };
  }

  console.log(
    `[bill-summary] Generated summary for bill ${bill.knessetId}: ${summary.he.slice(0, 80)}...` +
      ` [${Object.keys(summary).length} langs]` +
      (topics ? ` [${Object.keys(topics).length} lang topics]` : '') +
      (sources?.length ? ` (${sources.length} sources)` : '') +
      ` [${tokensUsed} tokens]`,
  );

  return { billId: bill.id, summary, topics, tokensUsed };
}
