import { tavily } from '@tavily/core';
import { appConfig } from '../../../../app.config';

export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

/**
 * Search the web for information about an Israeli bill using Tavily.
 * Returns concise snippets that can be fed to the LLM as context,
 * avoiding the massive token overhead of provider-level web search tools.
 */
export async function searchBillContext(
  billName: string,
  knessetNum: number | null,
  knessetUrl: string,
): Promise<WebSearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn('[web-search] TAVILY_API_KEY not set, skipping web search');
    return [];
  }

  const tvly = tavily({ apiKey });
  const { maxResults, searchDepth, includeDomains } =
    appConfig.billSummary.webSearch;

  const query = knessetNum
    ? `${billName} הצעת חוק כנסת ${knessetNum}`
    : `${billName} הצעת חוק כנסת`;

  try {
    const response = await tvly.search(query, {
      searchDepth,
      maxResults,
      includeDomains: [...includeDomains],
    });

    const results = (response.results ?? []).map((r) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      content: r.content ?? '',
      score: r.score ?? 0,
    }));

    console.log(
      `[web-search] Tavily returned ${results.length} results for "${billName.slice(0, 50)}..."`,
    );

    return results;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[web-search] Tavily search failed: ${message}`);
    return [];
  }
}
