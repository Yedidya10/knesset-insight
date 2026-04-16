import { getTranslations, getLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { Target, Search } from 'lucide-react';
import { desc, eq, sql, ilike, and } from 'drizzle-orm';
import { Link } from '@/i18n/navigation';
import { db } from '@/lib/db';
import { policyStances } from '@/lib/db/schema';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import PaginationNav from '@/components/ui/pagination-nav';
import {
  POLICY_DOMAINS,
  type PolicyDomain,
  POLICY_DOMAIN_LIST,
} from '@/lib/knesset/policy-domains';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('seo.policies');
  return {
    title: t('title'),
    description: t('description'),
    openGraph: { title: t('title'), description: t('description') },
  };
}

interface Props {
  searchParams: Promise<{
    domain?: string;
    type?: string;
    search?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 50;

export const dynamic = 'force-dynamic';

export default async function PoliciesPage({ searchParams }: Props) {
  const t = await getTranslations('policies');
  const tCommon = await getTranslations('common');
  const locale = (await getLocale()) as 'he' | 'en' | 'ar' | 'ru';
  const params = await searchParams;
  const domainFilter = params.domain ?? '';
  const typeFilter = params.type ?? '';
  const searchQuery = params.search ?? '';
  const page = Math.max(1, Number(params.page ?? '1'));
  const offset = (page - 1) * PAGE_SIZE;

  const conditions = [eq(policyStances.isActive, true)];
  if (domainFilter && POLICY_DOMAIN_LIST.includes(domainFilter as PolicyDomain))
    conditions.push(eq(policyStances.domain, domainFilter));
  if (typeFilter === 'direct' || typeFilter === 'derived')
    conditions.push(eq(policyStances.stanceType, typeFilter));
  if (searchQuery)
    conditions.push(
      ilike(sql`${policyStances.label}->>'he'`, `%${searchQuery}%`),
    );

  const whereClause = and(...conditions);

  const [data, countResult] = await Promise.all([
    db
      .select({
        id: policyStances.id,
        label: policyStances.label,
        description: policyStances.description,
        domain: policyStances.domain,
        stanceType: policyStances.stanceType,
        voteCount: policyStances.voteCount,
      })
      .from(policyStances)
      .where(whereClause)
      .orderBy(desc(policyStances.voteCount))
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(policyStances)
      .where(whereClause),
  ]);

  const totalCount = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="bg-primary/10 ring-primary/20 flex h-14 w-14 items-center justify-center rounded-2xl ring-1">
          <Target className="text-primary h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t('title')}
          </h1>
          <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        <form method="get" className="flex items-center gap-2">
          <div className="relative">
            <Search className="text-muted-foreground absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input
              type="text"
              name="search"
              defaultValue={searchQuery}
              placeholder={t('searchPlaceholder')}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring h-9 rounded-md border ps-9 pe-3 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            />
          </div>
          <select
            name="domain"
            defaultValue={domainFilter}
            className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <option value="">{t('allDomains')}</option>
            {POLICY_DOMAIN_LIST.map((d) => (
              <option key={d} value={d}>
                {POLICY_DOMAINS[d][locale]}
              </option>
            ))}
          </select>
          <select
            name="type"
            defaultValue={typeFilter}
            className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <option value="">{t('allTypes')}</option>
            <option value="direct">{t('stanceType.direct')}</option>
            <option value="derived">{t('stanceType.derived')}</option>
          </select>
          <button
            type="submit"
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 rounded-md px-4 text-sm font-medium"
          >
            <Search className="h-4 w-4" />
          </button>
        </form>
      </div>

      {data.length > 0 ? (
        <>
          <div className="stagger-children space-y-3">
            {data.map((stance) => {
              const label =
                (stance.label as Record<string, string>)?.[locale] ??
                (stance.label as Record<string, string>)?.he ??
                '';
              const description =
                (stance.description as Record<string, string>)?.[locale] ??
                (stance.description as Record<string, string>)?.he;
              const domainLabel = stance.domain
                ? POLICY_DOMAINS[stance.domain as PolicyDomain]?.[locale]
                : null;

              return (
                <Link key={stance.id} href={`/policies/${stance.id}`}>
                  <Card className="glass-card hover-lift border-s-primary/30 overflow-hidden border-s-4">
                    <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="leading-tight font-semibold">{label}</h3>
                        {description && (
                          <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                            {description}
                          </p>
                        )}
                        <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                          <span>
                            {t('voteCount', {
                              count: stance.voteCount ?? 0,
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {domainLabel && (
                          <Badge variant="outline">{domainLabel}</Badge>
                        )}
                        <Badge
                          variant={
                            stance.stanceType === 'derived'
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {t(`stanceType.${stance.stanceType}`)}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>

          <PaginationNav
            currentPage={page}
            totalPages={totalPages}
            buildPageUrl={(p) => {
              const urlParams = new URLSearchParams();
              if (domainFilter) urlParams.set('domain', domainFilter);
              if (typeFilter) urlParams.set('type', typeFilter);
              if (searchQuery) urlParams.set('search', searchQuery);
              if (p > 1) urlParams.set('page', String(p));
              const qs = urlParams.toString();
              return `/policies${qs ? `?${qs}` : ''}`;
            }}
            previousLabel={tCommon('previous')}
            nextLabel={tCommon('next')}
          />
        </>
      ) : (
        <div className="text-muted-foreground mt-16 flex flex-col items-center gap-3">
          <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-2xl">
            <Target className="h-8 w-8 opacity-40" />
          </div>
          <p className="text-sm">{t('noResults')}</p>
        </div>
      )}
    </div>
  );
}
