'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

interface ElectionCountdownProps {
  electionDate: string | null;
}

export default function ElectionCountdown({ electionDate }: ElectionCountdownProps) {
  const t = useTranslations('elections2026.countdown');
  const tRoot = useTranslations('elections2026');
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!electionDate) return;

    const target = new Date(electionDate).getTime();

    function update() {
      const now = Date.now();
      const diff = Math.max(0, target - now);
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [electionDate]);

  if (!electionDate) {
    return (
      <div className="rounded-2xl bg-muted/40 p-6 text-center">
        <p className="text-sm text-muted-foreground">{t('dateNotSet')}</p>
      </div>
    );
  }

  const units = [
    { value: timeLeft.days, label: t('days') },
    { value: timeLeft.hours, label: t('hours') },
    { value: timeLeft.minutes, label: t('minutes') },
    { value: timeLeft.seconds, label: t('seconds') },
  ];

  return (
    <div className="rounded-2xl border bg-card p-6">
      <h3 className="mb-4 text-center text-sm font-medium text-muted-foreground">
        {t('title')}
      </h3>
      <div className="flex justify-center gap-4">
        {units.map((unit) => (
          <div key={unit.label} className="flex flex-col items-center">
            <span className="text-3xl font-bold tabular-nums sm:text-4xl">
              {String(unit.value).padStart(2, '0')}
            </span>
            <span className="mt-1 text-xs text-muted-foreground">{unit.label}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-[11px] text-muted-foreground/70">
        {tRoot('estimatedDateNote')}
      </p>
    </div>
  );
}
