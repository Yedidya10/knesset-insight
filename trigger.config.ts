import { defineConfig } from '@trigger.dev/sdk';
import { syncVercelEnvVars } from '@trigger.dev/build/extensions/core';

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_ID ?? 'proj_hkevnvacpcbpxluusihh',
  dirs: ['src/trigger'],
  maxDuration: 3600, // 1 hour global max
  build: {
    external: ['file-type'],
    extensions: [syncVercelEnvVars()],
  },
});
