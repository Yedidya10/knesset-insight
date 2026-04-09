import { getTranslations } from 'next-intl/server';
import { Database, CheckCircle2, XCircle } from 'lucide-react';
import { desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { syncLog } from '@/lib/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function AdminSyncPage() {
  const t = await getTranslations('admin.sync');

  const entries = await db.select().from(syncLog).orderBy(desc(syncLog.lastSyncAt));

  const successCount = entries.filter((e) => e.status === 'success').length;
  const failedCount = entries.filter((e) => e.status === 'failed').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Database className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Database className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">{t('totalEntities')}</p>
              <p className="text-xl font-bold">{entries.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">{t('successful')}</p>
              <p className="text-xl font-bold">{successCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <XCircle className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-sm text-muted-foreground">{t('failed')}</p>
              <p className="text-xl font-bold">{failedCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('entities')}</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noData')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-start">
                    <th className="p-2 font-medium">{t('entity')}</th>
                    <th className="p-2 font-medium">{t('lastSync')}</th>
                    <th className="p-2 font-medium">{t('records')}</th>
                    <th className="p-2 font-medium">{t('status')}</th>
                    <th className="p-2 font-medium">{t('error')}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b">
                      <td className="p-2 font-mono text-xs">{entry.entity}</td>
                      <td className="p-2 text-muted-foreground">
                        {new Date(entry.lastSyncAt).toLocaleString()}
                      </td>
                      <td className="p-2">
                        {entry.recordCount?.toLocaleString() ?? '—'}
                      </td>
                      <td className="p-2">
                        <Badge
                          variant={
                            entry.status === 'success' ? 'default' : 'destructive'
                          }
                        >
                          {entry.status}
                        </Badge>
                      </td>
                      <td className="p-2 max-w-xs truncate text-xs text-muted-foreground">
                        {entry.errorMessage ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
