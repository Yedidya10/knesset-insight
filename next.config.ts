import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import withSerwistInit from '@serwist/next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const withSerwist = withSerwistInit({
  swSrc: 'src/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig: NextConfig = {
  images: {
    qualities: [75, 80],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'oknesset.org',
      },
      {
        protocol: 'https',
        hostname: 'production.oknesset.org',
      },
      {
        protocol: 'https',
        hostname: 'commons.wikimedia.org',
      },
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
      },
      {
        protocol: 'https',
        hostname: 'knesset.gov.il',
      },
      {
        protocol: 'https',
        hostname: 'main.knesset.gov.il',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/:locale/factions',
        destination: '/:locale/politics?tab=factions',
        permanent: true,
      },
      {
        source: '/:locale/parties',
        destination: '/:locale/politics?tab=parties',
        permanent: true,
      },
      {
        source: '/:locale/political-groups',
        destination: '/:locale/politics?tab=groups',
        permanent: true,
      },
      {
        source: '/:locale/political-groups/timeline',
        destination: '/:locale/politics?tab=timeline',
        permanent: true,
      },
      {
        source: '/:locale/political-groups/graph',
        destination: '/:locale/politics?tab=graph',
        permanent: true,
      },
    ];
  },
};

export default withSerwist(withNextIntl(nextConfig));
