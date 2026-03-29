import { useMemo, useState } from 'react';
import ReactFlow, { Background, Controls, MiniMap, type NodeProps, Position, Handle, type Edge, type Node, MarkerType } from 'reactflow';
import type { SpanViewModel, TraceSummary, TraceViewMode } from '../types/trace';
import { formatDuration, formatTime, shortTraceId } from '../utils/format';

interface TraceGraphProps {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId?: string;
  onSelectNode: (nodeId?: string) => void;
  summary?: TraceSummary;
  viewMode: TraceViewMode;
  mostlyInfraTrace: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

interface TraceNodeData {
  span: SpanViewModel;
  isMainPath?: boolean;
  isInfra?: boolean;
  faded?: boolean;
  highlighted?: boolean;
  comparisonState?: 'shared' | 'unique' | 'none';
}

function TraceNode({ data, selected }: NodeProps<TraceNodeData>) {
  const span = data.span;
  const slow = span.durationMs > 300;
  
  const classNames = [
    'trace-node',
    (selected || data.highlighted) ? 'trace-node-selected' : '',
    span.status === 'error' ? 'trace-node-error' : '',
    slow ? 'trace-node-slow' : '',
    data.isMainPath ? 'trace-node-main' : '',
    data.isInfra ? 'trace-node-infra' : '',
    data.faded ? 'trace-node-faded' : '',
    data.comparisonState === 'shared' ? 'trace-node-shared' : '',
    data.comparisonState === 'unique' ? 'trace-node-unique' : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={classNames}>
      <Handle type="target" position={Position.Left} className="trace-handle" />
      <div className="trace-node-header">
        <span className="trace-node-layer">{span.layer}</span>
        <span className={`status-pill ${span.status === 'error' ? 'status-error' : 'status-success'}`}>{span.status}</span>
      </div>
      <p className="trace-node-step">{span.step}</p>
      <p className="trace-node-meta">
        <span className="node-duration-meta">{formatDuration(span.durationMs)}</span> • {formatTime(span.timestamp)}
      </p>
      <Handle type="source" position={Position.Right} className="trace-handle" />
    </div>
  );
}

const nodeTypes = { traceNode: TraceNode };

export function TraceGraph({ nodes, edges, selectedNodeId, onSelectNode, summary, viewMode, mostlyInfraTrace, onMouseEnter, onMouseLeave }: TraceGraphProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | undefined>();

  const { ancestorIds, descendantIds } = useMemo(() => {
    const parents = new Map<string, string[]>();
    const children = new Map<string, string[]>();
    
    for (const edge of edges) {
      if (!parents.has(edge.target)) parents.set(edge.target, []);
      parents.get(edge.target)!.push(edge.source);
      
      if (!children.has(edge.source)) children.set(edge.source, []);
      children.get(edge.source)!.push(edge.target);
    }
    
    const getReachable = (start: string, graph: Map<string, string[]>) => {
      const result = new Set<string>();
      const queue = [start];
      while (queue.length > 0) {
        const n = queue.shift()!;
        if (!result.has(n)) {
          result.add(n);
          for (const next of graph.get(n) || []) queue.push(next);
        }
      }
      return result;
    };
    
    const focusNodeId = hoveredNodeId || selectedNodeId;
    if (!focusNodeId) return { ancestorIds: new Set(), descendantIds: new Set() };
    
    return {
      ancestorIds: getReachable(focusNodeId, parents),
      descendantIds: getReachable(focusNodeId, children),
    };
  }, [edges, hoveredNodeId, selectedNodeId]);

  const focusActive = !!(hoveredNodeId || selectedNodeId);

  const displayNodes = useMemo(() => {
    return nodes.map(node => {
      const isCustomData = Boolean((node.data as any)?.span);
      if (!isCustomData) return node;

      const nData = node.data as TraceNodeData;
      const inPath = ancestorIds.has(node.id) || descendantIds.has(node.id);
      const isFaded = focusActive ? !inPath : !nData.isMainPath;

      return {
        ...node,
        data: {
          ...nData,
          faded: isFaded,
          highlighted: focusActive && inPath,
        }
      } as Node;
    });
  }, [nodes, focusActive, ancestorIds, descendantIds]);

  const selectedEdges = useMemo(() => {
    return edges.map(edge => {
      const inPath = (ancestorIds.has(edge.source) || descendantIds.has(edge.source)) && 
                     (ancestorIds.has(edge.target) || descendantIds.has(edge.target));
      
      const isMain = !!edge.data?.isMainPath;
      const isFaded = focusActive ? !inPath : !isMain;
      
      const strokeColor = focusActive ? (inPath ? '#96b8ff' : '#46536b') : (isMain ? '#a3c2ff' : '#46536b');
      
      return {
        ...edge,
        animated: focusActive ? inPath : edge.animated,
        style: {
          stroke: strokeColor,
          strokeWidth: focusActive ? (inPath ? 2.8 : 1.2) : (isMain ? 2.8 : 1.5),
          opacity: isFaded ? 0.15 : (isMain || inPath ? 1 : 0.4)
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: strokeColor }
      };
    });
  }, [edges, focusActive, ancestorIds, descendantIds]);

  return (
    <section className="panel graph-panel" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <div className="panel-header">
        <h2>Trace Graph</h2>
        {summary ? (
          <p className="graph-caption">
            <span className={`view-mode-badge ${viewMode === 'business' ? 'view-mode-business' : 'view-mode-infra'}`}>
              {viewMode === 'business' ? 'Business Mode' : 'Infra Mode'}
            </span>{' '}
            {summary.method} {summary.route} • {formatDuration(summary.durationMs)} • {shortTraceId(summary.traceId)}
          </p>
        ) : null}
      </div>

      <div className="graph-canvas">
        {mostlyInfraTrace ? <div className="mode-empty-hint">This trace contains mostly infrastructure spans.</div> : null}
        <div className="layer-rails" aria-hidden>
          <span>Controller</span>
          <span>Service</span>
          <span>Repository</span>
          <span>Database</span>
        </div>
        <ReactFlow
          nodes={displayNodes}
          edges={selectedEdges}
          nodeTypes={nodeTypes}
          fitView
          onNodeClick={(_, node) => onSelectNode(node.id)}
          onNodeMouseEnter={(_, node) => setHoveredNodeId(node.id)}
          onNodeMouseLeave={() => setHoveredNodeId(undefined)}
          onPaneClick={() => onSelectNode(undefined)}
          minZoom={0.25}
          maxZoom={1.75}
        >
          <MiniMap zoomable pannable nodeStrokeWidth={2} style={{ background: '#0f141d' }} />
          <Controls showInteractive={false} />
          <Background gap={18} size={1} color="#1f2734" />
        </ReactFlow>
      </div>
    </section>
  );
}
