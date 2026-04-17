'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { BugIcon, ImagePlusIcon, XIcon, Loader2Icon } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const CATEGORIES = [
  'ui',
  'data',
  'performance',
  'translation',
  'accessibility',
  'other',
] as const;

const MAX_IMAGES = 3;
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 MB

type ImagePreview = {
  file: File;
  preview: string;
};

export function BugReportButton() {
  const t = useTranslations('bugReport');
  const tCommon = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('');
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    'success' | 'error' | 'rateLimit' | null
  >(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetForm() {
    setTitle('');
    setDescription('');
    setCategory('');
    setImages([]);
    setResult(null);
    setValidationErrors([]);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      // Reset after close animation
      setTimeout(resetForm, 200);
    }
  }

  function handleAddImage() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    const errors: string[] = [];
    const newImages = [...images];

    for (const file of Array.from(files)) {
      if (newImages.length >= MAX_IMAGES) {
        errors.push(t('errorTooManyImages', { max: MAX_IMAGES }));
        break;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        errors.push(t('errorImageTooLarge'));
        continue;
      }
      newImages.push({
        file,
        preview: URL.createObjectURL(file),
      });
    }

    setImages(newImages);
    if (errors.length > 0) {
      setValidationErrors(errors);
    }

    // Reset input so re-selecting same file works
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleRemoveImage(index: number) {
    setImages((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].preview);
      next.splice(index, 1);
      return next;
    });
  }

  async function handleSubmit() {
    const errors: string[] = [];
    if (!title.trim()) errors.push(t('errorTitleRequired'));
    if (!description.trim()) errors.push(t('errorDescriptionRequired'));

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors([]);
    setSubmitting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      if (category) formData.append('category', category);
      formData.append('pageUrl', window.location.href);
      formData.append('userAgent', navigator.userAgent);
      formData.append('locale', document.documentElement.lang || '');

      for (const img of images) {
        formData.append('images', img.file);
      }

      const res = await fetch('/api/bug-report', {
        method: 'POST',
        body: formData,
      });

      if (res.status === 429) {
        setResult('rateLimit');
      } else if (res.ok) {
        setResult('success');
      } else {
        setResult('error');
      }
    } catch {
      setResult('error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="fixed end-4 bottom-4 z-40 gap-1.5 shadow-lg"
            aria-label={t('button')}
          />
        }
      >
        <BugIcon className="size-4" />
        <span className="hidden sm:inline">{t('button')}</span>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        {result === 'success' ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="bg-primary/10 flex size-14 items-center justify-center rounded-2xl">
              <BugIcon className="text-primary size-7" />
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
            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="bug-title" className="text-sm font-medium">
                {t('titleLabel')} <span className="text-destructive">*</span>
              </label>
              <Input
                id="bug-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('titlePlaceholder')}
                maxLength={200}
                disabled={submitting}
              />
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                {t('categoryLabel')}
              </label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v ?? '')}
                disabled={submitting}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('categoryPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {t(`categories.${cat}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="bug-desc" className="text-sm font-medium">
                {t('descriptionLabel')}{' '}
                <span className="text-destructive">*</span>
              </label>
              <Textarea
                id="bug-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('descriptionPlaceholder')}
                rows={4}
                maxLength={5000}
                disabled={submitting}
              />
            </div>

            {/* Images */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{t('images')}</label>
              <p className="text-muted-foreground text-xs">
                {t('maxImages', { max: MAX_IMAGES })} · {t('maxSize')}
              </p>

              {images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {images.map((img, i) => (
                    <div key={i} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.preview}
                        alt={`screenshot ${i + 1}`}
                        className="size-20 rounded-lg border object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(i)}
                        className="bg-destructive text-destructive-foreground absolute -end-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full"
                        aria-label={t('removeImage')}
                        disabled={submitting}
                      >
                        <XIcon className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {images.length < MAX_IMAGES && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddImage}
                  disabled={submitting}
                  className="w-fit gap-1.5"
                >
                  <ImagePlusIcon className="size-4" />
                  {t('addImage')}
                </Button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Page URL (read-only) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-muted-foreground text-sm font-medium">
                {t('pageUrl')}
              </label>
              <p className="text-muted-foreground truncate text-xs">
                {typeof window !== 'undefined' ? window.location.href : ''}
              </p>
            </div>

            {/* Validation errors */}
            {validationErrors.length > 0 && (
              <div className="border-destructive/30 bg-destructive/5 rounded-lg border p-3">
                {validationErrors.map((err, i) => (
                  <p key={i} className="text-destructive text-sm">
                    {err}
                  </p>
                ))}
              </div>
            )}

            {/* Rate limit / error message */}
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
