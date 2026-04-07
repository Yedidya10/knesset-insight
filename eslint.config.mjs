import { dirname } from 'path';
import { fileURLToPath } from 'url';
import nextConfig from 'eslint-config-next';

const __dirname = dirname(fileURLToPath(import.meta.url));

const eslintConfig = [
  { ignores: ['.next/', 'node_modules/', 'public/sw.js'] },
  ...nextConfig.map((config) => ({
    ...config,
    settings: {
      ...config.settings,
      next: { rootDir: __dirname },
    },
  })),
];

export default eslintConfig;
