'use client';

import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import type { RangeFilterField } from './types';

interface FilterRangeProps {
  field: RangeFilterField;
  fromValue: string;
  toValue: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}

export default function FilterRange({
  field,
  fromValue,
  toValue,
  onFromChange,
  onToChange,
}: FilterRangeProps) {
  const t = useTranslations('filters');
  const inputType = field.inputType ?? 'number';

  return (
    <div className="flex items-center gap-2">
      <Input
        type={inputType}
        value={fromValue}
        onChange={(e) => onFromChange(e.target.value)}
        placeholder={field.fromPlaceholder ?? t('from')}
        className="w-28"
      />
      <span className="text-muted-foreground text-sm">{t('to')}</span>
      <Input
        type={inputType}
        value={toValue}
        onChange={(e) => onToChange(e.target.value)}
        placeholder={field.toPlaceholder ?? t('to')}
        className="w-28"
      />
    </div>
  );
}
