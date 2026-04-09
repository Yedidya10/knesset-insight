import { appConfig } from '../../../../app.config';

/**
 * Returns the Anthropic Claude model instance for bill summary generation.
 * Uses web search tool to ground summaries in official sources.
 */
export function getSummaryModel() {
  const { model } = appConfig.billSummary.ai;
  const { createAnthropic } = require('@ai-sdk/anthropic');
  const anthropic = createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY,
  });
  return anthropic(model);
}
