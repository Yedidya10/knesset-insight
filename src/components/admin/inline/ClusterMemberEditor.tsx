'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { trpc } from '@/lib/trpc';

interface Props {
  billId: number;
  currentClusterId: number | null;
}

export default function ClusterMemberEditor({ billId, currentClusterId }: Props) {
  const t = useTranslations('admin.inline');
  const router = useRouter();
  const [newClusterId, setNewClusterId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<'move' | 'remove'>('move');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    setLoading(true);
    try {
      if (action === 'remove' && currentClusterId) {
        await trpc.admin.removeBillFromCluster.mutate({
          billId,
          clusterId: currentClusterId,
          reason,
        });
      } else if (action === 'move' && newClusterId) {
        await trpc.admin.moveBillToCluster.mutate({
          billId,
          fromClusterId: currentClusterId,
          toClusterId: Number(newClusterId),
          reason,
        });
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h4 className="font-medium text-sm">{t('editClusterMembership')}</h4>
      <div className="flex gap-2">
        <Button
          type="button"
          variant={action === 'move' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setAction('move')}
        >
          {t('moveToCluster')}
        </Button>
        {currentClusterId && (
          <Button
            type="button"
            variant={action === 'remove' ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => setAction('remove')}
          >
            {t('removeFromCluster')}
          </Button>
        )}
      </div>
      {action === 'move' && (
        <div>
          <span className="text-xs font-medium">{t('targetClusterId')}</span>
          <Input
            type="number"
            value={newClusterId}
            onChange={(e) => setNewClusterId(e.target.value)}
            placeholder={t('clusterIdPlaceholder')}
            required
            className="mt-1"
          />
        </div>
      )}
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
      <Button
        type="submit"
        size="sm"
        variant={action === 'remove' ? 'destructive' : 'default'}
        disabled={loading || !reason.trim() || (action === 'move' && !newClusterId)}
        className="w-full"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin me-2" />}
        {action === 'remove' ? t('remove') : t('save')}
      </Button>
    </form>
  );
}
