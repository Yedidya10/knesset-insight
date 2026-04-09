'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { trpc } from '@/lib/trpc';

interface Props {
  caseId: number;
}

export default function IntegrityCaseActions({ caseId }: Props) {
  const t = useTranslations('admin.integrity');
  const router = useRouter();
  const [loading, setLoading] = useState<'verify' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<'verify' | 'reject'>('verify');

  async function handleSubmit() {
    if (!reason.trim()) return;
    setLoading(action);
    try {
      if (action === 'verify') {
        await trpc.admin.verifyIntegrityCase.mutate({ caseId, reason });
      } else {
        await trpc.admin.rejectIntegrityCase.mutate({ caseId, reason });
      }
      setOpen(false);
      setReason('');
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  function openAction(type: 'verify' | 'reject') {
    setAction(type);
    setReason('');
    setOpen(true);
  }

  return (
    <>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
          onClick={() => openAction('verify')}
          disabled={loading !== null}
        >
          {loading === 'verify' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          <span className="ms-1">{t('verify')}</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          onClick={() => openAction('reject')}
          disabled={loading !== null}
        >
          {loading === 'reject' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <X className="h-4 w-4" />
          )}
          <span className="ms-1">{t('reject')}</span>
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === 'verify' ? t('verifyTitle') : t('rejectTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('reasonPlaceholder')}
              required
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t('cancel')}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!reason.trim() || loading !== null}
                variant={action === 'verify' ? 'default' : 'destructive'}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin me-2" />
                ) : null}
                {action === 'verify' ? t('verify') : t('reject')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
