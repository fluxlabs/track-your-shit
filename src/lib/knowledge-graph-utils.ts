// Track Your Shit - Knowledge Graph Layout Utilities
// Helpers for positioning nodes in the ReactFlow graph
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import type { KnowledgeGraphNode, KnowledgeGraphEdge } from '@/lib/tauri';

export interface PositionedNode {
  id: string;
  type: string;
  data: {
    label: string;
    filePath: string;
    nodeType: string;
  };
  position: { x: number; y: number };
  style: {
    background: string;
    color: string;
    border: string;
    borderRadius: string;
    padding: string;
    fontSize: string;
    width: number;
  };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
  style?: Record<string, string>;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 50;
const HORIZONTAL_GAP = 60;
const VERTICAL_GAP = 40;

const FOLDER_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  docs: { bg: '#1a2332', border: '#8b5cf6', text: '#c4b5fd' },
  references: { bg: '#1a2e1a', border: '#22c55e', text: '#86efac' },
  root: { bg: '#2a1a1a', border: '#f97316', text: '#fdba74' },
  default: { bg: '#1e1e2e', border: '#64748b', text: '#cbd5e1' },
};

function getFolderFromPath(filePath: string): string {
  const parts = filePath.split('/');
  if (parts.length <= 1) return 'root';
  return parts[0];
}

function getNodeColor(nodeType: string, filePath: string) {
  const folder = getFolderFromPath(filePath);
  return FOLDER_COLORS[folder] ?? FOLDER_COLORS[nodeType] ?? FOLDER_COLORS.default;
}

/**
 * Lay out nodes in a grid/hierarchical pattern.
 * Groups nodes by folder, then arranges them in rows.
 */
export function layoutNodes(
  nodes: KnowledgeGraphNode[],
  edges: KnowledgeGraphEdge[],
): PositionedNode[] {
  if (nodes.length === 0) return [];

  // Group by folder
  const groups = new Map<string, KnowledgeGraphNode[]>();
  for (const node of nodes) {
    const folder = getFolderFromPath(node.file_path);
    if (!groups.has(folder)) groups.set(folder, []);
    groups.get(folder)!.push(node);
  }

  // Build adjacency for topological hint (nodes with more outgoing edges first)
  const outDegree = new Map<string, number>();
  for (const edge of edges) {
    outDegree.set(edge.source, (outDegree.get(edge.source) ?? 0) + 1);
  }

  const positioned: PositionedNode[] = [];
  let groupY = 0;

  for (const [, groupNodes] of groups) {
    // Sort by out-degree descending within group
    groupNodes.sort((a, b) => (outDegree.get(b.id) ?? 0) - (outDegree.get(a.id) ?? 0));

    const cols = Math.ceil(Math.sqrt(groupNodes.length));

    for (let i = 0; i < groupNodes.length; i++) {
      const node = groupNodes[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const colors = getNodeColor(node.node_type, node.file_path);

      positioned.push({
        id: node.id,
        type: 'default',
        data: {
          label: node.label,
          filePath: node.file_path,
          nodeType: node.node_type,
        },
        position: {
          x: col * (NODE_WIDTH + HORIZONTAL_GAP),
          y: groupY + row * (NODE_HEIGHT + VERTICAL_GAP),
        },
        style: {
          background: colors.bg,
          color: colors.text,
          border: `1px solid ${colors.border}`,
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '12px',
          width: NODE_WIDTH,
        },
      });
    }

    const rows = Math.ceil(groupNodes.length / Math.ceil(Math.sqrt(groupNodes.length)));
    groupY += rows * (NODE_HEIGHT + VERTICAL_GAP) + VERTICAL_GAP * 2;
  }

  return positioned;
}

/**
 * Create ReactFlow-compatible edge objects
 */
export function createFlowEdges(edges: KnowledgeGraphEdge[]): FlowEdge[] {
  return edges.map((edge, index) => ({
    id: `e-${edge.source}-${edge.target}-${index}`,
    source: edge.source,
    target: edge.target,
    label: edge.label ?? undefined,
    animated: false,
    style: { stroke: '#64748b' },
  }));
}
