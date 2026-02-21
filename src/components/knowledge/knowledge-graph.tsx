// Track Your Shit - Knowledge Graph Visualization
// ReactFlow-based graph view of knowledge file relationships
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useMemo, useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { buildKnowledgeGraph } from '@/lib/tauri';
import {
  layoutNodes,
  createFlowEdges,
  PositionedNode,
} from '@/lib/knowledge-graph-utils';
import { Loader2, AlertCircle, Search, Maximize, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface KnowledgeGraphProps {
  projectPath: string;
  onSelectFile: (filePath: string) => void;
}

function KnowledgeGraphInner({
  projectPath,
  onSelectFile,
}: KnowledgeGraphProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const { fitView } = useReactFlow();

  const {
    data: graphData,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.knowledgeGraph(projectPath),
    queryFn: () => buildKnowledgeGraph(projectPath),
    enabled: !!projectPath,
    staleTime: 60000,
  });

  // Collect unique node types for filter dropdown
  const nodeTypes = useMemo(() => {
    if (!graphData) return [];
    const types = new Set(graphData.nodes.map((n) => n.node_type));
    return Array.from(types).sort();
  }, [graphData]);

  const initialNodes = useMemo(() => {
    if (!graphData) return [];
    return layoutNodes(graphData.nodes, graphData.edges);
  }, [graphData]);

  const initialEdges = useMemo(() => {
    if (!graphData) return [];
    return createFlowEdges(graphData.edges);
  }, [graphData]);

  // Apply search/filter highlighting to nodes
  const styledNodes = useMemo(() => {
    if (!searchQuery && typeFilter === 'all') return initialNodes;

    const query = searchQuery.toLowerCase();

    return initialNodes.map((node: PositionedNode) => {
      const matchesSearch = !query || node.data.label.toLowerCase().includes(query);
      const matchesType =
        typeFilter === 'all' || node.data.nodeType === typeFilter;
      const isMatch = matchesSearch && matchesType;

      if (!isMatch) {
        return {
          ...node,
          style: {
            ...node.style,
            opacity: 0.25,
          },
        };
      }

      if (query) {
        return {
          ...node,
          style: {
            ...node.style,
            border: '2px solid #f59e0b',
            boxShadow: '0 0 8px rgba(245, 158, 11, 0.4)',
          },
        };
      }

      return node;
    });
  }, [initialNodes, searchQuery, typeFilter]);

  const [nodes, setNodes, onNodesChange] = useNodesState(styledNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync nodes/edges when graph data or filters change
  useEffect(() => {
    setNodes(styledNodes);
  }, [styledNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: { data: { filePath?: string } }) => {
      const filePath = node.data?.filePath;
      if (filePath && typeof filePath === 'string') {
        onSelectFile(filePath);
      }
    },
    [onSelectFile],
  );

  const handleFitView = useCallback(() => {
    void fitView({ padding: 0.2, duration: 300 });
  }, [fitView]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm">Failed to load knowledge graph</p>
      </div>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
        <p className="text-sm">No knowledge graph data available</p>
        <p className="text-xs mt-1">
          Add cross-references between knowledge files to see connections
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col" style={{ minHeight: 400 }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-border/50 bg-card/50 flex-shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
          {searchQuery && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="Node type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {nodeTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={handleFitView}
        >
          <Maximize className="h-3.5 w-3.5 mr-1.5" />
          Fit View
        </Button>
      </div>

      {/* Graph */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
          className="bg-background"
        >
          <Background color="#333" gap={20} />
          <Controls className="bg-card border rounded-lg" />
          <MiniMap
            nodeColor={(node) => {
              const style = node.style as { border?: string } | undefined;
              return style?.border?.replace('1px solid ', '') ?? '#64748b';
            }}
            className="bg-card border rounded-lg"
            maskColor="rgba(0,0,0,0.5)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}

export function KnowledgeGraph(props: KnowledgeGraphProps) {
  return (
    <ReactFlowProvider>
      <KnowledgeGraphInner {...props} />
    </ReactFlowProvider>
  );
}
