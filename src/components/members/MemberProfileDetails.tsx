'use client';

import { useTranslations } from 'next-intl';
import { User, Calendar, Gavel, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface FactionHistoryEntry {
  knessetNum: number;
  factionName: string | null;
  politicalGroupId?: number | null;
  startDate: string | Date | null;
  endDate: string | Date | null;
}

interface MemberProfileDetailsProps {
  member: {
    gender: string | null;
    birthDate: string | Date | null;
    startDate: string | Date | null;
    endDate: string | Date | null;
    knessetNum: number | null;
  };
  age: number | null;
  factionHistory: FactionHistoryEntry[];
  locale: string;
}

/**
 * Merge consecutive faction history entries within the same knesset when they
 * share the same politicalGroupId. This handles cases like "הציונות הדתית"
 * being renamed to "הציונות הדתית בראשות בצלאל סמוטריץ'" after 5 days —
 * we show only the latest name with the combined date range.
 */
function mergeFactionHistory(
  entries: FactionHistoryEntry[],
): FactionHistoryEntry[] {
  if (entries.length <= 1) return entries;

  const merged: FactionHistoryEntry[] = [];
  for (const entry of entries) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.knessetNum === entry.knessetNum &&
      prev.politicalGroupId != null &&
      prev.politicalGroupId === entry.politicalGroupId
    ) {
      // Merge: keep the later entry's name (the active/renamed one), extend the date range
      prev.factionName = entry.factionName;
      prev.endDate = entry.endDate;
    } else {
      merged.push({ ...entry });
    }
  }
  return merged;
}

export default function MemberProfileDetails({
  member,
  age,
  factionHistory,
  locale,
}: MemberProfileDetailsProps) {
  const t = useTranslations('members.profile');

  const formatDate = (date: string | Date | null) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString(locale);
  };

  const hasDetails =
    member.gender ||
    member.birthDate ||
    member.startDate ||
    member.endDate ||
    factionHistory.length > 0;

  if (!hasDetails) return null;

  // Merge consecutive same-pgId entries within same knesset, then group by knesset
  const mergedHistory = mergeFactionHistory(factionHistory);
  const byKnesset = new Map<number, FactionHistoryEntry[]>();
  for (const h of mergedHistory) {
    const arr = byKnesset.get(h.knessetNum) ?? [];
    arr.push(h);
    byKnesset.set(h.knessetNum, arr);
  }

  return (
    <Card className="glass-card overflow-hidden">
      <Collapsible defaultOpen={false}>
        <CollapsibleTrigger className="flex w-full items-center justify-between px-6 py-4 text-start">
          <span className="text-sm font-semibold">{t('personalDetails')}</span>
          <ChevronDown className="text-muted-foreground h-4 w-4 transition-transform [[data-panel-open]_&]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 border-t px-6 pt-4 pb-6">
            {/* Personal info grid */}
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {member.gender && (
                <div className="text-muted-foreground flex items-center gap-2">
                  <User className="h-4 w-4 shrink-0" />
                  <span>
                    {t('gender')}:{' '}
                    {member.gender === 'נקבה' || member.gender === 'female'
                      ? t('female')
                      : t('male')}
                  </span>
                </div>
              )}
              {member.birthDate && (
                <div className="text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>
                    {t('birthDate')}: {formatDate(member.birthDate)}
                    {age !== null && ` (${age})`}
                  </span>
                </div>
              )}
              {member.knessetNum && (
                <div className="text-muted-foreground flex items-center gap-2">
                  <Gavel className="h-4 w-4 shrink-0" />
                  <span>
                    {t('knessetNum')}: {member.knessetNum}
                  </span>
                </div>
              )}
              {member.startDate && (
                <div className="text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>
                    {t('startDate')}: {formatDate(member.startDate)}
                  </span>
                </div>
              )}
              {member.endDate && (
                <div className="text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>
                    {t('endDate')}: {formatDate(member.endDate)}
                  </span>
                </div>
              )}
            </div>

            {/* Faction history */}
            {factionHistory.length > 0 && (
              <div className="space-y-3 border-t pt-4">
                <h3 className="text-sm font-semibold">{t('factionHistory')}</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {Array.from(byKnesset.entries()).map(
                    ([knessetNum, entries]) => (
                      <div
                        key={knessetNum}
                        className="bg-muted/30 space-y-1 rounded-lg p-3"
                      >
                        <Badge
                          variant={
                            knessetNum === member.knessetNum
                              ? 'default'
                              : 'outline'
                          }
                          className="text-xs"
                        >
                          {t('knessetNum')}: {knessetNum}
                        </Badge>
                        {entries.map((entry, i) => (
                          <p key={i} className="text-muted-foreground text-xs">
                            {entry.factionName}
                          </p>
                        ))}
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
