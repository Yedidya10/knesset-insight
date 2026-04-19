import { getTranslations } from 'next-intl/server';
import { desc, sql, eq } from 'drizzle-orm';
import {
  Users,
  FileText,
  Vote,
  GitFork,
  Shield,
  Database,
  Activity,
} from 'lucide-react';
import { db } from '@/lib/db';
import {
  members,
  bills,
  votes,
  billClusters,
  integrityCases,
  syncLog,
  adminActivityLog,
} from '@/lib/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function AdminOverviewPage() {
  const t = await getTranslations('admin');

  const [
    totalMembers,
    totalBills,
    totalVotes,
    totalClusters,
    pendingIntegrity,
    syncEntries,
    recentActivity,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(members),
    db.select({ count: sql<number>`count(*)` }).from(bills),
    db.select({ count: sql<number>`count(*)` }).from(votes),
    db.select({ count: sql<number>`count(*)` }).from(billClusters),
    db
      .select({ count: sql<number>`count(*)` })
      .from(integrityCases)
      .where(eq(integrityCases.verified, false)),
    db.select().from(syncLog).orderBy(desc(syncLog.lastSyncAt)),
    db
      .select()
      .from(adminActivityLog)
      .orderBy(desc(adminActivityLog.createdAt))
      .limit(10),
  ]);

  const statCards = [
    {
      key: 'members',
      value: totalMembers[0]?.count ?? 0,
      icon: Users,
    },
    {
      key: 'bills',
      value: totalBills[0]?.count ?? 0,
      icon: FileText,
    },
    {
      key: 'votes',
      value: totalVotes[0]?.count ?? 0,
      icon: Vote,
    },
    {
      key: 'clusters',
      value: totalClusters[0]?.count ?? 0,
      icon: GitFork,
    },
    {
      key: 'pendingIntegrity',
      value: pendingIntegrity[0]?.count ?? 0,
      icon: Shield,
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('overview.title')}</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map(({ key, value, icon: Icon }) => (
          <Card key={key}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="bg-primary/10 rounded-lg p-2">
                <Icon className="text-primary h-5 w-5" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">
                  {t(`overview.${key}`)}
                </p>
                <p className="text-2xl font-bold">
                  {Number(value).toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sync Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {t('overview.syncStatus')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {syncEntries.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t('overview.noSyncData')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-start">
                    <th className="p-2 font-medium">{t('overview.entity')}</th>
                    <th className="p-2 font-medium">
                      {t('overview.lastSync')}
                    </th>
                    <th className="p-2 font-medium">{t('overview.records')}</th>
                    <th className="p-2 font-medium">{t('overview.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {syncEntries.map((entry) => (
                    <tr key={entry.id} className="border-b">
                      <td className="p-2 font-mono text-xs">{entry.entity}</td>
                      <td className="text-muted-foreground p-2">
                        {new Date(entry.lastSyncAt).toLocaleString()}
                      </td>
                      <td className="p-2">
                        {entry.recordCount?.toLocaleString() ?? '—'}
                      </td>
                      <td className="p-2">
                        <Badge
                          variant={
                            entry.status === 'success'
                              ? 'default'
                              : 'destructive'
                          }
                        >
                          {entry.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            {t('overview.recentActivity')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t('overview.noActivity')}
            </p>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{item.action}</p>
                    <p className="text-muted-foreground text-xs">
                      {item.entityType} #{item.entityId}
                    </p>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleString()
                      : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
