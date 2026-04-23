'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ExternalLink, FileText, X, Maximize2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface DocumentToView {
  title: string;
  /** Direct URL (Supabase public URL or external) */
  url: string;
  /** If true, wrap in Google Docs Viewer for CORS-restricted external PDFs */
  useGoogleViewer?: boolean;
}

interface Props {
  document: DocumentToView;
  trigger: React.ReactNode;
}

/**
 * Opens a PDF / document inline in an iframe without requiring the user
 * to download anything.
 *
 * Strategy:
 * - Supabase Storage URLs → direct iframe (same origin CORS is open)
 * - External URLs with useGoogleViewer → Google Docs Viewer embed
 * - On mobile (<768 px) → "open in new tab" button because iframes are cramped
 */
export default function DocumentViewerDialog({ document, trigger }: Props) {
  const t = useTranslations('integrity.documents');
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const embedUrl = document.useGoogleViewer
    ? `https://docs.google.com/viewer?url=${encodeURIComponent(document.url)}&embedded=true`
    : document.url;

  return (
    <>
      <span onClick={() => setOpen(true)} className="cursor-pointer">
        {trigger}
      </span>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[90vh] max-w-4xl flex-col p-0">
          <DialogHeader className="shrink-0 border-b px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 shrink-0" />
                <span className="truncate">{document.title}</span>
              </DialogTitle>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  render={
                    <a
                      href={document.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                  variant="ghost"
                  size="icon"
                  title={t('openInNewTab')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setOpen(false)}
                  title={t('close')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Mobile fallback */}
          <div className="flex flex-1 flex-col sm:hidden">
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
              <Maximize2 className="text-muted-foreground h-10 w-10" />
              <p className="text-muted-foreground text-sm">
                {t('mobileViewNote')}
              </p>
              <Button
                render={
                  <a
                    href={document.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                <ExternalLink className="me-2 h-4 w-4" />
                {t('openInNewTab')}
              </Button>
            </div>
          </div>

          {/* Desktop iframe viewer */}
          <div className="relative hidden flex-1 sm:flex">
            {!loaded && (
              <div className="bg-muted/30 absolute inset-0 flex items-center justify-center">
                <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
              </div>
            )}
            <iframe
              src={embedUrl}
              className="h-full w-full border-0"
              title={document.title}
              onLoad={() => setLoaded(true)}
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
