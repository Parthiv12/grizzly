import { Injectable } from '@nestjs/common';
import * as http from 'node:http';
import * as https from 'node:https';
import { URL } from 'node:url';
import type { Layer, TraceEvent } from '../common/tracing/tracing.service';

type JaegerTag = {
  key: string;
  type: string;
  value: string | number | boolean;
};

type JaegerSpan = {
  traceID: string;
  spanID: string;
  operationName: string;
  startTime: number;
  duration: number;
  processID: string;
  tags?: JaegerTag[];
};

type JaegerProcess = {
  serviceName?: string;
  tags?: JaegerTag[];
};

type JaegerTrace = {
  traceID: string;
  spans: JaegerSpan[];
  processes?: Record<string, JaegerProcess>;
};

type JaegerResponse = {
  data?: JaegerTrace[];
};

@Injectable()
export class JaegerTracesService {
  private readonly baseUrl = process.env.JAEGER_QUERY_BASE_URL ?? 'http://localhost:16686';
  private readonly defaultServiceName = process.env.JAEGER_SERVICE_NAME ?? process.env.OTEL_SERVICE_NAME ?? 'debug-flow-visualizer-backend';
  private readonly lookback = process.env.JAEGER_LOOKBACK ?? '1h';
  private readonly limit = this.parsePositiveInt(process.env.JAEGER_TRACE_LIMIT, 50);

  async getAllTraceEvents(serviceName?: string): Promise<TraceEvent[]> {
    const resolvedServiceName = serviceName?.trim() || this.defaultServiceName;
    const url = new URL('/api/traces', this.baseUrl);
    url.searchParams.set('service', resolvedServiceName);
    url.searchParams.set('lookback', this.lookback);
    url.searchParams.set('limit', String(this.limit));

    const response = await this.getJson<JaegerResponse>(url);
    return this.mapTracesToEvents(response.data ?? [], resolvedServiceName);
  }

  async getTraceEvents(traceId: string, serviceName?: string): Promise<TraceEvent[]> {
    const resolvedServiceName = serviceName?.trim() || this.defaultServiceName;
    const url = new URL(`/api/traces/${traceId}`, this.baseUrl);
    const response = await this.getJson<JaegerResponse>(url);
    return this.mapTracesToEvents(response.data ?? [], resolvedServiceName).filter((event) => event.traceId === traceId);
  }

  async getServices(): Promise<string[]> {
    const url = new URL('/api/services', this.baseUrl);
    const response = await this.getJson<{ data?: string[] }>(url);
    return (response.data ?? []).filter((service) => typeof service === 'string' && service.trim().length > 0);
  }

