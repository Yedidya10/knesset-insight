'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';

interface Props {
  clusterId: number;
}

export default function AdminClusterActions({ clusterId }: Props) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);

  async function handleApprove() {
    setLoading('approve');
    try {
      await trpc.billClusters.approve.mutate({ clusterId });
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  async function handleReject() {
    setLoading('reject');
    try {
      await trpc.billClusters.reject.mutate({ clusterId });
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        className="text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
        onClick={handleApprove}
        disabled={loading !== null}
      >
        {loading === 'approve' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="h-4 w-4" />
        )}
        <span className="ms-1">{t('approve')}</span>
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
        onClick={handleReject}
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
  );
}
