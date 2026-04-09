import { getTranslations } from 'next-intl/server';
import { Activity } from 'lucide-react';
import { desc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { adminActivityLog } from '@/lib/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function AdminActivityPage() {
  const t = await getTranslations('admin.activity');

  const [entries, countResult] = await Promise.all([
    db
      .select()
      .from(adminActivityLog)
      .orderBy(desc(adminActivityLog.createdAt))
      .limit(50),
    db.select({ count: sql<number>`count(*)` }).from(adminActivityLog),
  ]);

  const total = Number(countResult[0]?.count ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('totalActions', { count: total })}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('recentActions')}</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noActivity')}</p>
          ) : (
            <div className="space-y-2">
              {entries.map((item) => {
                const details = item.details as Record<string, unknown> | null;
                return (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-md border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs font-mono">
                          {item.action}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {item.entityType} #{item.entityId}
                        </Badge>
                      </div>
                      {details?.reason ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {String(details.reason)}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {item.createdAt
                        ? new Date(item.createdAt).toLocaleString()
                        : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