  private mapTracesToEvents(traces: JaegerTrace[], selectedService: string): TraceEvent[] {
    const events: TraceEvent[] = [];

    for (const traceItem of traces) {
      const spans = traceItem.spans ?? [];

      if (!this.traceBelongsToService(traceItem, selectedService)) {
        continue;
      }

      const serverSpan = spans
        .filter((span) => this.tagMap(span.tags).get('span.kind') === 'server')
        .sort((a, b) => a.startTime - b.startTime)[0];

      if (serverSpan) {
        const tags = this.tagMap(serverSpan.tags);
        const startTs = Math.floor(serverSpan.startTime / 1000);
        const durationMs = Math.max(0, Math.round(serverSpan.duration / 1000));
        const method = this.tagString(tags, 'http.method') ?? 'GET';
        const url = this.tagString(tags, 'http.target') ?? this.tagString(tags, 'http.route') ?? '/unknown';
        const statusCode = this.tagNumber(tags, 'http.status_code') ?? 200;
        const process = traceItem.processes?.[serverSpan.processID];

        events.push({
          traceId: traceItem.traceID,
          layer: 'controller',
          step: 'request_received',
          status: statusCode >= 400 ? 'error' : 'success',
          timestamp: startTs,
          metadata: {
            method,
            url,
            serviceName: process?.serviceName ?? selectedService
          }
        });

        events.push({
          traceId: traceItem.traceID,
          layer: 'controller',
          step: 'request_completed',
          status: statusCode >= 400 ? 'error' : 'success',
          timestamp: startTs + durationMs,
          metadata: {
            statusCode,
            duration: durationMs,
            method,
            url,
            serviceName: process?.serviceName ?? selectedService
          }
        });
      }

      for (const span of spans) {
        const process = traceItem.processes?.[span.processID];
        if (process?.serviceName && process.serviceName !== selectedService) {
          continue;
        }

        const tags = this.tagMap(span.tags);
        const timestamp = Math.floor(span.startTime / 1000);
        const durationMs = Math.max(0, Math.round(span.duration / 1000));
        const statusCode = this.tagNumber(tags, 'http.status_code');
        const hasError = (this.tagString(tags, 'otel.status_code') ?? '').toUpperCase() === 'ERROR' || (typeof statusCode === 'number' && statusCode >= 400);

        events.push({
          traceId: span.traceID,
          layer: this.inferLayer(span.operationName, tags),
          step: this.toStep(span.operationName),
          status: hasError ? 'error' : 'success',
          timestamp,
          metadata: {
            operation: span.operationName,
            serviceName: process?.serviceName ?? selectedService,
            spanId: span.spanID,
            duration: durationMs,
            method: this.tagString(tags, 'http.method'),
            url: this.tagString(tags, 'http.target') ?? this.tagString(tags, 'http.route'),
            statusCode
          }
        });
      }
    }

    return events.sort((a, b) => a.timestamp - b.timestamp);
  }

  private traceBelongsToService(traceItem: JaegerTrace, selectedService: string): boolean {
    if (!selectedService) {
      return true;
    }

    const spans = traceItem.spans ?? [];
    const rootServerSpan = spans
      .filter((span) => this.tagMap(span.tags).get('span.kind') === 'server')
      .sort((a, b) => a.startTime - b.startTime)[0];

    if (rootServerSpan) {
      const process = traceItem.processes?.[rootServerSpan.processID];
      return process?.serviceName === selectedService;
    }

    return spans.some((span) => {
      const process = traceItem.processes?.[span.processID];
      return process?.serviceName === selectedService;
    });
  }

  private inferLayer(operationName: string, tags: Map<string, string | number | boolean>): Layer {
    const normalized = operationName.toLowerCase();

    if (normalized.includes('db') || normalized.includes('sql') || normalized.includes('postgres')) {
      return 'database';
    }
    if (normalized.includes('repository')) {
      return 'repository';
    }
    if (normalized.includes('service')) {
      return 'service';
    }

    const spanKind = String(tags.get('span.kind') ?? '').toLowerCase();
    if (spanKind === 'server') {
      return 'controller';
    }

    return 'service';
  }

  private toStep(operationName: string): string {
    const normalized = operationName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    return normalized || 'span';
  }

  private tagMap(tags: JaegerTag[] | undefined): Map<string, string | number | boolean> {
    const map = new Map<string, string | number | boolean>();
    for (const tag of tags ?? []) {
      map.set(tag.key, tag.value);
    }
    return map;
  }

  private tagString(tags: Map<string, string | number | boolean>, key: string): string | undefined {
    const value = tags.get(key);
    return typeof value === 'string' ? value : undefined;
  }

  private tagNumber(tags: Map<string, string | number | boolean>, key: string): number | undefined {
    const value = tags.get(key);
    return typeof value === 'number' ? value : undefined;
  }

  private parsePositiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return Math.floor(parsed);
  }

  private getJson<T>(url: URL): Promise<T> {
    const transport = url.protocol === 'https:' ? https : http;

    return new Promise<T>((resolve, reject) => {
      const req = transport.request(url, { method: 'GET' }, (res) => {
        let body = '';

        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          if ((res.statusCode ?? 500) >= 400) {
            reject(new Error(`Jaeger request failed with status ${res.statusCode}: ${body}`));
            return;
          }

          try {
            resolve(JSON.parse(body) as T);
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }
}
