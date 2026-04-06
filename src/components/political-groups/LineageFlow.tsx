'use client';

import { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  Handle,
  Position,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

interface GroupData {
  id: number;
  slug: string;
  canonicalName: string;
  shortName: string | null;
  color: string | null;
  foundedYear: number | null;
  dissolvedYear: number | null;
  isActive: boolean | null;
}

interface EdgeData {
  id: number;
  sourceGroupId: number;
  targetGroupId: number;
  relationshipType: string;
  knessetNum: number | null;
  year: number | null;
}

interface Props {
  nodes: GroupData[];
  edges: EdgeData[];
}

const EDGE_COLORS: Record<string, string> = {
  merged_into: '#3b82f6',
  split_from: '#ef4444',
  renamed_to: '#8b5cf6',
  absorbed_by: '#f59e0b',
};

const EDGE_LABELS: Record<string, string> = {
  merged_into: 'mergedInto',
  split_from: 'splitFrom',
  renamed_to: 'renamedTo',
  absorbed_by: 'absorbedBy',
};

function GroupNode({ data }: { data: { label: string; color: string; years: string; isActive: boolean } }) {
  return (
    <div
      className={`rounded-xl border-2 bg-card px-4 py-3 shadow-md transition-shadow hover:shadow-lg ${data.isActive ? '' : 'opacity-70'}`}
      style={{ borderColor: data.color }}
    >
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground" />
      <div className="text-center">
        <p className="text-sm font-semibold leading-tight">{data.label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{data.years}</p>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground" />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  group: GroupNode,
};

export default function LineageFlow({ nodes: groupNodes, edges: groupEdges }: Props) {
  const t = useTranslations('politicalGroups');

  // Only include nodes that have edges (involved in lineage)
  const connectedIds = useMemo(() => {
    const ids = new Set<number>();
    for (const edge of groupEdges) {
      ids.add(edge.sourceGroupId);
      ids.add(edge.targetGroupId);
    }
    return ids;
  }, [groupEdges]);

  const filteredGroups = useMemo(
    () => groupNodes.filter((n) => connectedIds.has(n.id)),
    [groupNodes, connectedIds],
  );

  // Simple layered layout: group nodes by "generation" based on edge direction
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodeMap = new Map(filteredGroups.map((g) => [g.id, g]));

    // Build adjacency for topological sort
    const inDegree = new Map<number, number>();
    const adj = new Map<number, number[]>();
    for (const g of filteredGroups) {
      inDegree.set(g.id, 0);
      adj.set(g.id, []);
    }
    for (const e of groupEdges) {
      if (nodeMap.has(e.sourceGroupId) && nodeMap.has(e.targetGroupId)) {
        adj.get(e.sourceGroupId)!.push(e.targetGroupId);
        inDegree.set(e.targetGroupId, (inDegree.get(e.targetGroupId) ?? 0) + 1);
      }
    }

    // BFS topological layering
    const layers = new Map<number, number>();
    const queue: number[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) {
        queue.push(id);
        layers.set(id, 0);
      }
    }
    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentLayer = layers.get(current) ?? 0;
      for (const next of adj.get(current) ?? []) {
        const nextLayer = Math.max(layers.get(next) ?? 0, currentLayer + 1);
        layers.set(next, nextLayer);
        const newDeg = (inDegree.get(next) ?? 1) - 1;
        inDegree.set(next, newDeg);
        if (newDeg === 0) queue.push(next);
      }
    }

    // Assign positions based on layers
    const layerGroups = new Map<number, number[]>();
    for (const [id, layer] of layers) {
      const group = layerGroups.get(layer) ?? [];
      group.push(id);
      layerGroups.set(layer, group);
    }

    const X_GAP = 280;
    const Y_GAP = 100;
    const nodes: Node[] = [];
    for (const [layer, ids] of layerGroups) {
      ids.forEach((id, idx) => {
        const g = nodeMap.get(id)!;
        const yearRange = [g.foundedYear, g.dissolvedYear].filter(Boolean).join(' – ') || '';
        nodes.push({
          id: String(id),
          type: 'group',
          position: { x: layer * X_GAP, y: idx * Y_GAP },
          data: {
            label: g.shortName ?? g.canonicalName,
            color: g.color ?? '#6366f1',
            years: yearRange,
            isActive: g.isActive ?? false,
          },
        });
      });
    }

    const edges: Edge[] = groupEdges
      .filter((e) => nodeMap.has(e.sourceGroupId) && nodeMap.has(e.targetGroupId))
      .map((e) => ({
        id: `e-${e.id}`,
        source: String(e.sourceGroupId),
        target: String(e.targetGroupId),
        label: t(EDGE_LABELS[e.relationshipType] ?? e.relationshipType),
        type: 'default',
        animated: e.relationshipType === 'merged_into' || e.relationshipType === 'absorbed_by',
        style: {
          stroke: EDGE_COLORS[e.relationshipType] ?? '#6b7280',
          strokeWidth: 2,
        },
        labelStyle: {
          fontSize: 11,
          fontWeight: 500,
          fill: EDGE_COLORS[e.relationshipType] ?? '#6b7280',
        },
        labelBgStyle: {
          fill: 'hsl(var(--card))',
          fillOpacity: 0.9,
        },
      }));

    return { initialNodes: nodes, initialEdges: edges };
  }, [filteredGroups, groupEdges, t]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  // Legend
  const legendItems = [
    { type: 'merged_into', label: t('mergedInto'), color: '#3b82f6' },
    { type: 'split_from', label: t('splitFrom'), color: '#ef4444' },
    { type: 'renamed_to', label: t('renamedTo'), color: '#8b5cf6' },
    { type: 'absorbed_by', label: t('absorbedBy'), color: '#f59e0b' },
  ];

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {legendItems.map((item) => (
          <div key={item.type} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-5 rounded-sm"
              style={{ backgroundColor: item.color }}
            />
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {/* React Flow */}
      <div className="h-[500px] overflow-hidden rounded-xl border bg-card">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Controls showInteractive={false} />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        </ReactFlow>
      </div>
    </div>
  );
}
