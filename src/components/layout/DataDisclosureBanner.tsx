'use client';

import { useSyncExternalStore, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { X, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'data-disclosure-dismissed';

function subscribe(cb: () => void) {
  window.addEventListener('storage', cb);
  return () => window.removeEventListener('storage', cb);
}
const getSnapshot = () => !localStorage.getItem(STORAGE_KEY);
const getServerSnapshot = () => false;

export function DataDisclosureBanner() {
  const t = useTranslations('dataDisclosure');
  const visible = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const dismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, '1');
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
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
