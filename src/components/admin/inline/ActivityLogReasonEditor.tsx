'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Pencil, Loader2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import ReasonInput from './ReasonInput';

interface Props {
  logId: number;
  currentReason: string | null;
}

export default function ActivityLogReasonEditor({
  logId,
  currentReason,
}: Props) {
  const t = useTranslations('admin.activity');
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState(currentReason ?? '');
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!reason.trim()) return;
    setLoading(true);
    try {
      await trpc.admin.updateActivityReason.mutate({ logId, reason });
      setEditing(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (!editing) {
    return (
      <div className="mt-1 flex items-center gap-2">
        {currentReason ? (
          <p className="text-sm text-muted-foreground">
            {currentReason}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            {t('noReason')}
          </p>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => {
            setReason(currentReason ?? '');
            setEditing(true);
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-1 space-y-2">
      <ReasonInput value={reason} onChange={setReason} />
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          disabled={loading || !reason.trim()}
          onClick={handleSave}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          disabled={loading}
          onClick={() => setEditing(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
