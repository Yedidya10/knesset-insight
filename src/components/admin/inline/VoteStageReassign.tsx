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

const VOTE_STAGES = [
  { value: '0', labelKey: 'submitted' },
  { value: '1', labelKey: 'preliminary' },
  { value: '2', labelKey: 'committeeFirst' },
  { value: '3', labelKey: 'firstReading' },
  { value: '4', labelKey: 'committeeSecond' },
  { value: '5', labelKey: 'secondThirdReading' },
  { value: '6', labelKey: 'passed' },
] as const;

interface Props {
  voteId: number;
  currentStage: number | null;
}

export default function VoteStageReassign({ voteId, currentStage }: Props) {
  const t = useTranslations('admin.inline');
  const tStages = useTranslations('legislation.stages');
  const router = useRouter();
  const [newStage, setNewStage] = useState(String(currentStage ?? ''));
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim() || newStage === '') return;
    setLoading(true);
    try {
      await trpc.admin.reassignVoteStage.mutate({
        voteId,
        newStage: Number(newStage),
        reason,
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const currentLabel = currentStage != null
    ? tStages(VOTE_STAGES.find((s) => s.value === String(currentStage))?.labelKey ?? 'submitted')
    : '—';

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h4 className="font-medium text-sm">{t('reassignVoteStage')}</h4>
      <div>
        <span className="text-xs">{t('currentStage')}: {currentLabel}</span>
      </div>
      <div>
        <span className="text-xs font-medium">{t('newStage')}</span>
        <Select value={newStage} onValueChange={(val) => setNewStage(val ?? '')}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder={t('selectStage')} />
          </SelectTrigger>
          <SelectContent>
            {VOTE_STAGES.map((stage) => (
              <SelectItem key={stage.value} value={stage.value}>
                {stage.value} — {tStages(stage.labelKey)}
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
      <Button type="submit" size="sm" disabled={loading || !reason.trim() || newStage === ''} className="w-full">
        {loading && <Loader2 className="h-4 w-4 animate-spin me-2" />}
        {t('save')}
      </Button>
    </form>
  );
}
