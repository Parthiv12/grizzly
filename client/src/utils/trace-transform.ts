import type { Edge, Node } from 'reactflow';
import type { RawTraceEvent, SpanViewModel, TraceHealth, TraceSummary, TraceViewMode } from '../types/trace';

const LAYER_ORDER: Record<string, number> = {
  controller: 0,
  service: 1,
  repository: 2,
  database: 3
};

const SLOW_TRACE_THRESHOLD_MS = 300;
const LAYER_GAP_X = 270;
const NODE_GAP_Y = 96;

const INFRA_STEP_PATTERNS = [
  /^tcp_connect$/,
  /^dns_lookup$/,
  /^pg_connect$/,
  /^pg_pool_connect$/,
  /^middleware_/,
  /^expressinit$/,
  /^jsonparser$/,
  /^urlencodedparser$/,
  /^lookup$/,
  /^socket_/,
  /^net_/,
  /^tls_/
];

export function classifySpan(span: Pick<RawTraceEvent | SpanViewModel, 'layer' | 'step' | 'metadata'>): 'business' | 'infra' {
  const step = span.step.toLowerCase();
  const operation = (stringFromMetadata(span.metadata, 'operation') ?? '').toLowerCase();
  const method = (stringFromMetadata(span.metadata, 'method') ?? '').toUpperCase();
  const route = (stringFromMetadata(span.metadata, 'url') ?? stringFromMetadata(span.metadata, 'path') ?? '').toLowerCase();
  const combinedName = `${step} ${operation}`;

  if (route && route !== '/unknown' && route !== '/traces' && !route.startsWith('/api/traces') && method) {
    return 'business';
  }

  if (INFRA_STEP_PATTERNS.some((pattern) => pattern.test(step))) {
    return 'infra';
  }

  if (combinedName.includes('otel') || combinedName.includes('instrumentation')) {
    return 'infra';
  }

  if (span.layer === 'database') {
    if (/(query|insert|update|delete|select|db\.query|pg_query)/.test(combinedName)) {
      return 'business';
    }
    return 'infra';
  }

  if (span.layer === 'controller' || span.layer === 'repository') {
    return 'business';
  }

  if (span.layer === 'service') {
    if (
      /(controller|service|repository|request_received|request_completed|create|update|delete|get|post|put|patch|query|issue|auth)/.test(combinedName)
    ) {
      return 'business';
    }
    return 'infra';
  }

  if (!route || route === '/unknown') {
    return 'infra';
  }

  return 'business';
}

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

export function createTraceSummaries(events: RawTraceEvent[], viewMode: TraceViewMode): TraceSummary[] {
  const grouped = groupEventsByTraceId(events);
  const summaries: TraceSummary[] = [];

  for (const [traceId, allTraceEvents] of grouped) {
    const businessEvents = allTraceEvents.filter((event) => classifySpan(event) === 'business');
    const infraEvents = allTraceEvents.filter((event) => classifySpan(event) === 'infra');
    const traceEvents = viewMode === 'business' ? businessEvents : allTraceEvents;

    if (traceEvents.length === 0) {
      continue;
    }

    const req = traceEvents.find((e) => e.step === 'request_received') ?? allTraceEvents.find((e) => e.step === 'request_received');
    const completed = traceEvents.find((e) => e.step === 'request_completed') ?? allTraceEvents.find((e) => e.step === 'request_completed');
    const pathEvent = traceEvents.find((e) => e.step === 'controller_execution_started') ?? allTraceEvents.find((e) => e.step === 'controller_execution_started');
    const hasError = traceEvents.some((e) => e.status === 'error');
    const durationMs = numberFromMetadata(completed?.metadata, 'duration') ?? 0;
    const statusCode = numberFromMetadata(completed?.metadata, 'statusCode') ?? (hasError ? 500 : 200);
    const startedAt = req?.timestamp ?? allTraceEvents[0]?.timestamp ?? Date.now();
    const method = stringFromMetadata(req?.metadata, 'method') ?? 'GET';
    const route = stringFromMetadata(req?.metadata, 'url') ?? stringFromMetadata(pathEvent?.metadata, 'path') ?? '/unknown';
    const hasDatabaseInteraction = allTraceEvents.some((event) => {
      const operation = (stringFromMetadata(event.metadata, 'operation') ?? '').toLowerCase();
      return event.layer === 'database' || operation.includes('query') || event.step.includes('pg_query');
    });

    const meaningfulRoute = route !== '/unknown' && route !== '/traces' && !route.startsWith('/api/traces');
    const priorityScore = businessEvents.length * 3 + (hasDatabaseInteraction ? 4 : 0) + (meaningfulRoute ? 2 : 0) - infraEvents.length;

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
      eventCount: traceEvents.length,
      businessSpanCount: businessEvents.length,
      infraSpanCount: infraEvents.length,
      hasDatabaseInteraction,
      priorityScore
    });
  }

  return summaries.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }
    return b.startedAt - a.startedAt;
  });
}

