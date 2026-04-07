import { appConfig } from '../../../../app.config';

/**
 * Returns the Anthropic Claude model instance for bill cluster analysis.
 * Uses the Vercel AI SDK @ai-sdk/anthropic adapter.
 */
export function getClusterModel() {
  const { model } = appConfig.billClusters.ai;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { anthropic } = require('@ai-sdk/anthropic');
  return anthropic(model);
}
