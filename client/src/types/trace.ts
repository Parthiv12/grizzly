export type EventLayer = 'controller' | 'service' | 'repository' | 'database';
export type EventStatus = 'success' | 'error';

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
