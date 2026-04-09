'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReasonInput from './ReasonInput';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { trpc } from '@/lib/trpc';

/** Representative StatusID values for each canonical stage. */
const STATUS_ID_OPTIONS = [
  { value: '104', label: 'הגשה (104)' },
  { value: '150', label: 'דיון מוקדם (150)' },
  { value: '106', label: 'ועדה — קריאה ראשונה (106)' },
  { value: '111', label: 'קריאה ראשונה (111)' },
  { value: '113', label: 'ועדה — קריאה 2+3 (113)' },
  { value: '117', label: 'לדיון במליאה לקריאה 2+3 (117)' },
  { value: '114', label: 'קריאה שנייה ושלישית (114)' },
  { value: '118', label: 'חוק שהתקבל (118)' },
] as const;

interface Props {
  billId: number;
  currentStatusId: string | null;
}

export default function BillStageOverride({ billId, currentStatusId }: Props) {
  const t = useTranslations('admin.inline');
  const router = useRouter();
  const [newStatusId, setNewStatusId] = useState(currentStatusId ?? '');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim() || !newStatusId) return;
    setLoading(true);
    try {
      await trpc.admin.overrideBillStage.mutate({
        billId,
        newStatusId,
        reason,
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const currentLabel = STATUS_ID_OPTIONS.find((s) => s.value === currentStatusId)?.label ?? currentStatusId;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h4 className="font-medium text-sm">{t('overrideStage')}</h4>
      <div>
        <span className="text-xs">{t('currentStage')}: {currentLabel ?? '—'}</span>
      </div>
      <div>
        <span className="text-xs font-medium">{t('newStage')}</span>
        <Select value={newStatusId} onValueChange={(val) => setNewStatusId(val ?? '')}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder={t('selectStage')} />
          </SelectTrigger>
          <SelectContent>
            {STATUS_ID_OPTIONS.map((stage) => (
              <SelectItem key={stage.value} value={stage.value}>
                {stage.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <ReasonInput value={reason} onChange={setReason} />
      <Button type="submit" size="sm" disabled={loading || !reason.trim() || !newStatusId} className="w-full">
        {loading && <Loader2 className="h-4 w-4 animate-spin me-2" />}
        {t('save')}
      </Button>
    </form>
  );
}
