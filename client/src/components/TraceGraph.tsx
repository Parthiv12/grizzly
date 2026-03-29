import { useMemo } from 'react';
import ReactFlow, { Background, Controls, MiniMap, type NodeProps, Position, Handle, type Edge, type Node } from 'reactflow';
import type { SpanViewModel, TraceSummary } from '../types/trace';
import { formatDuration, formatTime, shortTraceId } from '../utils/format';

interface TraceGraphProps {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId?: string;
  onSelectNode: (nodeId?: string) => void;
  summary?: TraceSummary;
}

interface TraceNodeData {
  span: SpanViewModel;
}

function TraceNode({ data, selected }: NodeProps<TraceNodeData>) {
  const span = data.span;
  const slow = span.durationMs > 300;
  return (
    <div className={`trace-node ${selected ? 'trace-node-selected' : ''} ${span.status === 'error' ? 'trace-node-error' : ''} ${slow ? 'trace-node-slow' : ''}`}>
      <Handle type="target" position={Position.Left} className="trace-handle" />
      <div className="trace-node-header">
        <span className="trace-node-layer">{span.layer}</span>
        <span className={`status-pill ${span.status === 'error' ? 'status-error' : 'status-success'}`}>{span.status}</span>
      </div>
      <p className="trace-node-step">{span.step}</p>
      <p className="trace-node-meta">
        {formatDuration(span.durationMs)} • {formatTime(span.timestamp)}
      </p>
      <Handle type="source" position={Position.Right} className="trace-handle" />
    </div>
  );
}

const nodeTypes = { traceNode: TraceNode };

export function TraceGraph({ nodes, edges, selectedNodeId, onSelectNode, summary }: TraceGraphProps) {
  const selectedIndex = selectedNodeId ? Number(selectedNodeId.split('-').pop()) : Number.NaN;

  const selectedEdges = useMemo(() => {
    if (!selectedNodeId) {
      return edges;
    }
    return edges.map((edge) => ({
      ...edge,
      style: (() => {
        const sourceIndex = Number(edge.source.split('-').pop());
        const targetIndex = Number(edge.target.split('-').pop());
        const isInSelectedPath = !Number.isNaN(selectedIndex) && sourceIndex <= selectedIndex && targetIndex <= selectedIndex + 1;
        const isAdjacent = edge.source === selectedNodeId || edge.target === selectedNodeId;

        if (isAdjacent || isInSelectedPath) {
          return { stroke: '#96b8ff', strokeWidth: isAdjacent ? 2.4 : 2, opacity: 1 };
        }
        return { stroke: '#46536b', strokeWidth: 1.2, opacity: 0.28 };
      })()
    }));
  }, [edges, selectedIndex, selectedNodeId]);

  return (
    <section className="panel graph-panel">
      <div className="panel-header">
        <h2>Trace Graph</h2>
        {summary ? (
          <p className="graph-caption">
            {summary.method} {summary.route} • {formatDuration(summary.durationMs)} • {shortTraceId(summary.traceId)}
          </p>
        ) : null}
      </div>

      <div className="graph-canvas">
        <div className="layer-rails" aria-hidden>
          <span>Controller</span>
          <span>Service</span>
          <span>Repository</span>
          <span>Database</span>
        </div>
        <ReactFlow
          nodes={nodes}
          edges={selectedEdges}
          nodeTypes={nodeTypes}
          fitView
          onNodeClick={(_, node) => onSelectNode(node.id)}
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
