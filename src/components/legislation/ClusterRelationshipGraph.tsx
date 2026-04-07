'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { AIConfidenceBadge } from './AIConfidenceBadge';

interface GraphNode {
  id: number;
  name: string;
  knessetNum: number;
  currentStage: string;
  isPrimary: boolean;
}

interface GraphEdge {
  from: number;
  to: number;
  type: 'union' | 'split' | 'name-similarity' | 'ai';
  confidence?: number | null;
}

interface ClusterRelationshipGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const KNESSET_COLORS: Record<number, string> = {
  20: 'border-blue-500 bg-blue-50 dark:bg-blue-950/30',
  21: 'border-violet-500 bg-violet-50 dark:bg-violet-950/30',
  22: 'border-amber-500 bg-amber-50 dark:bg-amber-950/30',
  23: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30',
  24: 'border-rose-500 bg-rose-50 dark:bg-rose-950/30',
  25: 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30',
};

const KNESSET_DOT_COLORS: Record<number, string> = {
  20: 'bg-blue-500',
  21: 'bg-violet-500',
  22: 'bg-amber-500',
  23: 'bg-emerald-500',
  24: 'bg-rose-500',
  25: 'bg-cyan-500',
};

export function ClusterRelationshipGraph({
  nodes,
  edges,
}: ClusterRelationshipGraphProps) {
  const t = useTranslations('legislation');

  if (nodes.length <= 1) return null;

  // Group nodes by knesset
  const nodesByKnesset = new Map<number, GraphNode[]>();
  for (const node of nodes) {
    if (!nodesByKnesset.has(node.knessetNum))
      nodesByKnesset.set(node.knessetNum, []);
    nodesByKnesset.get(node.knessetNum)!.push(node);
  }

  const sortedKnessets = [...nodesByKnesset.keys()].sort((a, b) => a - b);
  const uniqueKnessets = [...new Set(nodes.map((n) => n.knessetNum))].sort();

  // Build edge lookup for displaying connection indicators
  const edgesByNode = new Map<number, GraphEdge[]>();
  for (const edge of edges) {
    if (!edgesByNode.has(edge.from)) edgesByNode.set(edge.from, []);
    if (!edgesByNode.has(edge.to)) edgesByNode.set(edge.to, []);
    edgesByNode.get(edge.from)!.push(edge);
    edgesByNode.get(edge.to)!.push(edge);
  }

  return (
    <div className="space-y-4">
      {/* Node groups by Knesset */}
      <div className="flex flex-wrap gap-4">
        {sortedKnessets.map((kNum) => {
          const kNodes = nodesByKnesset.get(kNum)!;
          return (
            <div key={kNum} className="flex flex-col gap-2">
              <h4 className="text-xs font-semibold text-muted-foreground">
                {t('knessetNum', { num: kNum })}
              </h4>
              {kNodes.map((node) => {
                const nodeEdges = edgesByNode.get(node.id) ?? [];
                const hasAiEdge = nodeEdges.some((e) => e.type === 'ai');
                const aiEdge = nodeEdges.find((e) => e.type === 'ai');

                return (
                  <Link
                    key={node.id}
                    href={`/legislation/${node.id}`}
                    className={cn(
                      'block rounded-lg border-2 p-3 transition-colors hover:shadow-md',
                      KNESSET_COLORS[kNum] ?? 'border-gray-400 bg-gray-50 dark:bg-gray-950/30',
                      node.isPrimary && 'ring-2 ring-primary/40',
                    )}
                  >
                    <p className="text-sm font-medium leading-snug line-clamp-2">
                      {node.name}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">
                        {node.currentStage}
                      </span>
                      {hasAiEdge && aiEdge && (
                        <AIConfidenceBadge confidence={aiEdge.confidence ?? null} />
                      )}
                    </div>
                    {/* Connection indicators */}
                    <div className="mt-1.5 flex gap-1">
                      {nodeEdges.map((edge, i) => (
                        <span
                          key={i}
                          className={cn(
                            'h-1.5 w-4 rounded-full',
                            edge.type === 'union' && 'bg-violet-500',
                            edge.type === 'split' && 'bg-sky-500',
                            edge.type === 'name-similarity' && 'bg-amber-500',
                            edge.type === 'ai' && 'bg-primary/50',
                          )}
                          title={edge.type}
                        />
                      ))}
                    </div>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full bg-violet-500" />
          <span>{t('special.merged')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full bg-sky-500" />
          <span>{t('special.split')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full bg-amber-500" />
          <span>{t('clusters.whyRelated')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full bg-primary/50" />
          <span>{t('clusters.aiMatched')}</span>
        </div>
        <span className="mx-2 text-muted-foreground/40">|</span>
        {uniqueKnessets.map((k) => (
          <div key={k} className="flex items-center gap-1">
            <span className={cn('h-2.5 w-2.5 rounded-full', KNESSET_DOT_COLORS[k] ?? 'bg-gray-500')} />
            <span>K{k}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
