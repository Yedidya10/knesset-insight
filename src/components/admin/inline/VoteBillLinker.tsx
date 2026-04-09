'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { trpc } from '@/lib/trpc';

interface Props {
  voteId: number;
  currentBillId: number | null;
}

export default function VoteBillLinker({ voteId, currentBillId }: Props) {
  const t = useTranslations('admin.inline');
  const router = useRouter();
  const [newBillId, setNewBillId] = useState(String(currentBillId ?? ''));
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    setLoading(true);
    try {
      await trpc.admin.relinkVote.mutate({
        voteId,
        newBillId: newBillId ? Number(newBillId) : null,
        reason,
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h4 className="font-medium text-sm">{t('relinkVote')}</h4>
      <div>
        <span className="text-xs font-medium">{t('billId')}</span>
        <Input
          type="number"
          value={newBillId}
          onChange={(e) => setNewBillId(e.target.value)}
          placeholder={t('billIdPlaceholder')}
          className="mt-1"
        />
      </div>
      <div>
        <span className="text-xs font-medium">{t('reason')}</span>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('reasonPlaceholder')}
          required
          className="mt-1"
        />
      </div>
      <Button type="submit" size="sm" disabled={loading || !reason.trim()} className="w-full">
        {loading && <Loader2 className="h-4 w-4 animate-spin me-2" />}
        {t('save')}
      </Button>
    </form>
  );
}
