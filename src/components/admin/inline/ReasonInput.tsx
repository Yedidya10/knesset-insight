'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function ReasonInput({ value, onChange, placeholder }: Props) {
  const t = useTranslations('admin.inline');
  const [customMode, setCustomMode] = useState(false);

  const presets = [
    t('reasonPresets.wrongStage'),
    t('reasonPresets.dataFix'),
    t('reasonPresets.manualOverride'),
    t('reasonPresets.syncError'),
    t('reasonPresets.userReport'),
  ];

  function handlePresetClick(preset: string) {
    setCustomMode(false);
    onChange(preset);
  }

  function handleCustomClick() {
    setCustomMode(true);
    onChange('');
  }

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium">{t('reason')}</span>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <Badge
            key={preset}
            variant={value === preset && !customMode ? 'default' : 'outline'}
            className="cursor-pointer text-xs"
            onClick={() => handlePresetClick(preset)}
          >
            {preset}
          </Badge>
        ))}
        <Badge
          variant={customMode ? 'default' : 'outline'}
          className="cursor-pointer text-xs"
          onClick={handleCustomClick}
        >
          {t('reasonPresets.custom')}
        </Badge>
      </div>
      {customMode && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? t('reasonPlaceholder')}
          required
          className="mt-1"
        />
      )}
    </div>
  );
}
