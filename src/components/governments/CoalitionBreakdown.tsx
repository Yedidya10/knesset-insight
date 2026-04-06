import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CoalitionFaction {
  factionId: number;
  factionName: string;
  factionSeats: number | null;
  factionColor: string | null;
  factionLogoUrl: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

interface CoalitionBreakdownProps {
  factions: CoalitionFaction[];
}

export default function CoalitionBreakdown({
  factions,
}: CoalitionBreakdownProps) {
  const t = useTranslations('governments');

  if (factions.length === 0) return null;

  const totalSeats = factions.reduce((sum, f) => sum + (f.factionSeats ?? 0), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{t('coalitionFactions')}</CardTitle>
          {totalSeats > 0 && (
            <Badge variant="secondary">
              {totalSeats} {t('seats')}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {factions.map((f) => (
            <div
              key={f.factionId}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              {/* Color indicator */}
              <div
                className="h-8 w-1.5 shrink-0 rounded-full"
                style={{
                  backgroundColor: f.factionColor ?? 'hsl(var(--muted))',
                }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{f.factionName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {f.factionSeats != null && f.factionSeats > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {f.factionSeats} {t('seats')}
                    </span>
                  )}
                  {f.periodStart && (
                    <span className="text-xs text-muted-foreground">
                      {f.periodStart}
                      {f.periodEnd ? ` — ${f.periodEnd}` : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
