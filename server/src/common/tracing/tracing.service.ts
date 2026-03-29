import { Injectable } from '@nestjs/common';
import { context as otelContext, trace, SpanStatusCode } from '@opentelemetry/api';

export type Layer = 'controller' | 'service' | 'repository' | 'database';

export interface TraceEvent {
  traceId: string;
  layer: Layer;
  step: string;
  status: 'success' | 'error';
  timestamp: number;
  duration?: number;
  error?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class TracingService {
  private events: TraceEvent[] = [];
  private readonly maxEvents: number;
  private readonly tracer = trace.getTracer('debug-flow-visualizer.tracing-service');

  constructor() {
    const parsed = Number(process.env.TRACE_EVENT_LIMIT ?? 2000);
    this.maxEvents = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 2000;
  }

  logEvent(traceId: string, layer: Layer, step: string, status: 'success' | 'error', metadata?: Record<string, any>) {
    const event: TraceEvent = {
      traceId,
      layer,
      step,
      status,
      timestamp: Date.now(),
      metadata
    };
    this.events.push(event);
    this.emitOpenTelemetry(event);
    this.trimEvents();
    return event;
  }

  getTrace(traceId: string) {
    return this.events.filter(e => e.traceId === traceId);
  }

  getAllTraces() {
    return this.events;
  }

  private trimEvents() {
    if (this.events.length <= this.maxEvents) {
      return;
    }
    const overflow = this.events.length - this.maxEvents;
    this.events.splice(0, overflow);
  }

  private emitOpenTelemetry(event: TraceEvent) {
    const parentContext = otelContext.active();
    const spanName = `${event.layer}.${event.step}`;
    const span = this.tracer.startSpan(spanName, {
      attributes: {
        'trace.request_id': event.traceId,
        'trace.layer': event.layer,
        'trace.step': event.step,
        'trace.status': event.status
      }
    }, parentContext);

    for (const [key, value] of Object.entries(event.metadata ?? {})) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        span.setAttribute(`trace.metadata.${key}`, value);
      } else {
        span.setAttribute(`trace.metadata.${key}`, JSON.stringify(value));
      }
    }

    if (event.status === 'error') {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: typeof event.metadata?.error === 'string' ? event.metadata.error : `${event.layer}.${event.step} failed`
      });
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }

    const activeSpan = trace.getSpan(parentContext);
    if (activeSpan) {
      activeSpan.addEvent(spanName, {
        layer: event.layer,
        status: event.status,
        step: event.step
      });
    }

    span.end();
  }
}
