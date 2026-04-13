import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Users, Calendar, FileText, ExternalLink } from 'lucide-react';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { committees, committeeSessions, members } from '@/lib/db/schema';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import MemberAvatar from '@/components/members/MemberAvatar';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const committeeId = Number(id);
  if (isNaN(committeeId)) return {};

  const [committee] = await db
    .select({ name: committees.name })
    .from(committees)
    .where(eq(committees.id, committeeId))
    .limit(1);

  if (!committee) return {};

  const t = await getTranslations('seo.committees.detail');
  return {
    title: t('title', { name: committee.name }),
    description: t('description', { name: committee.name }),
    openGraph: {
      title: t('title', { name: committee.name }),
      description: t('description', { name: committee.name }),
    },
  };
}

export default async function CommitteeDetailPage({ params }: Props) {
  const { id } = await params;
  const committeeId = Number(id);
  if (isNaN(committeeId)) notFound();

  const t = await getTranslations('committees');
  const tDetail = await getTranslations('committees.detail');

  // Fetch committee with chairman
  const [committee] = await db
    .select({
      id: committees.id,
      name: committees.name,
      committeeType: committees.committeeType,
      knessetNum: committees.knessetNum,
      isActive: committees.isActive,
      chairmanId: committees.chairmanId,
      chairmanFirstName: members.firstName,
      chairmanLastName: members.lastName,
      chairmanImageUrl: members.imageUrl,
    })
    .from(committees)
    .leftJoin(members, eq(committees.chairmanId, members.id))
    .where(eq(committees.id, committeeId))
    .limit(1);

  if (!committee) notFound();

  // Fetch recent sessions
  const sessions = await db
    .select({
      id: committeeSessions.id,
      sessionDate: committeeSessions.sessionDate,
      title: committeeSessions.title,
      protocolUrl: committeeSessions.protocolUrl,
      topics: committeeSessions.topics,
    })
    .from(committeeSessions)
    .where(eq(committeeSessions.committeeId, committeeId))
    .orderBy(desc(committeeSessions.sessionDate))
    .limit(30);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex items-start gap-4">
        <div className="bg-primary/10 ring-primary/20 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-1">
          <Users className="text-primary h-7 w-7" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {committee.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {committee.isActive ? (
              <Badge className="bg-green-500/15 text-green-700 dark:text-green-400">
                {t('active')}
              </Badge>
            ) : (
              <Badge variant="secondary">{t('inactive')}</Badge>
            )}
            {committee.committeeType && (
              <Badge variant="outline">{committee.committeeType}</Badge>
            )}
            {committee.knessetNum && (
              <Badge variant="secondary">
                {t('knesset')} {committee.knessetNum}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sidebar */}
        <div className="space-y-6 lg:col-span-1">
          {/* Chairman Card */}
          {committee.chairmanId && (
            <Card className="glass-card overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  {tDetail('chairman')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/members/${committee.chairmanId}`}
                  className="hover:bg-muted/50 flex items-center gap-3 rounded-lg p-2 transition-colors"
                >
                  <MemberAvatar
                    member={{
                      firstName: committee.chairmanFirstName,
                      lastName: committee.chairmanLastName,
                      imageUrl: committee.chairmanImageUrl,
                    }}
                    size="md"
                  />
                  <span className="font-medium">
                    {committee.chairmanFirstName} {committee.chairmanLastName}
                  </span>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Info Card */}
          <Card className="glass-card overflow-hidden">
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{tDetail('type')}</span>
                <span className="font-medium">
                  {committee.committeeType ?? '—'}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {tDetail('status')}
                </span>
                <span className="font-medium">
                  {committee.isActive ? t('active') : t('inactive')}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('sessions')}</span>
                <span className="font-medium">{sessions.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content — Sessions */}
        <div className="lg:col-span-2">
          <Card className="glass-card overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="text-muted-foreground h-5 w-5" />
                {tDetail('recentSessions')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  {tDetail('noSessions')}
                </p>
              ) : (
                <div className="space-y-4">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className="hover:bg-muted/30 rounded-lg border p-4 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          {session.title && (
                            <p className="leading-snug font-medium">
                              {session.title}
                            </p>
                          )}
                          {session.sessionDate && (
                            <p className="text-muted-foreground mt-1 text-sm">
                              <Calendar className="me-1 inline h-3.5 w-3.5" />
                              {new Date(session.sessionDate).toLocaleDateString(
                                'he-IL',
                              )}
                            </p>
                          )}
                        </div>
                        {session.protocolUrl && (
                          <a
                            href={session.protocolUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-primary/10 text-primary hover:bg-primary/20 flex shrink-0 items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            {tDetail('viewProtocol')}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      {session.topics && session.topics.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {session.topics.map((topic, i) => (
                            <Badge
                              key={i}
                              variant="secondary"
                              className="text-xs"
                            >
                              {topic}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
