import { Injectable, NotFoundException } from '@nestjs/common';
import { JaegerTracesService, JaegerSpan, JaegerTrace, JaegerTag } from './jaeger-traces.service';

export type Category = 'db' | 'internal' | 'external' | 'cache' | 'unknown';

export interface TraceSummaryResponse {
  traceId: string;
  endpoint: string;
  status: 'success' | 'error';
  totalDurationMs: number;
  serviceCount: number;
  dbCallCount: number;
  slowestSpan: {
    id: string;
    name: string;
    durationMs: number;
    service: string;
  } | null;
  timingBreakdown: Record<Category, number>;
  insights: string[];
}

@Injectable()
export class TraceSummaryService {
  constructor(private readonly jaeger: JaegerTracesService) {}

  async getTraceSummary(traceId: string): Promise<TraceSummaryResponse> {
    const rawTrace = await this.jaeger.getRawTrace(traceId);
    if (!rawTrace) {
      throw new NotFoundException(`Trace ${traceId} not found`);
    }

    return this.processTrace(rawTrace);
  }

  private processTrace(trace: JaegerTrace): TraceSummaryResponse {
    const spans = trace.spans || [];
    
    // 1. Calculate duration based on the root span(s) or min start/max end
    let minStart = Infinity;
    let maxEnd = -Infinity;

    const services = new Set<string>();
    let dbCallCount = 0;
    let errorSpans = 0;
    
    let slowestSpan: JaegerSpan | null = null;
    let slowestDuration = -1;

    const timingBreakdown: Record<Category, number> = {
      db: 0,
      internal: 0,
      external: 0,
      cache: 0,
      unknown: 0,
    };

    let rootSpan: JaegerSpan | null = null;

    spans.forEach((span) => {
      // Find min/max time
      if (span.startTime < minStart) minStart = span.startTime;
      const endTime = span.startTime + span.duration;
      if (endTime > maxEnd) maxEnd = endTime;

      // Identify root span (no CHILD_OF references)
      const hasParent = span.references?.some((ref) => ref.refType === 'CHILD_OF');
      if (!hasParent) {
        if (!rootSpan || span.startTime < rootSpan.startTime) {
          rootSpan = span;
        }
      }

      // Track services
      const process = trace.processes?.[span.processID];
      const serviceName = process?.serviceName || 'unknown';
      services.add(serviceName);

      const durationMs = span.duration / 1000;
      if (durationMs > slowestDuration) {
        slowestDuration = durationMs;
        slowestSpan = span;
      }

      // Tags checking
      const tags = this.tagMap(span.tags);
      
      const hasError = String(tags.get('otel.status_code') || '').toUpperCase() === 'ERROR' || 
                       (typeof tags.get('http.status_code') === 'number' && Number(tags.get('http.status_code')) >= 400);
      if (hasError) errorSpans++;

      // Categorize
      const category = this.categorizeSpan(span.operationName, tags);
      timingBreakdown[category] += durationMs;

      if (category === 'db') {
        dbCallCount++;
      }
    });

    const totalDurationMs = maxEnd >= minStart ? Math.round((maxEnd - minStart) / 1000) : 0;
    
    // Endpoint estimation
    let endpoint = rootSpan?.operationName || 'Unknown Endpoint';
    let status: 'success' | 'error' = errorSpans > 0 ? 'error' : 'success';
    
    if (rootSpan) {
      const tags = this.tagMap(rootSpan.tags);
      const method = tags.get('http.method');
      const url = tags.get('http.target') || tags.get('http.route') || tags.get('http.url');
      if (method && url) {
        endpoint = `${method} ${url}`;
      }
      
      const statusCode = tags.get('http.status_code');
      if (typeof statusCode === 'number' && statusCode >= 400) {
        status = 'error';
      }
    }

    // Generate simple insights
    const insights: string[] = [];
    if (dbCallCount > 10) {
      insights.push(`DB-heavy request: ${dbCallCount} DB calls detected. Consider likely N+1 issues or batching opportunities.`);
    }
    
    if (errorSpans > 0) {
      insights.push(`Error origin: ${errorSpans} span(s) failed in this trace.`);
    }
    
    if (slowestSpan) {
      const pct = totalDurationMs > 0 ? (slowestDuration / totalDurationMs) * 100 : 0;
      if (pct > 50 && slowestDuration > 50) {
        insights.push(`Likely bottleneck: "${slowestSpan.operationName}" took ${Math.round(slowestDuration)}ms (${Math.round(pct)}% of total duration).`);
      }
    }
    
    if (totalDurationMs > 1000) {
      insights.push(`Slower than expected: total duration exceeds 1 second.`);
    }

    return {
      traceId: trace.traceID,
      endpoint,
      status,
      totalDurationMs,
      serviceCount: services.size,
      dbCallCount,
      slowestSpan: slowestSpan ? {
        id: slowestSpan.spanID,
        name: slowestSpan.operationName,
        durationMs: Math.round(slowestDuration),
        service: trace.processes?.[slowestSpan.processID]?.serviceName || 'unknown'
      } : null,
      timingBreakdown: {
        db: Math.round(timingBreakdown.db),
        internal: Math.round(timingBreakdown.internal),
        external: Math.round(timingBreakdown.external),
        cache: Math.round(timingBreakdown.cache),
        unknown: Math.round(timingBreakdown.unknown),
      },
      insights
    };
  }

  private categorizeSpan(operationName: string, tags: Map<string, string | number | boolean>): Category {
    const op = operationName.toLowerCase();
    const spanKind = String(tags.get('span.kind') || '').toLowerCase();
    
    if (op.includes('db') || op.includes('sql') || op.includes('postgres') || tags.has('db.system')) {
      return 'db';
    }
    if (op.includes('redis') || op.includes('cache')) {
      return 'cache';
    }
    if (spanKind === 'client' || tags.has('http.url')) {
      return 'external';
    }
    if (spanKind === 'server' || op.includes('service') || op.includes('controller')) {
      return 'internal';
    }
    return 'unknown';
  }

  private tagMap(tags: JaegerTag[] | undefined): Map<string, string | number | boolean> {
    const map = new Map<string, string | number | boolean>();
    for (const tag of tags || []) {
      map.set(tag.key, tag.value);
    }
    return map;
  }
}
