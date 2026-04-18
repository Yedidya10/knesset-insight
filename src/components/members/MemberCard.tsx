import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import MemberAvatar from '@/components/members/MemberAvatar';
import { FileText, UserX } from 'lucide-react';

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
    billCount?: number;
    absentCount?: number;
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

          {/* Coalition / Opposition badge */}
          {member.isCurrent && member.isCoalition !== null && (
            <Badge
              variant="outline"
              className={
                member.isCoalition
                  ? 'border-chart-2/40 text-chart-2 bg-chart-2/10 text-xs'
                  : 'border-chart-4/40 text-chart-4 bg-chart-4/10 text-xs'
              }
            >
              {member.isCoalition
                ? t('coalitionMember')
                : t('oppositionMember')}
            </Badge>
          )}

          {/* Extended details (toggled via showDetails) */}
          {showDetails &&
            ((member.billCount ?? 0) > 0 || (member.absentCount ?? 0) > 0) && (
              <div className="border-border/40 w-full space-y-2 border-t pt-2">
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
                {/* Absent count */}
                {(member.absentCount ?? 0) > 0 && (
                  <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <UserX className="h-3 w-3 shrink-0" />
                    <span>{t('absentCount')}</span>
                    <span className="text-foreground ms-auto font-medium tabular-nums">
                      {member.absentCount}
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
