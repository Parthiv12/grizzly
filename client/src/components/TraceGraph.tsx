import { useMemo, useState, useEffect } from 'react';
import ReactFlow, { Background, Controls, MiniMap, type NodeProps, Position, Handle, type Edge, type Node, MarkerType, useReactFlow } from 'reactflow';
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
  onNodeHover?: (nodeId?: string) => void;
  onReplay?: () => void;
  replaying?: boolean;
  autoFocus?: boolean;
}

interface TraceNodeData {
  span: SpanViewModel;
  isMainPath?: boolean;
  isInfra?: boolean;
  faded?: boolean;
  highlighted?: boolean;
  comparisonState?: 'identical' | 'changed' | 'unique' | 'none';
  diffInfo?: any;
  isTraceA?: boolean;
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
    data.comparisonState === 'identical' ? 'trace-node-identical' : '',
    data.comparisonState === 'changed' ? 'trace-node-changed' : '',
    data.comparisonState === 'unique' ? 'trace-node-unique' : ''
  ].filter(Boolean).join(' ');

  const d = data.diffInfo;
  
  let tooltip = span.step;
  if (data.comparisonState === 'changed' && d?.durationDiffMs !== undefined) {
     const otherDurationMs = span.durationMs - d.durationDiffMs;
     const otherStatus = d.statusChanged ? (span.status === 'error' ? 'success' : 'error') : span.status;
     
     const durA = data.isTraceA ? span.durationMs : otherDurationMs;
     const durB = data.isTraceA ? otherDurationMs : span.durationMs;
     const statA = data.isTraceA ? span.status : otherStatus;
     const statB = data.isTraceA ? otherStatus : span.status;
     
     tooltip = `${span.step}\nA: ${Math.round(durA)}ms, ${statA}\nB: ${Math.round(durB)}ms, ${statB}\n${d.durationDiffMs > 0 ? '+' : ''}${Math.round(d.durationDiffMs)}ms`;
  }

  return (
    <div className={classNames} title={tooltip}>
      <Handle type="target" position={Position.Left} className="trace-handle" />
      <div className="trace-node-header">
        <span className="trace-node-layer">{span.layer}</span>
        {d?.isDivergencePoint && <span className="diff-divergence-pill" title="Execution paths branch from here">Diverged</span>}
        <span className={`status-pill ${span.status === 'error' ? 'status-error' : 'status-success'}`}>{span.status}</span>
      </div>
      <p className="trace-node-step">{span.step}</p>
      <p className="trace-node-meta" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span className="node-duration-meta">{formatDuration(span.durationMs)}</span>
        
        {d?.durationDiffMs && Math.abs(d.durationDiffMs) > 2 ? (
           <span className={`diff-duration-pill ${d.durationDiffMs > 0 ? 'slower' : 'faster'}`} title={d.durationDiffMs > 0 ? 'Slower than matched span' : 'Faster than matched span'}>
             {d.durationDiffMs > 0 ? '+' : ''}{d.durationDiffMs}ms
           </span>
        ) : null}
        
        <span>•</span>
        <span>{formatTime(span.timestamp)}</span>
      </p>
      <Handle type="source" position={Position.Right} className="trace-handle" />
    </div>
  );
}

function LayerLabelNode({ data }: { data: { label: string } }) {
  return (
    <div className="layer-label-node">
      {data.label}
    </div>
  );
}

const nodeTypes = { traceNode: TraceNode, layerLabel: LayerLabelNode };

function ViewFitter({ traceId, autoFocus, selectedNodeId, nodes }: { traceId?: string; autoFocus?: boolean; selectedNodeId?: string; nodes: Node[] }) {
  const { fitView, setCenter, getZoom } = useReactFlow();
  
  useEffect(() => {
    if (!autoFocus) return;

    window.requestAnimationFrame(() => {
      // If a node is explicitly selected, center on it
      if (selectedNodeId) {
        const node = nodes.find(n => n.id === selectedNodeId);
        if (node && node.position) {
          setCenter(node.position.x + (node.width ?? 200)/2, node.position.y + (node.height ?? 80)/2, { zoom: getZoom(), duration: 600 });
          return;
        }
      }

      // In compare mode, try to focus on divergence point or a changed node!
      const divergenceNode = nodes.find(n => n.data?.diffInfo?.isDivergencePoint);
      if (divergenceNode && divergenceNode.position) {
        setCenter(divergenceNode.position.x + 100, divergenceNode.position.y + 40, { zoom: Math.max(0.8, getZoom()), duration: 600 });
        return;
      }
      const topChangedNode = nodes.find(n => n.data?.comparisonState === 'changed' || n.data?.comparisonState === 'unique');
      if (topChangedNode && topChangedNode.position) {
        setCenter(topChangedNode.position.x + 100, topChangedNode.position.y + 40, { zoom: Math.max(0.8, getZoom()), duration: 600 });
        return;
      }

      // Otherwise fit the whole graph for a new trace
      fitView({ duration: 600, padding: 0.1 });
    });
  }, [traceId, selectedNodeId, autoFocus, fitView, setCenter, getZoom, nodes]);
  
  return null;
}

