import { Injectable } from '@nestjs/common';
import { MetricsProvider, RouteMetrics, ServiceMetrics } from './metrics.provider';
import { JaegerTracesService } from '../traces/jaeger-traces.service';

@Injectable()
export class HistoryMetricsProvider implements MetricsProvider {
  constructor(private readonly jaeger: JaegerTracesService) {}

  async getRouteMetrics(route: string, window: string, service?: string): Promise<RouteMetrics> {
    const traces = await this.jaeger.getAllTraceEvents(service);
    
    // Group purely based on traceId for a primitive aggregation 
    // In a real prom cluster, we'd query: sum(rate(http_requests_total{route="..."}[...])) 
    const grouped = new Map<string, any[]>();
    for (const t of traces) {
      if (!grouped.has(t.traceId)) grouped.set(t.traceId, []);
      grouped.get(t.traceId)!.push(t);
    }

    let requestCount = 0;
    let errorCount = 0;
    const latencies: number[] = [];
    let slowCount = 0;
    let dbHeavyCount = 0;

    for (const [traceId, events] of grouped.entries()) {
      // Find root span or try to determine route
      const rootSpan = events.find(e => e.layer === 'controller' && e.step.includes('request_received'));
      const traceRoute = rootSpan?.metadata?.url || rootSpan?.metadata?.route || '';
      
      const matchRoute = traceRoute.toLowerCase().includes(route.toLowerCase().split('?')[0]) || 
                         route.toLowerCase().includes(traceRoute.toLowerCase().split('?')[0]);
      
      if (!matchRoute && rootSpan) continue; // Skip if route doesn't closely match (heuristic for demo without full path parsing)
      if (!rootSpan && route !== "unknown") continue;

      requestCount++;
      const hasError = events.some(e => e.status === 'error');
      if (hasError) errorCount++;

      // Compute simple duration
      const minStart = Math.min(...events.map(e => e.timestamp));
      const maxEnd = Math.max(...events.map(e => (e.timestamp + (e.duration || 0))));
      const durationMs = maxEnd - minStart || 25; // fallback duration if it's 0 

      latencies.push(durationMs);

      if (durationMs > 500) slowCount++;
      
      const dbCalls = events.filter(e => e.layer === 'database').length;
      if (dbCalls > 5) dbHeavyCount++;
    }

    latencies.sort((a, b) => a - b);
    const avgLatencyMs = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    const p95LatencyMs = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] || latencies[latencies.length - 1] : 0;

    return {
      window,
      requestCount,
      successCount: requestCount - errorCount,
      errorCount,
      errorRate: requestCount > 0 ? errorCount / requestCount : 0,
      avgLatencyMs: Math.round(avgLatencyMs),
      p95LatencyMs: Math.round(p95LatencyMs),
      slowCount,
      dbHeavyCount,
      lastUpdated: new Date().toISOString()
    };
  }

  async getServiceMetrics(service: string, window: string): Promise<ServiceMetrics> {
    const traces = await this.jaeger.getAllTraceEvents(service);
    
    // Aggregate by service
    let requestCount = 0;
    let errorCount = 0;
    const latencies: number[] = [];
    let slowCount = 0;
    const layerCounts: Record<string, number> = {};

    const grouped = new Map<string, any[]>();
    for (const t of traces) {
      if (!grouped.has(t.traceId)) grouped.set(t.traceId, []);
      grouped.get(t.traceId)!.push(t);
    }

    for (const [traceId, events] of grouped.entries()) {
        const serviceEvents = events.filter(e => {
            const svc = e.metadata?.serviceName || 'unknown';
            return svc.includes(service) || service.includes(svc);
        });

        if (serviceEvents.length === 0) continue;

        requestCount++;
        if (serviceEvents.some(e => e.status === 'error')) errorCount++;

        const minStart = Math.min(...serviceEvents.map(e => e.timestamp));
        const maxEnd = Math.max(...serviceEvents.map(e => e.timestamp + (e.duration || 0)));
        const durationMs = maxEnd - minStart || 20;

        latencies.push(durationMs);
        if (durationMs > 500) slowCount++;

        serviceEvents.forEach(e => {
            layerCounts[e.layer] = (layerCounts[e.layer] || 0) + 1;
        });
    }

    latencies.sort((a, b) => a - b);
    const avgLatencyMs = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    const p95LatencyMs = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] || latencies[latencies.length - 1] : 0;

    let mostCommonBottleneck = 'none';
    let maxCount = 0;
    for (const [layer, count] of Object.entries(layerCounts)) {
        if (count > maxCount) {
            maxCount = count;
            mostCommonBottleneck = layer;
        }
    }

    return {
      window,
      requestCount,
      errorCount,
      errorRate: requestCount > 0 ? errorCount / requestCount : 0,
      avgLatencyMs: Math.round(avgLatencyMs),
      p95LatencyMs: Math.round(p95LatencyMs),
      slowCount,
      mostCommonBottleneck,
      lastUpdated: new Date().toISOString()
    };
  }
}
