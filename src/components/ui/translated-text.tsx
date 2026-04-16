'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Languages } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TranslatedTextProps {
  /** The original Hebrew text from the Knesset API */
  text: string;
  /** HTML tag to render — defaults to span */
  as?: 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'div';
  className?: string;
}

// Module-level cache to avoid redundant calls during the session
const translationCache = new Map<string, string>();

function cacheKey(text: string, locale: string) {
  return `${locale}::${text}`;
}

export default function TranslatedText({
  text,
  as: Tag = 'span',
  className,
}: TranslatedTextProps) {
  const locale = useLocale();
  const t = useTranslations('translation');
  const isHebrew = locale === 'he';

  const [translated, setTranslated] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const translate = useCallback(async () => {
    if (isHebrew || !text) return;

    const key = cacheKey(text, locale);
    const cached = translationCache.get(key);
    if (cached) {
      setTranslated(cached);
      return;
    }

    setLoading(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: [text], targetLang: locale }),
        signal: controller.signal,
      });

      if (!res.ok) return;

      const data = (await res.json()) as { translations: string[] };
      const result = data.translations[0];
      if (result) {
        translationCache.set(key, result);
        setTranslated(result);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
    } finally {
      setLoading(false);
    }
  }, [text, locale, isHebrew]);

  useEffect(() => {
    translate();
    return () => abortRef.current?.abort();
  }, [translate]);

  // Hebrew locale — render as-is
  if (isHebrew) {
    return <Tag className={className}>{text}</Tag>;
  }

  const displayText = showOriginal ? text : (translated ?? text);
  const isTranslated = translated && !showOriginal;

  return (
    <Tag className={className}>
      {loading ? (
        <span className="animate-pulse">{text}</span>
      ) : (
        <>
          {displayText}
          {translated && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={() => setShowOriginal((v) => !v)}
                    className="bg-muted text-muted-foreground hover:bg-muted/80 ms-1.5 inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 align-middle text-[10px] font-medium transition-colors"
                  />
                }
              >
                <Languages className="h-3 w-3" />
                {isTranslated ? t('translated') : t('original')}
              </TooltipTrigger>
              <TooltipContent>
                {showOriginal ? t('showTranslation') : t('showOriginal')}
              </TooltipContent>
            </Tooltip>
          )}
        </>
      )}
    </Tag>
  );
}