function GraphNavigation({ selectedNodeId, nodes }: { selectedNodeId?: string; nodes: Node[] }) {
  const { fitView, zoomIn, zoomOut, setCenter, getZoom } = useReactFlow();
  
  const handleCenterSelected = () => {
    if (selectedNodeId) {
      const node = nodes.find(n => n.id === selectedNodeId);
      if (node && node.position) {
        setCenter(node.position.x + (node.width ?? 200)/2, node.position.y + (node.height ?? 80)/2, { zoom: getZoom(), duration: 500 });
      }
    }
  };

  return (
    <div className="custom-graph-controls" style={{ position: 'absolute', bottom: '20px', left: '20px', zIndex: 5, display: 'flex', gap: '8px', background: 'rgba(15,23,42,0.85)', padding: '6px', borderRadius: '8px', border: '1px solid rgba(63,80,110,0.4)', backdropFilter: 'blur(4px)' }}>
      <button className="graph-control-btn" title="Zoom In" onClick={() => zoomIn({ duration: 300 })}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      </button>
      <button className="graph-control-btn" title="Zoom Out" onClick={() => zoomOut({ duration: 300 })}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      </button>
      <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }}></div>
      <button className="graph-control-btn" title="Fit to View" onClick={() => fitView({ duration: 500, padding: 0.1 })}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
      </button>
      <button className="graph-control-btn" title="Focus Selected Node" onClick={handleCenterSelected} disabled={!selectedNodeId}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
      </button>
    </div>
  );
}

export function TraceGraph({ 
  nodes, 
  edges, 
  selectedNodeId, 
  onSelectNode, 
  summary, 
  viewMode, 
  mostlyInfraTrace, 
  onMouseEnter, 
  onMouseLeave, 
  onNodeHover,
  onReplay,
  replaying,
  autoFocus
}: TraceGraphProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | undefined>();
  const [copied, setCopied] = useState(false);

  const handleCopyTraceId = () => {
    if (!summary?.traceId) return;
    navigator.clipboard.writeText(summary.traceId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
          <div className="graph-caption">
            <span className={`view-mode-badge ${viewMode === 'business' ? 'view-mode-business' : 'view-mode-infra'}`}>
              {viewMode === 'business' ? 'Logical Flow' : 'Raw Spans'}
            </span>
            <span className="caption-method">{summary.method} {summary.route}</span>
            <span className="caption-duration">{formatDuration(summary.durationMs)}</span>
            <button 
              type="button" 
              className={`trace-id-copy ${copied ? 'copied' : ''}`}
              onClick={handleCopyTraceId}
              title="Copy Trace ID"
              aria-label="Copy trace ID"
            >
              <span>{shortTraceId(summary.traceId)}</span>
              {copied ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  <span className="copy-text">Copied</span>
                </>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              )}
            </button>

            {onReplay && (
              <button
                type="button"
                className={`button button-replay ${replaying ? 'button-loading' : ''}`}
                onClick={onReplay}
                disabled={replaying}
                title="Re-run the original request and compare"
              >
                {replaying ? 'Replaying...' : 'Replay Request'}
              </button>
            )}
          </div>
        ) : null}
      </div>

      <div className="graph-canvas">
        {mostlyInfraTrace ? <div className="mode-empty-hint">This trace contains mostly infrastructure spans.</div> : null}
        <ReactFlow
          nodes={displayNodes}
          edges={selectedEdges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => {
             if (node.type === 'layerLabel') return;
             onSelectNode(node.id);
          }}
          onNodeMouseEnter={(_, node) => setHoveredNodeId(node.id)}
          onNodeMouseLeave={() => setHoveredNodeId(undefined)}
          onPaneClick={() => onSelectNode(undefined)}
          minZoom={0.25}
          maxZoom={1.75}
        >
          <MiniMap 
            zoomable 
            pannable 
            nodeStrokeWidth={2} 
            style={{ backgroundColor: '#111827' }} 
            maskColor="rgba(0,0,0,0.6)" 
            nodeColor={(n) => {
              if (n.data?.isInfra) return '#1f2937';
              if (n.data?.comparisonState === 'unique') return '#3b82f6';
              if (n.data?.comparisonState === 'changed') return '#eab308';
              return '#374151';
            }} 
          />
          <Background gap={18} size={1} color="#1f2734" />
          <ViewFitter traceId={summary?.traceId} autoFocus={autoFocus} selectedNodeId={selectedNodeId} nodes={nodes} />
          <GraphNavigation selectedNodeId={selectedNodeId} nodes={nodes} />
        </ReactFlow>
      </div>
    </section>
  );
}
