'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LinkIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';

export default function AdminManualLinkForm() {
  const t = useTranslations('admin');
  const router = useRouter();
  const [clusterId, setClusterId] = useState('');
  const [billId, setBillId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cId = Number(clusterId);
    const bId = Number(billId);
    if (!cId || !bId) return;

    setLoading(true);
    try {
      await trpc.billClusters.manualLink.mutate({ clusterId: cId, billId: bId });
      setClusterId('');
      setBillId('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="cluster-id" className="text-sm font-medium text-muted-foreground">
          {t('clusterId')}
        </label>
        <Input
          id="cluster-id"
          type="number"
          value={clusterId}
          onChange={(e) => setClusterId(e.target.value)}
          className="w-32"
          required
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="bill-id" className="text-sm font-medium text-muted-foreground">
          {t('billId')}
        </label>
        <Input
          id="bill-id"
          type="number"
          value={billId}
          onChange={(e) => setBillId(e.target.value)}
          className="w-32"
          required
        />
      </div>
      <Button type="submit" size="sm" disabled={loading}>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LinkIcon className="h-4 w-4" />
        )}
        <span className="ms-1">{t('link')}</span>
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
