import { defineConfig } from '@trigger.dev/sdk';
import { syncVercelEnvVars } from '@trigger.dev/build/extensions/core';

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_ID ?? 'knesset-insight',
  dirs: ['src/trigger'],
  maxDuration: 3600, // 1 hour global max
  build: {
    extensions: [syncVercelEnvVars()],
  },
});
