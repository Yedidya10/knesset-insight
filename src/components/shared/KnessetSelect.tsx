'use client';

import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

interface Props {
  availableKnessets: number[];
  activeKnesset: number;
}

export default function KnessetSelect({ availableKnessets, activeKnesset }: Props) {
  const t = useTranslations('factions');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(value: number | null) {
    if (value === null) return;
    const params = new URLSearchParams(searchParams.toString());
    if (value === availableKnessets[0]) {
      params.delete('knesset');
    } else {
      params.set('knesset', String(value));
    }
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ''}`);
  }

  return (
    <Select value={activeKnesset} onValueChange={handleChange}>
      <SelectTrigger size="sm">
        <SelectValue placeholder={t('knesset', { num: activeKnesset })} />
      </SelectTrigger>
      <SelectContent>
        {availableKnessets.map((num) => (
          <SelectItem key={num} value={num}>
            {t('knesset', { num })}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
