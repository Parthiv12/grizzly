import type { Edge, Node } from 'reactflow';

export type EventLayer = 'controller' | 'service' | 'repository' | 'database';
export type EventStatus = 'success' | 'error';

export type GraphLayer = 'controller' | 'service' | 'repository' | 'db' | 'infra';

export interface RawTraceEvent {
  traceId: string;
  layer: EventLayer;
  step: string;
  status: EventStatus;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export type TraceHealth = 'success' | 'error' | 'slow';

export interface TraceSummary {
  traceId: string;
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  startedAt: number;
  health: TraceHealth;
  eventCount: number;
}

export interface SpanViewModel {
  id: string;
  traceId: string;
  layer: EventLayer;
  step: string;
  status: EventStatus;
  timestamp: number;
  durationMs: number;
  metadata?: Record<string, unknown>;
}

export interface GraphNodeData {
  id: string;
  name: string;
  layer: GraphLayer;
  durationMs: number;
  error?: boolean;
  errorMessage?: string;
}

export type LayerCounts = Record<GraphLayer, number>;

export interface GraphNodeMetrics {
  nodeCount: number;
  edgeCount: number;
  layers: LayerCounts;
  totalDurationMs: number;
}

export interface TraceGraphNode {
  id: string;
  name: string;
  layer: GraphLayer;
  duration: number;
  error?: boolean;
  errorMessage?: string;
}

export interface TraceGraphEdge {
  from: string;
  to: string;
}

export interface TraceGraphResponse {
  traceId: string;
  nodes: TraceGraphNode[];
  edges: TraceGraphEdge[];
}

export interface UiGraphModel {
  traceId: string;
  nodes: Node<GraphNodeData>[];
  edges: Edge[];
  metrics: GraphNodeMetrics;
  activeLayers: GraphLayer[];
}
