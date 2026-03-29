import type { Edge, Node } from 'reactflow';
import type { RawTraceEvent, SpanViewModel, TraceHealth, TraceSummary } from '../types/trace';

const LAYER_ORDER: Record<string, number> = {
  controller: 0,
  service: 1,
  repository: 2,
  database: 3
};

const SLOW_TRACE_THRESHOLD_MS = 300;
const LAYER_GAP_X = 270;
const NODE_GAP_Y = 96;

export function groupEventsByTraceId(events: RawTraceEvent[]): Map<string, RawTraceEvent[]> {
  const grouped = new Map<string, RawTraceEvent[]>();
  for (const event of events) {
    const list = grouped.get(event.traceId) ?? [];
    list.push(event);
    grouped.set(event.traceId, list);
  }
  for (const [traceId, list] of grouped) {
    grouped.set(traceId, [...list].sort((a, b) => a.timestamp - b.timestamp));
  }
  return grouped;
}

export function createTraceSummaries(events: RawTraceEvent[]): TraceSummary[] {
  const grouped = groupEventsByTraceId(events);
  const summaries: TraceSummary[] = [];

  for (const [traceId, traceEvents] of grouped) {
    const req = traceEvents.find((e) => e.step === 'request_received');
    const completed = traceEvents.find((e) => e.step === 'request_completed');
    const pathEvent = traceEvents.find((e) => e.step === 'controller_execution_started');
    const hasError = traceEvents.some((e) => e.status === 'error');
    const durationMs = numberFromMetadata(completed?.metadata, 'duration') ?? 0;
    const statusCode = numberFromMetadata(completed?.metadata, 'statusCode') ?? (hasError ? 500 : 200);
    const startedAt = req?.timestamp ?? traceEvents[0]?.timestamp ?? Date.now();
    const method = stringFromMetadata(req?.metadata, 'method') ?? 'GET';
    const route = stringFromMetadata(req?.metadata, 'url') ?? stringFromMetadata(pathEvent?.metadata, 'path') ?? '/unknown';

    let health: TraceHealth = 'success';
    if (hasError || statusCode >= 400) {
      health = 'error';
    } else if (durationMs > SLOW_TRACE_THRESHOLD_MS) {
      health = 'slow';
    }

    summaries.push({
      traceId,
      method,
      route,
      statusCode,
      durationMs,
      startedAt,
      health,
      eventCount: traceEvents.length
    });
  }

  return summaries.sort((a, b) => b.startedAt - a.startedAt);
}

export function createSpanView(traceEvents: RawTraceEvent[]): SpanViewModel[] {
  const sorted = [...traceEvents].sort((a, b) => a.timestamp - b.timestamp);
  return sorted.map((event, index) => ({
    id: `${event.traceId}-${index}`,
    traceId: event.traceId,
    layer: event.layer,
    step: event.step,
    status: event.status,
    timestamp: event.timestamp,
    durationMs: numberFromMetadata(event.metadata, 'duration') ?? 0,
    metadata: event.metadata
  }));
}

export function createGraph(spans: SpanViewModel[]): { nodes: Node[]; edges: Edge[] } {
  const layerRowCount: Record<string, number> = {};

  const nodes: Node[] = spans.map((span) => {
    const layerX = LAYER_ORDER[span.layer] ?? 0;
    const layerRow = layerRowCount[span.layer] ?? 0;
    layerRowCount[span.layer] = layerRow + 1;

    return {
      id: span.id,
      position: {
        x: LAYER_GAP_X * layerX,
        y: NODE_GAP_Y * layerRow
      },
      data: { span },
      type: 'traceNode'
    };
  });

  const edges: Edge[] = spans.slice(1).map((span, index) => ({
    id: `edge-${index}`,
    source: spans[index].id,
    target: span.id,
    animated: spans[index].status === 'error' || span.status === 'error',
    style: { stroke: '#52607a', strokeWidth: 1.4, opacity: 0.9 }
  }));

  return { nodes, edges };
}

function numberFromMetadata(metadata: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = metadata?.[key];
  return typeof value === 'number' ? value : undefined;
}

function stringFromMetadata(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' ? value : undefined;
}
