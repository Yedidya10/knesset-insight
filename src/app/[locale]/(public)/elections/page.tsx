import { getTranslations } from 'next-intl/server';
import { Vote } from 'lucide-react';
import { sql, eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { electoralLists } from '@/lib/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Link } from '@/i18n/navigation';
import { appConfig } from '../../../../../app.config';

interface Props {
  searchParams: Promise<{ knesset?: string }>;
}

export default async function ElectionsPage({ searchParams }: Props) {
  const t = await getTranslations('elections');
  const params = await searchParams;
  const knessetFilter = params.knesset ? Number(params.knesset) : null;

  // Get distinct knesset numbers that have electoral lists
  const knessetNums = await db
    .selectDistinct({ knessetNum: electoralLists.knessetNum })
    .from(electoralLists)
    .orderBy(desc(electoralLists.knessetNum));
  const availableKnessets = knessetNums.map((k) => k.knessetNum);

  const activeKnesset = knessetFilter ?? (availableKnessets[0] || appConfig.knesset.syncKnessets[0]);

  // Fetch electoral lists for the selected knesset
  const data = await db
    .select({
      id: electoralLists.id,
      name: electoralLists.name,
      ballotLetters: electoralLists.ballotLetters,
      knessetNum: electoralLists.knessetNum,
      totalVotes: electoralLists.totalVotes,
      votePercentage: electoralLists.votePercentage,
      seats: electoralLists.seats,
      isElected: electoralLists.isElected,
    })
    .from(electoralLists)
    .where(eq(electoralLists.knessetNum, activeKnesset))
    .orderBy(desc(electoralLists.seats));

  const maxSeats = Math.max(...data.map((d) => d.seats), 1);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
          <Vote className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
        </div>
      </div>

      {/* Knesset tabs */}
      {availableKnessets.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-1 rounded-xl bg-muted/60 p-1 backdrop-blur-sm">
          {availableKnessets.map((num) => (
            <Link
              key={num}
              href={`/elections${num === availableKnessets[0] ? '' : `?knesset=${num}`}`}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                activeKnesset === num
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('knesset', { num })}
            </Link>
          ))}
        </div>
      )}

      {data.length > 0 ? (
        <div className="space-y-3">
          {/* Header row */}
          <div className="hidden items-center gap-4 px-4 text-xs font-medium text-muted-foreground sm:flex">
            <span className="w-16">{t('ballotLetters')}</span>
            <span className="flex-1">{t('listName')}</span>
            <span className="w-24 text-end">{t('totalVotes')}</span>
            <span className="w-16 text-end">{t('percentage')}</span>
            <span className="w-16 text-end">{t('seats')}</span>
          </div>

          {data.map((list) => (
            <Link key={list.id} href={`/elections/${list.id}`}>
              <Card
                className={`glass-card hover-lift overflow-hidden transition-colors ${
                  list.isElected
                    ? 'border-s-4 border-s-green-500/50'
                    : 'border-s-4 border-s-muted/30'
                }`}
              >
                <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4">
                  <span className="w-16 text-center font-mono text-lg font-bold text-primary">
                    {list.ballotLetters}
                  </span>
                  <div className="flex-1">
                    <span className="font-medium">{list.name}</span>
                    <div className="mt-1 sm:hidden">
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        {list.totalVotes && (
                          <span>{list.totalVotes.toLocaleString()} {t('totalVotes').toLowerCase()}</span>
                        )}
                        {list.votePercentage && <span>{list.votePercentage}%</span>}
                      </div>
                    </div>
                  </div>
                  <span className="hidden w-24 text-end text-sm sm:block">
                    {list.totalVotes?.toLocaleString() ?? '—'}
                  </span>
                  <span className="hidden w-16 text-end text-sm sm:block">
                    {list.votePercentage ? `${list.votePercentage}%` : '—'}
                  </span>
                  <div className="flex w-32 items-center gap-2">
                    <Progress
                      value={(list.seats / maxSeats) * 100}
                      className="h-2 flex-1"
                    />
                    <span className="w-8 text-end text-sm font-bold">
                      {list.seats}
                    </span>
                  </div>
                  {list.isElected ? (
                    <Badge variant="default" className="w-auto shrink-0">{t('elected')}</Badge>
                  ) : (
                    <Badge variant="outline" className="w-auto shrink-0">{t('notElected')}</Badge>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <p className="py-12 text-center text-muted-foreground">{t('noResults')}</p>
      )}
    </div>
  );
}
