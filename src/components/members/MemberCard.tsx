import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import MemberAvatar from '@/components/members/MemberAvatar';
import { FileText, BarChart3 } from 'lucide-react';

interface MemberCardProps {
  member: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
    factionId: number | null;
    factionName: string | null;
    factionColor: string | null;
    isCurrent: boolean | null;
    isCoalition: boolean | null;
    forCount?: number;
    againstCount?: number;
    absentCount?: number;
    totalVotes?: number;
    billCount?: number;
  };
  showDetails?: boolean;
  priority?: boolean;
}

export default function MemberCard({
  member,
  showDetails = false,
  priority,
}: MemberCardProps) {
  const t = useTranslations('members.profile');
  const tVotes = useTranslations('votes');

  const initials = `${member.firstName?.[0] ?? ''}${member.lastName?.[0] ?? ''}`;
  const hasStats = member.totalVotes !== undefined && member.totalVotes > 0;

  const forPct = hasStats
    ? Math.round(((member.forCount ?? 0) / member.totalVotes!) * 100)
    : 0;
  const againstPct = hasStats
    ? Math.round(((member.againstCount ?? 0) / member.totalVotes!) * 100)
    : 0;
  const absentPct = hasStats ? 100 - forPct - againstPct : 0;

  const participationPct = hasStats
    ? Math.round(
        (((member.forCount ?? 0) + (member.againstCount ?? 0)) /
          member.totalVotes!) *
          100,
      )
    : 0;

  return (
    <Link href={`/members/${member.id}`}>
      <Card className="group glass-card hover-lift h-full overflow-hidden">
        <CardContent className="flex flex-col items-center gap-3 p-5">
          {/* Avatar with gradient ring */}
          <div className="relative">
            <div className="from-primary/30 via-chart-2/20 to-chart-4/30 absolute -inset-1 rounded-full bg-linear-to-br opacity-0 blur-sm transition-opacity group-hover:opacity-100" />
            <MemberAvatar
              member={member}
              size="lg"
              className="relative"
              ring="ring-2 ring-border/60 transition-all group-hover:ring-primary/40"
              priority={priority}
            />
          </div>

          <div className="text-center">
            <h3 className="leading-tight font-semibold">
              {member.firstName} {member.lastName}
            </h3>

            {member.factionName && (
              <p className="text-muted-foreground mt-1 line-clamp-1 text-xs">
                {member.factionName}
              </p>
            )}
          </div>

          {/* Mini vote distribution bar */}
          {hasStats && (
            <div className="w-full space-y-1.5">
              <div className="bg-muted flex h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="bg-green-500 transition-all"
                  style={{ width: `${forPct}%` }}
                />
                <div
                  className="bg-red-500 transition-all"
                  style={{ width: `${againstPct}%` }}
                />
                <div
                  className="bg-muted-foreground/30 transition-all"
                  style={{ width: `${absentPct}%` }}
                />
              </div>
              <div className="text-muted-foreground flex items-center justify-center gap-3 text-xs tabular-nums">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                  {member.forCount ?? 0}
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
                  {member.againstCount ?? 0}
                </span>
                <span className="flex items-center gap-1">
                  <span className="bg-muted-foreground/40 inline-block h-1.5 w-1.5 rounded-full" />
                  {member.absentCount ?? 0}
                </span>
              </div>
            </div>
          )}

          {/* Extended details (toggled via showDetails) */}
          {showDetails && (
            <div className="border-border/40 w-full space-y-2 border-t pt-2">
              {/* Participation rate */}
              {hasStats && (
                <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <BarChart3 className="h-3 w-3 shrink-0" />
                  <span>{t('participation')}</span>
                  <span className="text-foreground ms-auto font-medium tabular-nums">
                    {participationPct}%
                  </span>
                </div>
              )}

              {/* Bill count */}
              {(member.billCount ?? 0) > 0 && (
                <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <FileText className="h-3 w-3 shrink-0" />
                  <span>{t('billCount')}</span>
                  <span className="text-foreground ms-auto font-medium tabular-nums">
                    {member.billCount}
                  </span>
                </div>
              )}
            </div>
          )}

          {member.isCurrent === false && (
            <Badge variant="outline" className="text-xs">
              {t('endDate')}
            </Badge>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
