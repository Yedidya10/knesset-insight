import { appConfig } from '../../../../app.config';

/**
 * Returns the Anthropic Claude model instance for integrity analysis.
 * Uses the Vercel AI SDK @ai-sdk/anthropic adapter.
 * Supports both ANTHROPIC_API_KEY and CLAUDE_API_KEY env var names.
 */
export function getIntegrityModel() {
  const { model } = appConfig.integrity.ai;
  // @ai-sdk/anthropic reads ANTHROPIC_API_KEY — alias CLAUDE_API_KEY if set
  if (!process.env.ANTHROPIC_API_KEY && process.env.CLAUDE_API_KEY) {
    process.env.ANTHROPIC_API_KEY = process.env.CLAUDE_API_KEY;
  }
  const { anthropic } = require('@ai-sdk/anthropic');
  return anthropic(model);
}
