import type { Edge, Node } from 'reactflow';
import type {
  GraphLayer,
  GraphNodeData,
  GraphNodeMetrics,
  LayerCounts,
  TraceGraphResponse,
  TraceGraphNode,
  TraceGraphEdge,
  UiGraphModel
} from '../types/trace';

const LAYER_X: Record<GraphLayer, number> = {
  controller: 0,
  service: 1,
  repository: 2,
  db: 3,
  infra: 4
};

const LAYER_ORDER: GraphLayer[] = ['controller', 'service', 'repository', 'db', 'infra'];

const COLUMN_GAP = 280;
const ROW_GAP = 104;

export function transformTraceGraphToFlow(graph: TraceGraphResponse): UiGraphModel {
  const sortedNodes = graph.nodes.slice().sort((a: TraceGraphNode, b: TraceGraphNode) => {
    const byLayer = LAYER_X[a.layer] - LAYER_X[b.layer];
    if (byLayer !== 0) {
      return byLayer;
    }
    return a.name.localeCompare(b.name);
  });

  const metrics: GraphNodeMetrics = summarizeNodes(sortedNodes, graph.edges.length);
  const activeLayers = LAYER_ORDER.filter((layer) => metrics.layers[layer] > 0);
  const layerColumn = new Map(activeLayers.map((layer, index) => [layer, index] as const));

  const parentIdsByNode = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const parents = parentIdsByNode.get(edge.to) ?? [];
    parents.push(edge.from);
    parentIdsByNode.set(edge.to, parents);
  }

  const nodesByLayer = new Map<GraphLayer, TraceGraphResponse['nodes']>();
  for (const layer of LAYER_ORDER) {
    nodesByLayer.set(layer, sortedNodes.filter((node) => node.layer === layer));
  }

  const rowByNodeId = new Map<string, number>();
  const positionedNodes: TraceGraphResponse['nodes'] = [];

  for (const layer of activeLayers) {
    const layerNodes = (nodesByLayer.get(layer) ?? []).slice();
    layerNodes.sort((a: TraceGraphNode, b: TraceGraphNode) => compareNodesWithinLayer(a, b, parentIdsByNode, rowByNodeId));

    let rowCursor = 0;
    let previousParentGroup = '';

    for (const node of layerNodes) {
      const parentGroup = parentGroupKey(parentIdsByNode.get(node.id) ?? [], rowByNodeId);
      if (previousParentGroup && parentGroup && previousParentGroup !== parentGroup) {
        rowCursor += 1;
      }

      rowByNodeId.set(node.id, rowCursor);
      rowCursor += 1;
      previousParentGroup = parentGroup;
      positionedNodes.push(node);
    }
  }

  const flowNodes: Array<Node<GraphNodeData>> = positionedNodes.map((node: TraceGraphNode) => ({
    id: node.id,
    type: 'traceNode',
    position: {
      x: (layerColumn.get(node.layer) ?? 0) * COLUMN_GAP,
      y: (rowByNodeId.get(node.id) ?? 0) * ROW_GAP
    },
    data: {
      id: node.id,
      name: node.name,
      layer: node.layer,
      durationMs: node.duration,
      error: node.error,
      errorMessage: node.errorMessage
    }
  }));

  const visibleNodeIds = new Set(flowNodes.map((node: Node<GraphNodeData>) => node.id));

  const flowEdges: Edge[] = graph.edges
    .filter((edge: TraceGraphEdge) => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to))
    .map((edge: TraceGraphEdge) => ({
      id: `edge-${edge.from}-${edge.to}`,
      source: edge.from,
      target: edge.to,
      style: {
        stroke: '#4f607b',
        strokeWidth: 1.8,
        opacity: 0.9
      }
    }));

  return {
    traceId: graph.traceId,
    nodes: flowNodes,
    edges: flowEdges,
    metrics,
    activeLayers
  };
}

function compareNodesWithinLayer(
  a: TraceGraphResponse['nodes'][number],
  b: TraceGraphResponse['nodes'][number],
  parentIdsByNode: Map<string, string[]>,
  rowByNodeId: Map<string, number>
): number {
  const aParents = parentIdsByNode.get(a.id) ?? [];
  const bParents = parentIdsByNode.get(b.id) ?? [];

  const aBarycenter = barycenter(aParents, rowByNodeId);
  const bBarycenter = barycenter(bParents, rowByNodeId);

  if (aBarycenter !== bBarycenter) {
    return aBarycenter - bBarycenter;
  }

  const aParentKey = parentGroupKey(aParents, rowByNodeId);
  const bParentKey = parentGroupKey(bParents, rowByNodeId);

  if (aParentKey !== bParentKey) {
    return aParentKey.localeCompare(bParentKey);
  }

  const byDuration = b.duration - a.duration;
  if (byDuration !== 0) {
    return byDuration;
  }

  return a.name.localeCompare(b.name);
}

function barycenter(parentIds: string[], rowByNodeId: Map<string, number>): number {
  if (parentIds.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  let sum = 0;
  let count = 0;
  for (const parentId of parentIds) {
    const row = rowByNodeId.get(parentId);
    if (typeof row === 'number') {
      sum += row;
      count += 1;
    }
  }

  if (count === 0) {
    return Number.POSITIVE_INFINITY;
  }

  return sum / count;
}

function parentGroupKey(parentIds: string[], rowByNodeId: Map<string, number>): string {
  return parentIds
    .map((id) => ({ id, row: rowByNodeId.get(id) ?? Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.row - b.row)
    .map((item) => item.id)
    .join('|');
}

function summarizeNodes(nodes: TraceGraphResponse['nodes'], edgeCount: number): GraphNodeMetrics {
  const layers: LayerCounts = {
    controller: 0,
    service: 0,
    repository: 0,
    db: 0,
    infra: 0
  };

  let totalDurationMs = 0;

  for (const node of nodes) {
    layers[node.layer] += 1;
    totalDurationMs += Math.max(0, node.duration);
  }

  return {
    nodeCount: nodes.length,
    edgeCount,
    layers,
    totalDurationMs
  };
}
