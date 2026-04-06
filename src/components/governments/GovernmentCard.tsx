import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import MemberAvatar from '@/components/members/MemberAvatar';

interface GovernmentCardProps {
  government: {
    id: number;
    governmentNum: number;
    knessetNum: number;
    name: string;
    startDate: string | null;
    endDate: string | null;
    pmFirstName: string | null;
    pmLastName: string | null;
    pmImageUrl: string | null;
    ministerCount: number;
    coalitionFactionCount: number;
  };
}

export default function GovernmentCard({ government: gov }: GovernmentCardProps) {
  const t = useTranslations('governments');

  const isCurrent = !gov.endDate;
  const dateRange = gov.startDate
    ? `${gov.startDate}${gov.endDate ? ` — ${gov.endDate}` : ''}`
    : '';

  return (
    <Link href={`/governments/${gov.governmentNum}`}>
      <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:ring-1 hover:ring-primary/20">
        {isCurrent && (
          <div className="absolute top-3 end-3 z-10">
            <Badge variant="default" className="text-xs">
              {t('current')}
            </Badge>
          </div>
        )}
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            {/* PM Avatar */}
            <MemberAvatar
              member={{
                firstName: gov.pmFirstName,
                lastName: gov.pmLastName,
                imageUrl: gov.pmImageUrl,
              }}
              size="lg"
              ring="ring-2 ring-primary/20"
            />

            <div className="min-w-0 flex-1">
              {/* Government number */}
              <h3 className="text-lg font-bold tracking-tight group-hover:text-primary transition-colors">
                {t('governmentNum', { num: gov.governmentNum })}
              </h3>

              {/* PM name */}
              {gov.pmFirstName && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {t('primeMinister')}: {gov.pmFirstName} {gov.pmLastName}
                </p>
              )}

              {/* Date range */}
              {dateRange && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {dateRange}
                </p>
              )}

              {/* Stats */}
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-xs">
                  {t('ministerCount', { count: gov.ministerCount })}
                </Badge>
                {gov.coalitionFactionCount > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {gov.coalitionFactionCount} {t('coalitionFactions')}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  {t('knessetNum', { num: gov.knessetNum })}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
