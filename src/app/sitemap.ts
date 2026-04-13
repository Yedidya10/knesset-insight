import type { MetadataRoute } from 'next';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { members, bills, governments, committees } from '@/lib/db/schema';
import { routing } from '@/i18n/routing';
import { appConfig } from '../../app.config';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = appConfig.siteUrl;
  const locales = routing.locales;

  const entries: MetadataRoute.Sitemap = [];

  // Static pages
  const staticPages = [
    '',
    '/members',
    '/legislation',
    '/committees',
    '/politics',
    '/elections',
    '/governments',
    '/budget',
  ];

  for (const page of staticPages) {
    for (const locale of locales) {
      entries.push({
        url: `${baseUrl}/${locale}${page}`,
        lastModified: new Date(),
        changeFrequency: page === '' ? 'daily' : 'weekly',
        priority: page === '' ? 1.0 : 0.8,
      });
    }
  }

  // Dynamic pages: members
  try {
    const memberIds = await db
      .select({ id: members.id })
      .from(members)
      .where(sql`${members.isCurrent} = true`);

    for (const m of memberIds) {
      for (const locale of locales) {
        entries.push({
          url: `${baseUrl}/${locale}/members/${m.id}`,
          changeFrequency: 'weekly',
          priority: 0.7,
        });
      }
    }
  } catch {
    // DB not available during build
  }

  // Dynamic pages: bills (last 500 most recent)
  try {
    const billIds = await db
      .select({ id: bills.id })
      .from(bills)
      .orderBy(sql`${bills.id} desc`)
      .limit(500);

    for (const b of billIds) {
      for (const locale of locales) {
        entries.push({
          url: `${baseUrl}/${locale}/legislation/${b.id}`,
          changeFrequency: 'monthly',
          priority: 0.6,
        });
      }
    }
  } catch {
    // DB not available during build
  }

  // Dynamic pages: governments
  try {
    const govs = await db
      .select({ governmentNum: governments.governmentNum })
      .from(governments);

    for (const g of govs) {
      for (const locale of locales) {
        entries.push({
          url: `${baseUrl}/${locale}/governments/${g.governmentNum}`,
          changeFrequency: 'yearly',
          priority: 0.5,
        });
      }
    }
  } catch {
    // DB not available during build
  }

  return entries;
}
