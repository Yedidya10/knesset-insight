'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { GitMerge, GitBranch, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RelatedBill {
  id: number;
  name: string | null;
  knessetNum?: number | null;
  status?: string | null;
}

interface RelatedBillsCardProps {
  /** Bills this bill was split into */
  splitChildren: RelatedBill[];
  /** Bills that were merged into this bill */
  mergedFromBills: RelatedBill[];
  /** Sibling bills from the same cluster (excluding this bill) */
  clusterSiblings: RelatedBill[];
  /** Cluster info (if any) */
  cluster?: { id: number; name: string } | null;
}

export function RelatedBillsCard({
  splitChildren,
  mergedFromBills,
  clusterSiblings,
  cluster,
}: RelatedBillsCardProps) {
  const t = useTranslations('legislation');

  const hasAny =
    splitChildren.length > 0 ||
    mergedFromBills.length > 0 ||
    clusterSiblings.length > 0;

  if (!hasAny) return null;

  return (
    <Card className="glass-card mb-6 overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Layers className="text-primary h-5 w-5" />
          {t('clusters.relatedBills')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Split children */}
        {splitChildren.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-sky-700 dark:text-sky-300">
              <GitBranch className="h-3.5 w-3.5" />
              {t('special.splitInto')}
            </div>
            <div className="space-y-1">
              {splitChildren.map((b) => (
                <RelatedBillRow key={b.id} bill={b} />
              ))}
            </div>
          </div>
        )}

        {/* Merged from */}
        {mergedFromBills.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-violet-700 dark:text-violet-300">
              <GitMerge className="h-3.5 w-3.5" />
              {t('special.includesMerge')}
            </div>
            <div className="space-y-1">
              {mergedFromBills.map((b) => (
                <RelatedBillRow key={b.id} bill={b} />
              ))}
            </div>
          </div>
        )}

        {/* Cluster siblings */}
        {clusterSiblings.length > 0 && (
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
        )}
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
      <span className="min-w-0 flex-1 truncate">{bill.name ?? `#${bill.id}`}</span>
      {bill.knessetNum && (
        <Badge variant="outline" className="shrink-0 text-[10px]">
          {t('knessetNum', { num: bill.knessetNum })}
        </Badge>
      )}
    </Link>
  );
}
