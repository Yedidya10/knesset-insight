import { appConfig } from '../../../../app.config';

/**
 * Returns the Anthropic Claude model instance for integrity analysis.
 * Uses the Vercel AI SDK @ai-sdk/anthropic adapter.
 */
export function getIntegrityModel() {
  const { model } = appConfig.integrity.ai;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { anthropic } = require('@ai-sdk/anthropic');
  return anthropic(model);
}
