import { getTranslations } from 'next-intl/server';
import { Gavel } from 'lucide-react';
import { desc, eq, sql } from 'drizzle-orm';
import { Link } from '@/i18n/navigation';
import { db } from '@/lib/db';
import { bills } from '@/lib/db/schema';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import TranslatedText from '@/components/ui/translated-text';
import PaginationNav from '@/components/ui/pagination-nav';

interface Props {
  searchParams: Promise<{ knesset?: string; type?: string; page?: string }>;
}

const PAGE_SIZE = 50;

export default async function LegislationPage({ searchParams }: Props) {
  const t = await getTranslations('legislation');
  const tCommon = await getTranslations('common');
  const params = await searchParams;
  const knessetNum = params.knesset ? Number(params.knesset) : undefined;
  const billType = params.type ?? '';
  const page = Math.max(1, Number(params.page ?? '1'));
  const offset = (page - 1) * PAGE_SIZE;

  const conditions = [];
  if (knessetNum) conditions.push(eq(bills.knessetNum, knessetNum));
  if (billType) conditions.push(eq(bills.billType, billType));

  const whereClause = conditions.length
    ? sql.join(conditions, sql` AND `)
    : undefined;

  const [data, countResult] = await Promise.all([
    db
      .select({
        id: bills.id,
        knessetId: bills.knessetId,
        name: bills.name,
        status: bills.status,
        billType: bills.billType,
        knessetNum: bills.knessetNum,
        proposedDate: bills.proposedDate,
      })
      .from(bills)
      .where(whereClause)
      .orderBy(desc(bills.knessetId))
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(bills)
      .where(whereClause),
  ]);

  const totalCount = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Distinct bill types for filter
  const billTypes = await db
    .selectDistinct({ billType: bills.billType })
    .from(bills)
    .where(sql`${bills.billType} IS NOT NULL`)
    .orderBy(bills.billType);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
          <Gavel className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount.toLocaleString()} {t('title')}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        {[25, 24, 23].map((k) => {
          const isActive = knessetNum === k;
          const href = isActive ? '/legislation' : `/legislation?knesset=${k}`;
          return (
            <Link key={k} href={href}>
              <Badge variant={isActive ? 'default' : 'outline'} className="cursor-pointer rounded-xl transition-colors">
                {t('knesset')} {k}
              </Badge>
            </Link>
          );
        })}
        {billTypes.map(
          (bt) =>
            bt.billType && (
              <Link
                key={bt.billType}
                href={
                  billType === bt.billType
                    ? '/legislation'
                    : `/legislation?type=${encodeURIComponent(bt.billType)}`
                }
              >
                <Badge
                  variant={billType === bt.billType ? 'default' : 'outline'}
                  className="cursor-pointer rounded-xl transition-colors"
                >
                  {bt.billType}
                </Badge>
              </Link>
            ),
        )}
      </div>

      {data.length > 0 ? (
        <>
          <div className="space-y-3 stagger-children">
            {data.map((bill) => (
              <Link key={bill.id} href={`/legislation/${bill.id}`}>
                <Card className="glass-card hover-lift overflow-hidden">
                  <CardContent className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold leading-tight"><TranslatedText text={bill.name} /></h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        {bill.proposedDate && (
                          <span>
                            {new Date(bill.proposedDate).toLocaleDateString('he-IL')}
                          </span>
                        )}
                        {bill.knessetNum && <span>• {t('knesset')} {bill.knessetNum}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {bill.billType && (
                        <Badge variant="outline"><TranslatedText text={bill.billType} /></Badge>
                      )}
                      {bill.status && (
                        <Badge variant="secondary"><TranslatedText text={bill.status} /></Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          <PaginationNav
            currentPage={page}
            totalPages={totalPages}
            buildPageUrl={(p) => {
              const urlParams = new URLSearchParams();
              if (knessetNum) urlParams.set('knesset', String(knessetNum));
              if (billType) urlParams.set('type', billType);
              if (p > 1) urlParams.set('page', String(p));
              const qs = urlParams.toString();
              return `/legislation${qs ? `?${qs}` : ''}`;
            }}
            previousLabel={tCommon('previous')}
            nextLabel={tCommon('next')}
          />
        </>
      ) : (
        <div className="mt-16 flex flex-col items-center gap-3 text-muted-foreground">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Gavel className="h-8 w-8 opacity-40" />
          </div>
          <p className="text-sm">{t('noResults')}</p>
        </div>
      )}
    </div>
  );
}
