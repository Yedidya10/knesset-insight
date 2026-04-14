'use client';

import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Map, BarChart3, GitCompare } from 'lucide-react';
import type { ViewMode } from './IsraelMap';

interface MapControlsProps {
  availableKnessets: number[];
  selectedKnesset: number;
  onKnessetChange: (knesset: number) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export default function MapControls({
  availableKnessets,
  selectedKnesset,
  onKnessetChange,
  viewMode,
  onViewModeChange,
}: MapControlsProps) {
  const t = useTranslations('electionMap');

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Knesset selector */}
      <Select
        value={String(selectedKnesset)}
        onValueChange={(v) => onKnessetChange(Number(v))}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder={t('selectKnesset')} />
        </SelectTrigger>
        <SelectContent>
          {availableKnessets.map((k) => (
            <SelectItem key={k} value={String(k)}>
              {t('knesset', { num: k })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* View mode toggle */}
      <ToggleGroup
        value={[viewMode]}
        onValueChange={(v) => {
          if (v.length > 0) onViewModeChange(v[v.length - 1] as ViewMode);
        }}
        className="rounded-lg border"
      >
        <ToggleGroupItem
          value="turnout"
          aria-label={t('viewMode.turnout')}
          className="gap-1.5 text-xs"
        >
          <Map className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('viewMode.turnout')}</span>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="winningParty"
          aria-label={t('viewMode.winningParty')}
          className="gap-1.5 text-xs"
        >
          <BarChart3 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('viewMode.winningParty')}</span>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="comparison"
          aria-label={t('viewMode.comparison')}
          className="gap-1.5 text-xs opacity-50"
          disabled
        >
          <GitCompare className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('viewMode.comparison')}</span>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
