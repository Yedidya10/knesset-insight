import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ArrowRight, Gavel } from 'lucide-react';
import { desc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { bills } from '@/lib/db/schema';
import { cached } from '@/lib/cache';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AnimatedSection from '@/components/ui/animated-section';

export default async function ActiveLegislation() {
  const t = await getTranslations('home.activeLegislation');

  let activeBills: {
    id: number;
    name: string;
    status: string | null;
    billType: string | null;
    proposedDate: string | null;
  }[] = [];

  try {
    activeBills = await cached('home:activeLegislation', 300, () =>
      db
        .select({
          id: bills.id,
          name: bills.name,
          status: bills.status,
          billType: bills.billType,
          proposedDate: bills.proposedDate,
        })
        .from(bills)
        .where(
          sql`${bills.status} IS NOT NULL AND ${bills.status} NOT IN ('stopped', 'merged', 'removed')`,
        )
        .orderBy(desc(bills.proposedDate))
        .limit(4),
    );
  } catch (e) {
    console.error('Failed to fetch active legislation:', e);
  }

  if (activeBills.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
      <AnimatedSection>
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-chart-3/10 ring-chart-3/20 flex h-10 w-10 items-center justify-center rounded-xl ring-1">
              <Gavel className="text-chart-3 h-5 w-5" />
            </div>
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              {t('title')}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            render={<Link href="/legislation" />}
          >
            {t('viewAll')}
            <ArrowRight className="ms-1 h-4 w-4 rtl:rotate-180" />
          </Button>
        </div>
      </AnimatedSection>

      <div className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {activeBills.map((bill) => (
          <AnimatedSection key={bill.id}>
            <Link href={`/legislation/${bill.id}`}>
              <Card className="group glass-card hover-lift h-full overflow-hidden">
                <CardContent className="flex flex-col gap-3 p-5">
                  <p className="line-clamp-2 text-sm leading-snug font-medium">
                    {bill.name}
                  </p>

                  <div className="mt-auto flex flex-wrap gap-1.5">
                    {bill.billType && (
                      <Badge variant="secondary" className="text-[10px]">
                        {bill.billType}
                      </Badge>
                    )}
                    {bill.proposedDate && (
                      <span className="text-muted-foreground text-[10px]">
                        {t('proposed')}{' '}
                        {new Date(bill.proposedDate).toLocaleDateString(
                          'he-IL',
                        )}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          </AnimatedSection>
        ))}
      </div>
    </section>
  );
}
