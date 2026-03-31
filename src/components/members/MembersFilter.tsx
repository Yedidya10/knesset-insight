'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

interface Party {
  id: number;
  name: string;
}

interface MembersFilterProps {
  parties: Party[];
  currentParty: string;
  currentSort: string;
}

export default function MembersFilter({
  parties,
  currentParty,
  currentSort,
}: MembersFilterProps) {
  const t = useTranslations('members.filter');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={currentParty}
        onChange={(e) => updateParam('party', e.target.value)}
        className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none"
      >
        <option value="">{t('party')}</option>
        {parties.map((p) => (
          <option key={p.id} value={String(p.id)}>
            {p.name}
          </option>
        ))}
      </select>

      <select
        value={currentSort}
        onChange={(e) => updateParam('sort', e.target.value)}
        className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none"
      >
        <option value="name">{t('sortByName')}</option>
        <option value="party">{t('sortByParty')}</option>
      </select>
    </div>
  );
}
