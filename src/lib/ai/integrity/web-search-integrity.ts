import { tavily } from '@tavily/core';
import { generateText } from 'ai';
import { appConfig } from '../../../../app.config';
import { getIntegrityModel } from './provider';
import { WEB_SOURCE_PARSER_SKILL } from './skills/web-source-parser';
import type { ExtractedIntegrityEvent } from './analyze';

export interface TavilySnippet {
  title: string;
  url: string;
  content: string;
  score: number;
  domain: string;
  /** Which internal query surfaced this snippet — useful for debugging coverage. */
  queryTag: 'current' | 'historical' | 'speech';
}

export interface WebIntegrityEvent extends ExtractedIntegrityEvent {
  description_en: string;
  metadata: {
    source_url: string;
    source_title: string;
    tavily_score: number;
    domain: string;
    unreliable_date?: boolean;
    [k: string]: unknown;
  };
}

/**
 * URL substrings that are never useful as integrity evidence even if
 * Tavily returns them: MK bio / legislation bill pages / member-list
 * queries that just mention the name.
 */
const BLOCKED_URL_PATTERNS = [
  'lawbill.aspx',
  'lawsuggestionssearch',
  '/mk/',
  'MembersIds=',
  '5559962', // Knesset research paper on immunity — footnote-only citations
];

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function filterResults(
  results: Array<{
    url?: string;
    title?: string;
    content?: string;
    score?: number;
  }>,
  tag: TavilySnippet['queryTag'],
): TavilySnippet[] {
  return results
    .filter((r) => {
      const url = r.url ?? '';
      return !BLOCKED_URL_PATTERNS.some((pat) => url.includes(pat));
    })
    .map((r) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      content: r.content ?? '',
      score: r.score ?? 0,
      domain: domainOf(r.url ?? ''),
      queryTag: tag,
    }));
}

function dedupeByUrl(snippets: TavilySnippet[]): TavilySnippet[] {
  const seen = new Map<string, TavilySnippet>();
  for (const s of snippets) {
    const existing = seen.get(s.url);
    if (!existing || s.score > existing.score) seen.set(s.url, s);
  }
  return Array.from(seen.values()).sort((a, b) => b.score - a.score);
}

/**
 * Runs multiple Tavily web searches for integrity-related mentions of a
 * specific MK and merges the results. Three passes:
 *
 *   1. `current`    — parliamentary/legal integrity events during their
 *                     tenure (ethics committee, indictments, civil suits).
 *   2. `historical` — pre-Knesset convictions / indictments (no "חבר כנסת"
 *                     qualifier so older articles aren't filtered out).
 *   3. `speech`     — non-parliamentary conduct: incitement, extreme speech,
 *                     hate speech that drew AG/prosecutor attention.
 *
 * No `includeDomains` whitelist — the old pipeline missed mainstream
 * coverage (e.g. mako, Wikipedia) because it restricted the domain list.
 */
export async function searchMkIntegrity(
  fullNameHe: string,
): Promise<TavilySnippet[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn('[integrity:web] TAVILY_API_KEY not set, skipping');
    return [];
  }

  const { searchDepth, maxResults, excludeDomains, country } =
    appConfig.integrity.webSearch;
  const tvly = tavily({ apiKey });

  const baseOptions = {
    searchDepth,
    maxResults,
    excludeDomains: [...excludeDomains],
    country,
  };

  const currentQuery =
    `"${fullNameHe}" חבר כנסת (ועדת אתיקה OR "הסרת חסינות" OR חסינות OR ` +
    `"כתב אישום" OR הרשעה OR "מבקר המדינה" OR "ניגוד עניינים" OR ` +
    `חקירה OR קנס OR סנקציה OR "תביעה אזרחית")`;

  // Historical / pre-Knesset: drop the "חבר כנסת" qualifier so older
  // articles (when subject wasn't yet an MK) are not excluded.
  const historicalQuery =
    `"${fullNameHe}" (הרשעה OR "כתב אישום" OR "הורשע" OR "נשפט" OR ` +
    `"חקירה פלילית" OR "עבירות" OR "פסק דין")`;

  // Non-parliamentary conduct: incitement / extreme speech that's not
  // necessarily a formal ethics complaint.
  const speechQuery =
    `"${fullNameHe}" (הסתה OR "שפה קיצונית" OR "דברי שטנה" OR ` +
    `"לשרוף" OR "להשמיד" OR "גזענות" OR "תלונה ליועמ"ש" OR ` +
    `"היועצת המשפטית" OR "פרקליט המדינה")`;

  const runs: Array<[string, TavilySnippet['queryTag']]> = [
    [currentQuery, 'current'],
    [historicalQuery, 'historical'],
    [speechQuery, 'speech'],
  ];

  const all: TavilySnippet[] = [];
  for (const [query, tag] of runs) {
    try {
      const response = await tvly.search(query, baseOptions);
      all.push(...filterResults(response.results ?? [], tag));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[integrity:web] Tavily ${tag} failed for "${fullNameHe}": ${message}`,
      );
    }
  }

  return dedupeByUrl(all);
}

/**
 * Feed Tavily snippets to Claude with the web-source parser skill.
 * Returns extracted integrity events.
 */
export async function analyzeWebSnippets(
  fullNameHe: string,
  snippets: TavilySnippet[],
): Promise<WebIntegrityEvent[]> {
  if (snippets.length === 0) return [];

  const model = getIntegrityModel();
  const { maxTokens } = appConfig.integrity.ai;

  const snippetsPayload = snippets.map((s, i) => ({
    index: i,
    title: s.title,
    url: s.url,
    content: s.content,
    tavily_score: s.score,
    domain: s.domain,
    query_tag: s.queryTag,
  }));

  const { text } = await generateText({
    model,
    maxOutputTokens: maxTokens,
    system: WEB_SOURCE_PARSER_SKILL,
    prompt: `Target Knesset Member: ${fullNameHe}

Analyze the following web search snippets and extract integrity events
ONLY about this specific person. Be conservative with confidence.

Snippets:
${JSON.stringify(snippetsPayload, null, 2)}`,
  });

  return parseWebResponse(text, fullNameHe);
}

function parseWebResponse(
  text: string,
  expectedName: string,
): WebIntegrityEvent[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item: unknown): item is WebIntegrityEvent => {
      if (typeof item !== 'object' || item === null) return false;
      const rec = item as Record<string, unknown>;
      return (
        typeof rec.member_name === 'string' &&
        rec.member_name.includes(expectedName.split(' ')[0] ?? '') &&
        typeof rec.category === 'string' &&
        typeof rec.event_date === 'string' &&
        typeof rec.confidence === 'number' &&
        typeof rec.metadata === 'object'
      );
    });
  } catch {
    return [];
  }
}
