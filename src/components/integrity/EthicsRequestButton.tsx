'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ScaleIcon, Loader2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface Props {
  memberId: number;
  memberName: string;
}

export function EthicsRequestButton({ memberId, memberName }: Props) {
  const t = useTranslations('ethicsRequest');
  const tCommon = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    'success' | 'error' | 'rateLimit' | null
  >(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  function resetForm() {
    setDescription('');
    setSourceUrl('');
    setResult(null);
    setValidationError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setTimeout(resetForm, 200);
  }

  async function handleSubmit() {
    if (description.trim().length < 10) {
      setValidationError(t('errorDescriptionTooShort'));
      return;
    }
    setValidationError(null);
    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch('/api/ethics-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          memberName,
          description: description.trim(),
          sourceUrl: sourceUrl.trim() || undefined,
          pageUrl: window.location.href,
          locale: document.documentElement.lang || undefined,
        }),
      });
      if (res.status === 429) setResult('rateLimit');
      else if (res.ok) setResult('success');
      else setResult('error');
    } catch {
      setResult('error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button variant="outline" size="sm" className="gap-1.5" />}
      >
        <ScaleIcon className="size-4" />
        {t('button')}
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('title', { name: memberName })}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        {result === 'success' ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="bg-primary/10 flex size-14 items-center justify-center rounded-2xl">
              <ScaleIcon className="text-primary size-7" />
            </div>
            <p className="text-muted-foreground text-center text-sm">
              {t('success')}
            </p>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              {tCommon('close')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ethics-desc" className="text-sm font-medium">
                {t('descriptionLabel')}{' '}
                <span className="text-destructive">*</span>
              </label>
              <Textarea
                id="ethics-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('descriptionPlaceholder')}
                rows={5}
                maxLength={5000}
                disabled={submitting}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="ethics-source" className="text-sm font-medium">
                {t('sourceUrlLabel')}
              </label>
              <Input
                id="ethics-source"
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://…"
                maxLength={1000}
                disabled={submitting}
              />
              <p className="text-muted-foreground text-xs">
                {t('sourceUrlHelp')}
              </p>
            </div>

            {validationError && (
              <p className="text-destructive text-sm">{validationError}</p>
            )}
            {result === 'rateLimit' && (
              <p className="text-destructive text-sm">{t('errorRateLimit')}</p>
            )}
            {result === 'error' && (
              <p className="text-destructive text-sm">{t('error')}</p>
            )}
          </div>
        )}

        {result !== 'success' && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  {t('submitting')}
                </>
              ) : (
                t('submit')
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
