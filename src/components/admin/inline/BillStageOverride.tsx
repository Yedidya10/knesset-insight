'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { trpc } from '@/lib/trpc';

const BILL_STAGES = [
  { value: '0', label: 'הגשה' },
  { value: '1', label: 'דיון מוקדם / טרומי' },
  { value: '2', label: 'ועדה (קריאה ראשונה)' },
  { value: '3', label: 'קריאה ראשונה' },
  { value: '4', label: 'ועדה (קריאה 2+3)' },
  { value: '5', label: 'קריאה שנייה ושלישית' },
  { value: '6', label: 'חוק שהתקבל' },
] as const;

interface Props {
  billId: number;
  currentStatusId: number | null;
}

export default function BillStageOverride({ billId, currentStatusId }: Props) {
  const t = useTranslations('admin.inline');
  const router = useRouter();
  const [newStatusId, setNewStatusId] = useState(String(currentStatusId ?? ''));
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim() || !newStatusId) return;
    setLoading(true);
    try {
      await trpc.admin.overrideBillStage.mutate({
        billId,
        newStatusId: Number(newStatusId),
        reason,
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h4 className="font-medium text-sm">{t('overrideStage')}</h4>
      <div>
        <span className="text-xs">{t('currentStage')}: {currentStatusId ?? '—'}</span>
      </div>
      <div>
        <span className="text-xs font-medium">{t('newStage')}</span>
        <Select value={newStatusId} onValueChange={(val) => setNewStatusId(val ?? '')}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder={t('selectStage')} />
          </SelectTrigger>
          <SelectContent>
            {BILL_STAGES.map((stage) => (
              <SelectItem key={stage.value} value={stage.value}>
                {stage.value} — {stage.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
      <Button type="submit" size="sm" disabled={loading || !reason.trim() || !newStatusId} className="w-full">
        {loading && <Loader2 className="h-4 w-4 animate-spin me-2" />}
        {t('save')}
      </Button>
    </form>
  );
}
