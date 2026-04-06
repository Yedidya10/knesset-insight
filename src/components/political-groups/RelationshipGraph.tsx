'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useMemo } from 'react';
import { Link } from '@/i18n/navigation';

interface NodeData {
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
  nodes: NodeData[];
  edges: EdgeData[];
}

const WIDTH = 900;
const HEIGHT = 600;
const NODE_RADIUS = 24;

interface SimNode extends NodeData {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export default function RelationshipGraph({ nodes, edges }: Props) {
  const t = useTranslations('politicalGroups');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Only include nodes that have edges
  const connectedNodeIds = useMemo(() => {
    const ids = new Set<number>();
    for (const edge of edges) {
      ids.add(edge.sourceGroupId);
      ids.add(edge.targetGroupId);
    }
    return ids;
  }, [edges]);

  const filteredNodes = useMemo(
    () => nodes.filter((n) => connectedNodeIds.has(n.id)),
    [nodes, connectedNodeIds],
  );

  // Simple force-directed layout using canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || filteredNodes.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize node positions in a circle
    const simNodes: SimNode[] = filteredNodes.map((n, i) => {
      const angle = (2 * Math.PI * i) / filteredNodes.length;
      return {
        ...n,
        x: WIDTH / 2 + (WIDTH / 3) * Math.cos(angle),
        y: HEIGHT / 2 + (HEIGHT / 3) * Math.sin(angle),
        vx: 0,
        vy: 0,
      };
    });

    const nodeMap = new Map(simNodes.map((n) => [n.id, n]));

    // Force simulation
    const REPULSION = 5000;
    const ATTRACTION = 0.005;
    const DAMPING = 0.9;
    const CENTER_PULL = 0.01;
    const ITERATIONS = 200;

    for (let iter = 0; iter < ITERATIONS; iter++) {
      // Repulsion between all pairs
      for (let i = 0; i < simNodes.length; i++) {
        for (let j = i + 1; j < simNodes.length; j++) {
          const dx = simNodes[j].x - simNodes[i].x;
          const dy = simNodes[j].y - simNodes[i].y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = REPULSION / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          simNodes[i].vx -= fx;
          simNodes[i].vy -= fy;
          simNodes[j].vx += fx;
          simNodes[j].vy += fy;
        }
      }

      // Attraction along edges
      for (const edge of edges) {
        const source = nodeMap.get(edge.sourceGroupId);
        const target = nodeMap.get(edge.targetGroupId);
        if (!source || !target) continue;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const fx = dx * ATTRACTION;
        const fy = dy * ATTRACTION;
        source.vx += fx;
        source.vy += fy;
        target.vx -= fx;
        target.vy -= fy;
      }

      // Center pull
      for (const node of simNodes) {
        node.vx += (WIDTH / 2 - node.x) * CENTER_PULL;
        node.vy += (HEIGHT / 2 - node.y) * CENTER_PULL;
      }

      // Apply velocity
      for (const node of simNodes) {
        node.vx *= DAMPING;
        node.vy *= DAMPING;
        node.x += node.vx;
        node.y += node.vy;
        // Clamp to bounds
        node.x = Math.max(NODE_RADIUS + 60, Math.min(WIDTH - NODE_RADIUS - 60, node.x));
        node.y = Math.max(NODE_RADIUS + 10, Math.min(HEIGHT - NODE_RADIUS - 10, node.y));
      }
    }

    // Render
    const dpr = window.devicePixelRatio || 1;
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${WIDTH}px`;
    canvas.style.height = `${HEIGHT}px`;

    // Background
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Draw edges
    const edgeColors: Record<string, string> = {
      merged_into: '#3b82f6',
      split_from: '#ef4444',
      renamed_to: '#8b5cf6',
      absorbed_by: '#f59e0b',
    };

    for (const edge of edges) {
      const source = nodeMap.get(edge.sourceGroupId);
      const target = nodeMap.get(edge.targetGroupId);
      if (!source || !target) continue;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.strokeStyle = edgeColors[edge.relationshipType] ?? '#6b7280';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Arrow head
      const angle = Math.atan2(target.y - source.y, target.x - source.x);
      const arrowX = target.x - NODE_RADIUS * Math.cos(angle);
      const arrowY = target.y - NODE_RADIUS * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(
        arrowX - 8 * Math.cos(angle - 0.3),
        arrowY - 8 * Math.sin(angle - 0.3),
      );
      ctx.lineTo(
        arrowX - 8 * Math.cos(angle + 0.3),
        arrowY - 8 * Math.sin(angle + 0.3),
      );
      ctx.closePath();
      ctx.fillStyle = edgeColors[edge.relationshipType] ?? '#6b7280';
      ctx.fill();
    }

    // Draw nodes
    for (const node of simNodes) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, NODE_RADIUS, 0, 2 * Math.PI);
      ctx.fillStyle = node.isActive ? (node.color ?? '#6366f1') : '#9ca3af';
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = node.isActive ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Label
      const label = node.shortName ?? node.canonicalName;
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      // Truncate if too long
      const displayLabel = label.length > 10 ? label.slice(0, 9) + '…' : label;
      ctx.fillText(displayLabel, node.x, node.y);
    }
  }, [filteredNodes, edges]);

  // Legend
  const legendItems = [
    { type: 'merged_into', label: t('mergedInto'), color: '#3b82f6' },
    { type: 'split_from', label: t('splitFrom'), color: '#ef4444' },
    { type: 'renamed_to', label: t('renamedTo'), color: '#8b5cf6' },
    { type: 'absorbed_by', label: t('absorbedBy'), color: '#f59e0b' },
  ];

  return (
    <div ref={containerRef} className="space-y-3">
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

      {/* Canvas */}
      <div className="overflow-x-auto rounded-xl border bg-card p-2">
        <canvas
          ref={canvasRef}
          style={{ width: WIDTH, height: HEIGHT }}
          className="mx-auto block"
        />
      </div>
    </div>
  );
}
