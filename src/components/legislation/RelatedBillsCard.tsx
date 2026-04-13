'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RelatedBill {
  id: number;
  name: string | null;
  knessetNum?: number | null;
  date?: string | null;
}

interface RelatedBillsCardProps {
  /** Sibling bills from the same cluster (excluding this bill) */
  clusterSiblings: RelatedBill[];
  /** Cluster info (if any) */
  cluster?: { id: number; name: string } | null;
}

export function RelatedBillsCard({
  clusterSiblings,
  cluster,
}: RelatedBillsCardProps) {
  const t = useTranslations('legislation');

  if (clusterSiblings.length === 0) return null;

  return (
    <Card className="glass-card mb-6 overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Layers className="text-primary h-5 w-5" />
          {t('clusters.relatedBills')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            <Layers className="h-3.5 w-3.5" />
            {cluster ? (
              <Link
                href={`/legislation/laws/${cluster.id}`}
                className="text-primary underline underline-offset-2 hover:no-underline"
              >
                {cluster.name}
              </Link>
            ) : (
              t('clusters.relatedBills')
            )}
          </div>
          <div className="space-y-1">
            {clusterSiblings.map((b) => (
              <RelatedBillRow key={b.id} bill={b} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RelatedBillRow({ bill }: { bill: RelatedBill }) {
  const t = useTranslations('legislation');
  return (
    <Link
      href={`/legislation/${bill.id}`}
      className="hover:bg-muted/50 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors"
    >
      <span className="min-w-0 flex-1 truncate">
        {bill.name ?? `#${bill.id}`}
      </span>
      {bill.date && (
        <span className="text-muted-foreground shrink-0 text-[10px]">
          {new Date(bill.date).toLocaleDateString('he-IL')}
        </span>
      )}
      {bill.knessetNum && (
        <Badge variant="outline" className="shrink-0 text-[10px]">
          {t('knessetNum', { num: bill.knessetNum })}
        </Badge>
      )}
    </Link>
  );
}
