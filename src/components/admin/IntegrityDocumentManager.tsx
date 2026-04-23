'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  Upload,
  Trash2,
  FileText,
  Eye,
  Loader2,
  Plus,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import DocumentViewerDialog from '@/components/integrity/DocumentViewerDialog';

interface Doc {
  id: number;
  title: string;
  docType: string;
  url: string | null;
  storagePath: string | null;
  publishedAt: string | null;
  createdAt: string;
}

interface Props {
  caseId: number;
  caseTitle: string;
  initialDocuments: Doc[];
}

const DOC_TYPE_VALUES = [
  'ruling',
  'protocol',
  'report',
  'indictment',
  'response',
  'other',
] as const;

export default function IntegrityDocumentManager({
  caseId,
  caseTitle,
  initialDocuments,
}: Props) {
  const t = useTranslations('admin.integrity.documents');
  const tDocTypes = useTranslations('integrity.docTypes');
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<Doc[]>(initialDocuments);

  // Upload form state
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState<string>('ruling');
  const [publishedAt, setPublishedAt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetForm() {
    setTitle('');
    setDocType('ruling');
    setPublishedAt('');
    setFile(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setUploadError(null);

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', title || file.name);
      fd.append('docType', docType);
      if (publishedAt) fd.append('publishedAt', publishedAt);

      const res = await fetch(`/api/admin/integrity/${caseId}/documents`, {
        method: 'POST',
        body: fd,
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        if (data.error === 'storage_not_configured') {
          setUploadError(
            'SUPABASE_SERVICE_ROLE_KEY חסר. הוסף אותו ל-.env.local מהדשבורד של Supabase → Settings → API.',
          );
        } else {
          setUploadError(data.error ?? 'שגיאה בהעלאה');
        }
        return;
      }

      const result = (await res.json()) as { document: Doc };
      setDocs((prev) => [...prev, result.document]);
      resetForm();
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docId: number) {
    setDeletingId(docId);
    try {
      const res = await fetch(
        `/api/admin/integrity/${caseId}/documents?docId=${docId}`,
        { method: 'DELETE' },
      );
      if (res.ok) {
        setDocs((prev) => prev.filter((d) => d.id !== docId));
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5">
            <FileText className="h-4 w-4" />
            {t('manage')}
            {docs.length > 0 && (
              <Badge
                variant="secondary"
                className="ms-1 h-5 rounded-full px-1.5 text-xs"
              >
                {docs.length}
              </Badge>
            )}
          </Button>
        }
      />

      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="line-clamp-1">
            {t('title')}: {caseTitle}
          </DialogTitle>
        </DialogHeader>

        {/* Existing documents */}
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm font-medium">
            {t('existingDocs')} ({docs.length})
          </p>
          {docs.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('noDocs')}</p>
          ) : (
            <ul className="space-y-2">
              {docs.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center gap-2 rounded-lg border p-3"
                >
                  <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{doc.title}</p>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-xs">
                        {tDocTypes(doc.docType)}
                      </Badge>
                      {doc.publishedAt && (
                        <span className="text-muted-foreground text-xs">
                          {new Date(doc.publishedAt).toLocaleDateString(
                            'he-IL',
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {doc.url && (
                      <DocumentViewerDialog
                        document={{
                          title: doc.title,
                          url: doc.url,
                          useGoogleViewer: !doc.storagePath,
                        }}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t('preview')}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        }
                      />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(doc.id)}
                      disabled={deletingId === doc.id}
                      title={t('delete')}
                    >
                      {deletingId === doc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Upload form */}
        <div className="space-y-3 border-t pt-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Plus className="h-4 w-4" />
            {t('uploadNew')}
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-muted-foreground text-xs">
                {t('docTitle')}
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('docTitlePlaceholder')}
                maxLength={500}
              />
            </div>

            <div className="space-y-1">
              <label className="text-muted-foreground text-xs">
                {t('docType')}
              </label>
              <Select value={docType} onValueChange={(v) => v && setDocType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPE_VALUES.map((dt) => (
                    <SelectItem key={dt} value={dt}>
                      {tDocTypes(dt)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-muted-foreground text-xs">
                {t('publishedAt')}
              </label>
              <Input
                type="date"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-muted-foreground text-xs">
                {t('file')}
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/*"
                className="text-muted-foreground file:bg-primary file:text-primary-foreground block w-full text-sm file:me-3 file:rounded file:border-0 file:px-3 file:py-1.5 file:text-xs hover:file:cursor-pointer"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-muted-foreground text-xs">{t('fileHelp')}</p>
            </div>
          </div>

          {uploadError && (
            <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg border p-3 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{uploadError}</p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={resetForm} disabled={uploading}>
              {t('reset')}
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="gap-2"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {t('upload')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
