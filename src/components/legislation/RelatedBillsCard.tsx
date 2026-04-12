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
  date?: string | null;
}

interface RelatedBillsCardProps {
  /** The main bill this bill was merged INTO */
  unions: RelatedBill[];
  /** Bills that were split FROM this bill (this bill is the parent) */
  splitChildren: RelatedBill[];
  /** The parent bill this bill was split FROM */
  splitFrom: RelatedBill[];
  /** Bills that were merged INTO this bill */
  mergedFromBills: RelatedBill[];
  /** Sibling bills from the same cluster (excluding this bill) */
  clusterSiblings: RelatedBill[];
  /** Cluster info (if any) */
  cluster?: { id: number; name: string } | null;
}

export function RelatedBillsCard({
  unions,
  splitChildren,
  splitFrom,
  mergedFromBills,
  clusterSiblings,
  cluster,
}: RelatedBillsCardProps) {
  const t = useTranslations('legislation');

  const hasAny =
    unions.length > 0 ||
    splitChildren.length > 0 ||
    splitFrom.length > 0 ||
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
        {/* Merged into (this bill was absorbed into another) */}
        {unions.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-violet-700 dark:text-violet-300">
              <GitMerge className="h-3.5 w-3.5" />
              {t('special.mergedWith')}
            </div>
            <div className="space-y-1">
              {unions.map((b) => (
                <RelatedBillRow key={b.id} bill={b} />
              ))}
            </div>
          </div>
        )}

        {/* Split from (this bill was split from a parent) */}
        {splitFrom.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-sky-700 dark:text-sky-300">
              <GitBranch className="h-3.5 w-3.5" />
              {t('special.splitFrom')}
            </div>
            <div className="space-y-1">
              {splitFrom.map((b) => (
                <RelatedBillRow key={b.id} bill={b} />
              ))}
            </div>
          </div>
        )}

        {/* Split children (this bill was split into these) */}
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

        {/* Merged from (other bills absorbed into this one) */}
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
