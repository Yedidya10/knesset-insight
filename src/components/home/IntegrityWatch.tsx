import { getTranslations } from 'next-intl/server';
import { Shield, Briefcase, UserCheck } from 'lucide-react';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { cached } from '@/lib/cache';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import AnimatedSection from '@/components/ui/animated-section';

export default async function IntegrityWatch() {
  const t = await getTranslations('home.integrity');

  let stats = {
    totalCases: 0,
    corporateLinks: 0,
    lobbyistMeetings: 0,
    bySeverity: [] as { severity: string; count: number }[],
  };

  try {
    stats = await cached('home:integrityWatch', 300, async () => {
      const [
        [{ count: casesCount }],
        [{ count: corpCount }],
        [{ count: lobbyCount }],
        severityBreakdown,
      ] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(sql`integrity_cases`),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(sql`member_corporate_affiliations`),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(sql`member_lobbyist_connections`),
        db
          .select({
            severity: sql<string>`severity`,
            count: sql<number>`count(*)::int`,
          })
          .from(sql`integrity_cases`)
          .groupBy(sql`severity`),
      ]);

      return {
        totalCases: casesCount,
        corporateLinks: corpCount,
        lobbyistMeetings: lobbyCount,
        bySeverity: severityBreakdown,
      };
    });
  } catch (e) {
    console.error('Failed to fetch integrity stats:', e);
  }

  if (
    stats.totalCases === 0 &&
    stats.corporateLinks === 0 &&
    stats.lobbyistMeetings === 0
  ) {
    return null;
  }

  const severityColors: Record<string, string> = {
    info: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    serious: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
    critical: 'bg-red-500/15 text-red-600 dark:text-red-400',
  };

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
      <AnimatedSection>
        <div className="mb-6 flex items-center gap-3">
          <div className="bg-destructive/10 ring-destructive/20 flex h-10 w-10 items-center justify-center rounded-xl ring-1">
            <Shield className="text-destructive h-5 w-5" />
          </div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            {t('title')}
          </h2>
        </div>
      </AnimatedSection>

      <div className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Cases */}
        <AnimatedSection>
          <Card className="glass-card overflow-hidden">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="bg-destructive/10 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
                <Shield className="text-destructive h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalCases}</p>
                <p className="text-muted-foreground text-xs">{t('cases')}</p>
              </div>
            </CardContent>
          </Card>
        </AnimatedSection>

        {/* Corporate Links */}
        <AnimatedSection>
          <Card className="glass-card overflow-hidden">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="bg-chart-4/10 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
                <Briefcase className="text-chart-4 h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.corporateLinks}</p>
                <p className="text-muted-foreground text-xs">
                  {t('corporateLinks')}
                </p>
              </div>
            </CardContent>
          </Card>
        </AnimatedSection>

        {/* Lobbyist Meetings */}
        <AnimatedSection>
          <Card className="glass-card overflow-hidden">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="bg-chart-5/10 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
                <UserCheck className="text-chart-5 h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.lobbyistMeetings}</p>
                <p className="text-muted-foreground text-xs">
                  {t('lobbyistMeetings')}
                </p>
              </div>
            </CardContent>
          </Card>
        </AnimatedSection>
      </div>

      {/* Severity Breakdown */}
      {stats.bySeverity.length > 0 && (
        <AnimatedSection delay={0.2}>
          <div className="mt-4 flex flex-wrap gap-2">
            {stats.bySeverity.map(({ severity, count }) => (
              <Badge
                key={severity}
                variant="outline"
                className={`${severityColors[severity] || ''} border-0 text-xs`}
              >
                {t(
                  `severity.${severity}` as
                    | 'severity.info'
                    | 'severity.warning'
                    | 'severity.serious'
                    | 'severity.critical',
                )}
                : {count}
              </Badge>
            ))}
          </div>
        </AnimatedSection>
      )}
    </section>
  );
}
