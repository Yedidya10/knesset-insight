import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  Users,
  Calendar,
  FileText,
  ExternalLink,
  Clock,
  History,
} from 'lucide-react';
import { eq, desc, and, sql } from 'drizzle-orm';
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
import {
  SUPPORTED_COMMITTEE_KNESSETS,
  dedupeCommitteeMembers,
  type DedupedCommitteeMember,
} from '@/lib/committees/scope';

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

  if (
    committee.knessetNum == null ||
    !(SUPPORTED_COMMITTEE_KNESSETS as readonly number[]).includes(
      committee.knessetNum,
    )
  ) {
    notFound();
  }

  // Fetch recent sessions (for display)
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

  // Count total sessions (independent of display limit)
  const [{ total: totalSessions } = { total: 0 }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(committeeSessions)
    .where(eq(committeeSessions.committeeId, committeeId));

  // Compute the effective "tracked meetings" count from attendance data:
  // Use the maximum protocol_meetings among current members (the longest-serving
  // member covers the widest window, giving us the committee's total tracked meetings).
  const [
    { trackedMeetings: trackedMeetingsCount } = { trackedMeetings: null },
  ] = await db
    .select({
      trackedMeetings: sql<
        number | null
      >`max(${committeeMembers.protocolMeetings})`,
    })
    .from(committeeMembers)
    .where(eq(committeeMembers.committeeId, committeeId));

  // Prefer attendance-based count when available; fall back to raw session count
  const displaySessionCount = trackedMeetingsCount ?? totalSessions;

  // Fetch committee members with attendance stats.
  // For active committees: fetch ALL rows whose memberId has at least one
  // isCurrent=true row. This ensures that members who left and returned have
  // their full history (including earliestStart and attendance covering all
  // stints), while still only showing current members.
  // For inactive committees: show all members since everyone is isCurrent=false.
  const memberFilter = committee.isActive
    ? and(
        eq(committeeMembers.committeeId, committeeId),
        sql`${committeeMembers.memberId} IN (
          SELECT DISTINCT ${committeeMembers.memberId}
          FROM ${committeeMembers}
          WHERE ${committeeMembers.committeeId} = ${committeeId}
            AND ${committeeMembers.isCurrent} = true
        )`,
      )
    : eq(committeeMembers.committeeId, committeeId);

  const rawMembers = await db
    .select({
      memberId: committeeMembers.memberId,
      positionId: committeeMembers.positionId,
      dutyDesc: committeeMembers.dutyDesc,
      isCurrent: committeeMembers.isCurrent,
      startDate: committeeMembers.startDate,
      finishDate: committeeMembers.finishDate,
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
    .where(memberFilter);

  const cmMembers = dedupeCommitteeMembers(rawMembers, (key) => tDetail(key));
  const chair = cmMembers.find((m) => m.isChair);
  const regularMembers = cmMembers.filter((m) => !m.isChair);

  // Average attendance — one value per distinct member, already deduped
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

  // Fetch related committees with the same name from other Knessets
  const relatedCommittees = await db
    .select({
      id: committees.id,
      name: committees.name,
      knessetNum: committees.knessetNum,
      isActive: committees.isActive,
      memberCount: sql<number>`(
        SELECT count(DISTINCT cm2.member_id)
        FROM committee_members cm2
        WHERE cm2.committee_id = ${committees.id}
      )`,
    })
    .from(committees)
    .where(
      and(
        eq(committees.name, committee.name),
        sql`${committees.id} != ${committeeId}`,
      ),
    )
    .orderBy(desc(committees.knessetNum));

  return (
    <div className="mx-auto max-w-7xl overflow-x-hidden px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex items-start gap-4">
        <div className="bg-primary/10 ring-primary/20 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-1">
          <Users className="text-primary h-7 w-7" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight break-words sm:text-3xl">
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
        <div className="min-w-0 space-y-6 lg:col-span-1">
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

          {/* Committee History across Knessets */}
          {relatedCommittees.length > 0 && (
            <Card className="glass-card overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <History className="text-muted-foreground h-4 w-4" />
                  {tDetail('committeeHistory')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {/* Current committee in the timeline */}
                  <div className="bg-primary/5 border-primary/20 flex items-center justify-between rounded-lg border p-2.5">
                    <div className="flex items-center gap-2">
                      <Badge className="text-xs">
                        {t('knesset')} {committee.knessetNum}
                      </Badge>
                      <span className="text-xs font-medium">
                        {tDetail('currentKnesset')}
                      </span>
                    </div>
                    {committee.isActive ? (
                      <Badge className="bg-green-500/15 text-xs text-green-700 dark:text-green-400">
                        {t('active')}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        {t('inactive')}
                      </Badge>
                    )}
                  </div>
                  {/* Related committees from other Knessets */}
                  {relatedCommittees.map((rc) => (
                    <Link
                      key={rc.id}
                      href={`/committees/${rc.id}`}
                      className="hover:bg-muted/50 flex items-center justify-between rounded-lg border p-2.5 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {t('knesset')} {rc.knessetNum}
                        </Badge>
                        {rc.memberCount > 0 && (
                          <span className="text-muted-foreground flex items-center gap-1 text-xs">
                            <Users className="h-3 w-3" />
                            {rc.memberCount}
                          </span>
                        )}
                      </div>
                      <span className="text-primary text-xs">
                        {tDetail('viewCommittee')} →
                      </span>
                    </Link>
                  ))}
                </div>
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
                <span className="font-medium">{displaySessionCount}</span>
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
        <div className="min-w-0 space-y-6 lg:col-span-2">
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
                  {chair && (
                    <CommitteeMemberRow member={chair} tDetail={tDetail} />
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
                      className="hover:bg-muted/30 overflow-hidden rounded-lg border p-3 transition-colors sm:p-4"
                    >
                      <div className="flex flex-col gap-2">
                        <div className="min-w-0">
                          {session.title && (
                            <p className="text-sm leading-snug font-medium [overflow-wrap:anywhere] break-words">
                              {session.title}
                            </p>
                          )}
                          {session.sessionDate && (
                            <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                {new Date(
                                  session.sessionDate,
                                ).toLocaleDateString('he-IL')}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {new Date(
                                  session.sessionDate,
                                ).toLocaleTimeString('he-IL', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {session.protocolUrl && (
                            <a
                              href={session.protocolUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-primary/10 text-primary hover:bg-primary/20 inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              {tDetail('viewProtocol')}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
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
  member: DedupedCommitteeMember;
  tDetail: (key: string) => string;
}

function CommitteeMemberRow({ member, tDetail }: CommitteeMemberRowProps) {
  const startYear = member.earliestStart
    ? member.earliestStart.getFullYear()
    : null;
  const hasGap = member.stints.length > 1;

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
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-medium">
            {member.firstName} {member.lastName}
          </span>
          {member.roleLabels.map((label, i) => (
            <Badge
              key={label}
              className={
                i === 0 && (member.isChair || member.isDeputy)
                  ? 'bg-primary/15 text-primary text-xs'
                  : 'text-xs'
              }
              variant={
                i === 0 && (member.isChair || member.isDeputy)
                  ? undefined
                  : 'outline'
              }
            >
              {label}
            </Badge>
          ))}
          {hasGap && (
            <Badge variant="outline" className="text-xs opacity-60">
              {tDetail('leftAndReturned')}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs">
          {member.factionName && (
            <span className="text-muted-foreground truncate">
              {member.factionName}
            </span>
          )}
          {startYear && (
            <span className="text-muted-foreground/70">
              · {tDetail('memberSince')} {startYear}
            </span>
          )}
        </div>
      </div>
      {member.attendancePercent != null ||
      (member.protocolMeetings != null && member.protocolMeetings > 0) ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={<div className="flex shrink-0 items-center gap-2" />}
            >
              <AttendanceBar percent={member.attendancePercent ?? 0} />
              <span className="text-muted-foreground w-10 text-end text-xs">
                {Math.round(member.attendancePercent ?? 0)}%
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {tDetail('attended')}: {member.attendedMeetings ?? 0}/
                {member.protocolMeetings ?? 0}
              </p>
              {hasGap ? (
                <div className="mt-1 space-y-0.5">
                  {member.stints.map((stint, i) => (
                    <p key={i} className="text-muted-foreground text-xs">
                      {stint.start
                        ? stint.start.toLocaleDateString('he-IL')
                        : '—'}
                      {' → '}
                      {stint.finish
                        ? stint.finish.toLocaleDateString('he-IL')
                        : tDetail('present')}
                    </p>
                  ))}
                </div>
              ) : member.earliestStart ? (
                <p className="text-muted-foreground text-xs">
                  {tDetail('memberSince')}:{' '}
                  {member.earliestStart.toLocaleDateString('he-IL')}
                </p>
              ) : null}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <span className="text-muted-foreground/50 shrink-0 text-xs">
          {tDetail('noData')}
        </span>
      )}
    </Link>
  );
}
