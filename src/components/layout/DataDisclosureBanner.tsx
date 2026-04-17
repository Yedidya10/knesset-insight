'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { X, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'data-disclosure-dismissed';

function getInitialVisibility() {
  if (typeof window === 'undefined') return false;
  return !localStorage.getItem(STORAGE_KEY);
}

export function DataDisclosureBanner() {
  const t = useTranslations('dataDisclosure');
  const [visible, setVisible] = useState(getInitialVisibility);

  const dismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950"
    >
      <div className="container mx-auto flex items-center gap-3 px-4 py-2.5">
        <Info className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="flex-1 text-sm text-amber-800 dark:text-amber-200">
          {t('message')}
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-amber-600 hover:bg-amber-100 hover:text-amber-800 dark:text-amber-400 dark:hover:bg-amber-900 dark:hover:text-amber-200"
          onClick={dismiss}
          aria-label={t('dismiss')}
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
