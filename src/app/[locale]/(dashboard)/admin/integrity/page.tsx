import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Globe,
  Landmark,
  ExternalLink,
} from 'lucide-react';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { integrityCases, members } from '@/lib/db/schema';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import IntegrityCaseActions from '@/components/admin/IntegrityCaseActions';

export default async function AdminIntegrityPage() {
  const t = await getTranslations('admin.integrity');

  const [pendingCases, verifiedCount, totalCount, webPendingCount] =
    await Promise.all([
      db
        .select({
          id: integrityCases.id,
          title: integrityCases.title,
          category: integrityCases.category,
          severity: integrityCases.severity,
          status: integrityCases.status,
          memberFirstName: members.firstName,
          memberLastName: members.lastName,
          memberId: integrityCases.memberId,
          aiConfidence: integrityCases.aiConfidence,
          aiSummary: integrityCases.aiSummary,
          eventDate: integrityCases.eventDate,
          verified: integrityCases.verified,
          sourceType: integrityCases.sourceType,
          sourceName: integrityCases.sourceName,
          sourceUrl: integrityCases.sourceUrl,
        })
        .from(integrityCases)
        .innerJoin(members, eq(integrityCases.memberId, members.id))
        .where(eq(integrityCases.verified, false))
        // web_search first (mandatory review), then newest
        .orderBy(
          sql`(${integrityCases.sourceType} = 'web_search') desc`,
          desc(integrityCases.createdAt),
        )
        .limit(50),
      db
        .select({ count: sql<number>`count(*)` })
        .from(integrityCases)
        .where(eq(integrityCases.verified, true)),
      db.select({ count: sql<number>`count(*)` }).from(integrityCases),
      db
        .select({ count: sql<number>`count(*)` })
        .from(integrityCases)
        .where(
          sql`${integrityCases.verified} = false AND ${integrityCases.sourceType} = 'web_search'`,
        ),
    ]);
  const webPending = Number(webPendingCount[0]?.count ?? 0);

  const verified = Number(verifiedCount[0]?.count ?? 0);
  const total = Number(totalCount[0]?.count ?? 0);
  const pending = total - verified;

  const severityColor: Record<string, string> = {
    info: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
    warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    serious: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
    critical: 'bg-red-500/10 text-red-700 dark:text-red-400',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="text-primary h-7 w-7" />
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('pendingCount', { count: pending })}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-muted-foreground text-sm">{t('total')}</p>
              <p className="text-xl font-bold">{total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-muted-foreground text-sm">{t('verified')}</p>
              <p className="text-xl font-bold">{verified}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <XCircle className="h-5 w-5 text-orange-500" />
            <div>
              <p className="text-muted-foreground text-sm">{t('pending')}</p>
              <p className="text-xl font-bold">{pending}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Globe className="h-5 w-5 text-rose-500" />
            <div>
              <p className="text-muted-foreground text-sm">{t('webPending')}</p>
              <p className="text-xl font-bold">{webPending}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Cases */}
      {pendingCases.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground p-8 text-center">
            {t('noPendingCases')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pendingCases.map((caseItem) => {
            const isWeb = caseItem.sourceType === 'web_search';
            return (
              <Card
                key={caseItem.id}
                className={
                  isWeb ? 'border-rose-500/40 dark:border-rose-400/30' : ''
                }
              >
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{caseItem.title}</span>
                        <Badge
                          variant="outline"
                          className={severityColor[caseItem.severity] ?? ''}
                        >
                          {caseItem.severity}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {caseItem.category}
                        </Badge>
                        {isWeb ? (
                          <Badge
                            variant="outline"
                            className="border-rose-500/40 bg-rose-500/10 text-xs text-rose-700 dark:text-rose-300"
                          >
                            <Globe className="me-1 h-3 w-3" />
                            {t('source.web')}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/40 bg-emerald-500/10 text-xs text-emerald-700 dark:text-emerald-300"
                          >
                            <Landmark className="me-1 h-3 w-3" />
                            {t('source.gov')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground text-sm">
                        {caseItem.memberFirstName} {caseItem.memberLastName} ·{' '}
                        {caseItem.eventDate}
                        {caseItem.sourceName && (
                          <span className="opacity-80">
                            {' · '}
                            {caseItem.sourceName}
                          </span>
                        )}
                      </p>
                      {caseItem.aiSummary && (
                        <p className="text-muted-foreground line-clamp-2 text-sm">
                          {caseItem.aiSummary}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-3">
                        {caseItem.aiConfidence != null && (
                          <span className="text-muted-foreground text-xs">
                            AI: {Math.round(caseItem.aiConfidence * 100)}%
                          </span>
                        )}
                        {caseItem.sourceUrl && (
                          <Link
                            href={caseItem.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {t('openSource')}
                          </Link>
                        )}
                      </div>
                    </div>
                    <IntegrityCaseActions caseId={caseItem.id} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
