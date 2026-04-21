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
 * Runs a Tavily web search for integrity-related mentions of a specific MK.
 * Query is crafted to surface ethics/legal/regulatory events.
 */
export async function searchMkIntegrity(
  fullNameHe: string,
): Promise<TavilySnippet[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn('[integrity:web] TAVILY_API_KEY not set, skipping');
    return [];
  }

  const { searchDepth, maxResults, includeDomains } =
    appConfig.integrity.webSearch;
  const tvly = tavily({ apiKey });

  // Hebrew query targeting integrity-relevant terms
  const query =
    `"${fullNameHe}" חבר כנסת (ועדת אתיקה OR "הסרת חסינות" OR חסינות OR ` +
    `"כתב אישום" OR הרשעה OR "מבקר המדינה" OR "ניגוד עניינים" OR ` +
    `חקירה OR קנס OR סנקציה OR "תביעה אזרחית")`;

  try {
    const response = await tvly.search(query, {
      searchDepth,
      maxResults,
      includeDomains: [...includeDomains],
    });

    // URLs that are irrelevant as integrity evidence (legislation pages, general info)
    const BLOCKED_URL_PATTERNS = [
      'lawbill.aspx',
      'lawsuggestionssearch',
      '/mk/', // MK bio pages
      'MembersIds=', // member profile queries
    ];

    return (response.results ?? [])
      .filter((r) => {
        const url = r.url ?? '';
        return !BLOCKED_URL_PATTERNS.some((pat) => url.includes(pat));
      })
      .map((r) => {
        let domain = '';
        try {
          domain = new URL(r.url ?? '').hostname.replace(/^www\./, '');
        } catch {
          // malformed URL — leave empty
        }
        return {
          title: r.title ?? '',
          url: r.url ?? '',
          content: r.content ?? '',
          score: r.score ?? 0,
          domain,
        };
      });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[integrity:web] Tavily failed for "${fullNameHe}": ${message}`,
    );
    return [];
  }
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
