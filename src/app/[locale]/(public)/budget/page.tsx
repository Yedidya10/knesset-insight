import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { Wallet, TrendingUp, Info } from 'lucide-react';
import { desc, sql, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { budgetItems } from '@/lib/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('seo.budget');
  return {
    title: t('title'),
    description: t('description'),
    openGraph: { title: t('title'), description: t('description') },
  };
}

export const dynamic = 'force-dynamic';

function formatBillions(amount: number): string {
  const billions = amount / 1_000_000_000;
  if (billions >= 1) return billions.toFixed(1);
  const millions = amount / 1_000_000;
  return `${millions.toFixed(0)}M`;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function BudgetPage() {
  const t = await getTranslations('budget');

  // Get available years
  const yearsResult = await db
    .selectDistinct({ year: budgetItems.year })
    .from(budgetItems)
    .orderBy(desc(budgetItems.year));

  const years = yearsResult.map((r) => r.year);
  const latestYear = years[0];

  if (!latestYear) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex items-center gap-3">
          <div className="bg-primary/10 text-primary flex h-14 w-14 items-center justify-center rounded-2xl">
            <Wallet className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          </div>
        </div>

        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Wallet className="text-muted-foreground mb-4 h-16 w-16 opacity-30" />
            <p className="text-muted-foreground text-lg">{t('noData')}</p>
            <p className="text-muted-foreground mt-2 text-sm">
              {t('dataNote')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get totals for latest year
  const totals = await db
    .select({
      totalAllocated: sql<number>`coalesce(sum(${budgetItems.amountAllocated}), 0)::bigint`,
      totalUsed: sql<number>`coalesce(sum(${budgetItems.amountUsed}), 0)::bigint`,
      itemCount: sql<number>`count(*)::int`,
    })
    .from(budgetItems)
    .where(eq(budgetItems.year, latestYear));

  const totalAllocated = Number(totals[0]?.totalAllocated ?? 0);
  const totalUsed = Number(totals[0]?.totalUsed ?? 0);
  const itemCount = totals[0]?.itemCount ?? 0;
  const utilizationRate =
    totalAllocated > 0 ? ((totalUsed / totalAllocated) * 100).toFixed(1) : '0';

  // Get top-level items by ministry for the latest year (depth 1 or ministry-based)
  const ministryBreakdown = await db
    .select({
      ministry: budgetItems.ministry,
      allocated: sql<number>`coalesce(sum(${budgetItems.amountAllocated}), 0)::bigint`,
      used: sql<number>`coalesce(sum(${budgetItems.amountUsed}), 0)::bigint`,
      count: sql<number>`count(*)::int`,
    })
    .from(budgetItems)
    .where(eq(budgetItems.year, latestYear))
    .groupBy(budgetItems.ministry)
    .orderBy(desc(sql`coalesce(sum(${budgetItems.amountAllocated}), 0)`))
    .limit(30);

  const ministriesWithData = ministryBreakdown.filter((m) => m.ministry);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex items-start gap-4">
        <div className="bg-primary/10 text-primary flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl">
          <Wallet className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <Badge variant="secondary">{latestYear}</Badge>
            <Badge variant="outline">
              {itemCount} {t('items')}
            </Badge>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="glass-card">
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">
              {t('totalAllocated')}
            </p>
            <p className="mt-1 text-2xl font-bold">
              {t('billions', { value: formatBillions(totalAllocated) })}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">{t('totalUsed')}</p>
            <p className="mt-1 text-2xl font-bold">
              {totalUsed > 0
                ? t('billions', { value: formatBillions(totalUsed) })
                : '—'}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="text-muted-foreground h-4 w-4" />
              <p className="text-muted-foreground text-sm">
                {t('utilizationRate')}
              </p>
            </div>
            <p className="mt-1 text-2xl font-bold">
              {totalUsed > 0 ? `${utilizationRate}%` : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ministry Breakdown Table */}
      {ministriesWithData.length > 0 && (
        <Card className="glass-card mb-8">
          <CardHeader>
            <CardTitle>{t('byMinistry')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('ministry')}</TableHead>
                    <TableHead className="text-end">{t('allocated')}</TableHead>
                    <TableHead className="text-end">{t('used')}</TableHead>
                    <TableHead className="text-end">
                      {t('utilizationRate')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ministriesWithData.map((row) => {
                    const alloc = Number(row.allocated);
                    const used = Number(row.used);
                    const rate =
                      alloc > 0 ? ((used / alloc) * 100).toFixed(1) : '—';
                    return (
                      <TableRow key={row.ministry}>
                        <TableCell className="font-medium">
                          {row.ministry}
                        </TableCell>
                        <TableCell className="text-end">
                          {formatAmount(alloc)}
                        </TableCell>
                        <TableCell className="text-end">
                          {used > 0 ? formatAmount(used) : '—'}
                        </TableCell>
                        <TableCell className="text-end">
                          {rate !== '—' ? `${rate}%` : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data note */}
      <div className="text-muted-foreground flex items-start gap-2 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{t('dataNote')}</p>
      </div>
    </div>
  );
}
