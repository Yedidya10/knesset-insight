import { getTranslations } from 'next-intl/server';
import { Gavel } from 'lucide-react';
import { desc, eq, sql } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/lib/db';
import { bills } from '@/lib/db/schema';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Props {
  searchParams: Promise<{ knesset?: string; type?: string; page?: string }>;
}

const PAGE_SIZE = 50;

export default async function LegislationPage({ searchParams }: Props) {
  const t = await getTranslations('legislation');
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
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Gavel className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount.toLocaleString()} {t('title')}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        {[25, 24, 23].map((k) => {
          const isActive = knessetNum === k;
          const href = isActive ? '/legislation' : `/legislation?knesset=${k}`;
          return (
            <Link key={k} href={href}>
              <Badge variant={isActive ? 'default' : 'outline'} className="cursor-pointer">
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
                  className="cursor-pointer"
                >
                  {bt.billType}
                </Badge>
              </Link>
            ),
        )}
      </div>

      {data.length > 0 ? (
        <>
          <div className="space-y-3">
            {data.map((bill) => (
              <Link key={bill.id} href={`/legislation/${bill.id}`}>
                <Card className="border-border/60 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
                  <CardContent className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold leading-tight">{bill.name}</h3>
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
                        <Badge variant="outline">{bill.billType}</Badge>
                      )}
                      {bill.status && (
                        <Badge variant="secondary">{bill.status}</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-4">
              {page > 1 && (
                <Link
                  href={`/legislation?${new URLSearchParams({
                    ...(knessetNum ? { knesset: String(knessetNum) } : {}),
                    ...(billType ? { type: billType } : {}),
                    page: String(page - 1),
                  }).toString()}`}
                >
                  <Badge variant="outline" className="cursor-pointer px-4 py-2">
                    ←
                  </Badge>
                </Link>
              )}
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={`/legislation?${new URLSearchParams({
                    ...(knessetNum ? { knesset: String(knessetNum) } : {}),
                    ...(billType ? { type: billType } : {}),
                    page: String(page + 1),
                  }).toString()}`}
                >
                  <Badge variant="outline" className="cursor-pointer px-4 py-2">
                    →
                  </Badge>
                </Link>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="mt-12 flex flex-col items-center gap-2 text-muted-foreground">
          <Gavel className="h-12 w-12 opacity-20" />
          <p className="text-sm">{t('noResults')}</p>
        </div>
      )}
    </div>
  );
}