export function createSpanView(traceEvents: RawTraceEvent[], viewMode: TraceViewMode): SpanViewModel[] {
  const sorted = [...traceEvents].sort((a, b) => a.timestamp - b.timestamp);
  const scopedEvents = viewMode === 'business' ? sorted.filter((event) => classifySpan(event) === 'business') : sorted;

  return scopedEvents.map((event, index) => ({
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

  const stack: SpanViewModel[] = [];
  const parentOf = new Map<string, string>();

  for (const span of spans) {
    const lInd = LAYER_ORDER[span.layer] ?? 0;
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const topInd = LAYER_ORDER[top.layer] ?? 0;
      if (topInd < lInd) {
        break;
      }
      stack.pop();
    }
    if (stack.length > 0) {
      parentOf.set(span.id, stack[stack.length - 1].id);
    }
    stack.push(span);
  }

  const depth = new Map<string, number>();
  let maxDepth = -1;
  let deepestSpanId = '';

  for (const span of spans) {
    const parentId = parentOf.get(span.id);
    const d = parentId ? (depth.get(parentId) ?? 0) + 1 : 0;
    depth.set(span.id, d);

    if (d > maxDepth) {
      maxDepth = d;
      deepestSpanId = span.id;
    }
  }

  const mainPath = new Set<string>();
  let curr: string | undefined = deepestSpanId;
  while (curr) {
    mainPath.add(curr);
    curr = parentOf.get(curr);
  }

  spans.forEach((s) => {
    const l = s.layer;
    layerRowCount[l] = (layerRowCount[l] ?? 0) + 1;
  });
  const maxRows = Math.max(...Object.values(layerRowCount), 0);

  const NODE_GAP_Y = 160;
  const LAYER_GAP_X = 350;

  const currentLayerRow: Record<string, number> = {};

  const nodes: Node[] = spans.map((span) => {
    const layerX = LAYER_ORDER[span.layer] ?? 0;
    const lStr = span.layer;
    const row = currentLayerRow[lStr] ?? 0;
    currentLayerRow[lStr] = row + 1;

    const layerTotal = layerRowCount[lStr] ?? 1;
    const yOffset = ((maxRows - layerTotal) * NODE_GAP_Y) / 2;

    const isInfra = classifySpan(span) === 'infra';
    const inMainPath = mainPath.has(span.id);

    return {
      id: span.id,
      position: {
        x: layerX * LAYER_GAP_X + (isInfra ? 32 : 0),
        y: row * NODE_GAP_Y + yOffset
      },
      data: { span, isMainPath: inMainPath, isInfra },
      type: 'traceNode'
    };
  });

  const edges: Edge[] = spans
    .filter((span) => parentOf.has(span.id))
    .map((span) => {
      const parentId = parentOf.get(span.id)!;
      const isMainPath = mainPath.has(span.id) && mainPath.has(parentId);

      return {
        id: `edge-${parentId}-${span.id}`,
        source: parentId,
        target: span.id,
        type: 'default',
        animated: isMainPath,
        data: { isMainPath },
        style: isMainPath
          ? { stroke: '#96b8ff', strokeWidth: 3, opacity: 1 }
          : { stroke: '#46536b', strokeWidth: 1.5, opacity: 0.3 }
      };
    });

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
