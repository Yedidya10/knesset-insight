import { appConfig } from '../../../app.config';

export function getAIModel() {
  const provider = appConfig.ai.provider;
  const model = appConfig.ai.defaultModel;

  switch (provider) {
    case 'gemini': {
      const { google } = require('@ai-sdk/google');
      return google(model);
    }
    case 'openai': {
      const { openai } = require('@ai-sdk/openai');
      return openai(model);
    }
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

export function getFallbackModel() {
  const provider = appConfig.ai.fallbackProvider;
  const model = appConfig.ai.fallbackModel;

  switch (provider) {
    case 'gemini': {
      const { google } = require('@ai-sdk/google');
      return google(model);
    }
    case 'openai': {
      const { openai } = require('@ai-sdk/openai');
      return openai(model);
    }
    default:
      throw new Error(`Unknown AI fallback provider: ${provider}`);
  }
}
