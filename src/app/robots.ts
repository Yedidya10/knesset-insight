import type { MetadataRoute } from 'next';
import { appConfig } from '../../app.config';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = appConfig.siteUrl;

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
