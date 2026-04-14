import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  Users,
  Calendar,
  FileText,
  ExternalLink,
  BarChart3,
} from 'lucide-react';
import { eq, desc, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  committees,
  committeeSessions,
  committeeMembers,
  members,
  factions,
} from '@/lib/db/schema';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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

  // Fetch committee members with attendance stats
  const cmMembers = await db
    .select({
      memberId: committeeMembers.memberId,
      positionId: committeeMembers.positionId,
      dutyDesc: committeeMembers.dutyDesc,
      isCurrent: committeeMembers.isCurrent,
      attendedMeetings: committeeMembers.attendedMeetings,
      protocolMeetings: committeeMembers.protocolMeetings,
      attendancePercent: committeeMembers.attendancePercent,
      firstName: members.firstName,
      lastName: members.lastName,
      imageUrl: members.imageUrl,
      factionName: factions.name,
    })
    .from(committeeMembers)
    .innerJoin(members, eq(committeeMembers.memberId, members.id))
    .leftJoin(factions, eq(members.factionId, factions.id))
    .where(
      and(
        eq(committeeMembers.committeeId, committeeId),
        eq(committeeMembers.isCurrent, true),
      ),
    )
    .orderBy(committeeMembers.positionId, members.lastName);

  // Separate chair (41) from regular members
  const chair = cmMembers.find((m) => m.positionId === 41);
  const regularMembers = cmMembers.filter((m) => m.positionId !== 41);

  // Calculate average attendance for the committee
  const membersWithAttendance = cmMembers.filter(
    (m) => m.attendancePercent != null,
  );
  const avgAttendance =
    membersWithAttendance.length > 0
      ? Math.round(
          membersWithAttendance.reduce(
            (sum, m) => sum + (m.attendancePercent ?? 0),
            0,
          ) / membersWithAttendance.length,
        )
      : null;

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
                <span className="text-muted-foreground">{t('members')}</span>
                <span className="font-medium">{cmMembers.length}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('sessions')}</span>
                <span className="font-medium">{sessions.length}</span>
              </div>
              {avgAttendance != null && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {tDetail('avgAttendance')}
                    </span>
                    <span className="font-medium">{avgAttendance}%</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Committee Members */}
          {cmMembers.length > 0 && (
            <Card className="glass-card overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="text-muted-foreground h-5 w-5" />
                  {tDetail('committeeMembers')}
                  <Badge variant="secondary" className="ms-auto">
                    {cmMembers.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {/* Chair first */}
                  {chair && (
                    <CommitteeMemberRow
                      member={chair}
                      isChair
                      tDetail={tDetail}
                    />
                  )}
                  {chair && regularMembers.length > 0 && (
                    <Separator className="my-3" />
                  )}
                  {regularMembers.map((m) => (
                    <CommitteeMemberRow
                      key={m.memberId}
                      member={m}
                      tDetail={tDetail}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sessions */}
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

// ──────────────────────────────────────
// Committee Member Row
// ──────────────────────────────────────

function AttendanceBar({ percent }: { percent: number }) {
  const color =
    percent >= 70
      ? 'bg-green-500'
      : percent >= 40
        ? 'bg-amber-500'
        : 'bg-red-500';
  return (
    <div className="bg-muted h-2 w-16 overflow-hidden rounded-full">
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

interface CommitteeMemberRowProps {
  member: {
    memberId: number;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
    factionName: string | null;
    dutyDesc: string | null;
    attendedMeetings: number | null;
    protocolMeetings: number | null;
    attendancePercent: number | null;
  };
  isChair?: boolean;
  tDetail: (key: string) => string;
}

function CommitteeMemberRow({
  member,
  isChair,
  tDetail,
}: CommitteeMemberRowProps) {
  return (
    <Link
      href={`/members/${member.memberId}`}
      className="hover:bg-muted/50 flex items-center gap-3 rounded-lg p-2 transition-colors"
    >
      <MemberAvatar
        member={{
          firstName: member.firstName,
          lastName: member.lastName,
          imageUrl: member.imageUrl,
        }}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">
            {member.firstName} {member.lastName}
          </span>
          {isChair && (
            <Badge className="bg-primary/15 text-primary text-xs">
              {tDetail('chair')}
            </Badge>
          )}
        </div>
        {member.factionName && (
          <p className="text-muted-foreground truncate text-xs">
            {member.factionName}
          </p>
        )}
      </div>
      {member.attendancePercent != null && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={<div className="flex shrink-0 items-center gap-2" />}
            >
              <AttendanceBar percent={member.attendancePercent} />
              <span className="text-muted-foreground w-10 text-end text-xs">
                {Math.round(member.attendancePercent)}%
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {tDetail('attended')}: {member.attendedMeetings ?? 0}/
                {member.protocolMeetings ?? 0}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </Link>
  );
}
