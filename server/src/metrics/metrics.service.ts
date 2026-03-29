import { Injectable, NotFoundException } from '@nestjs/common';
import { MetricsProvider, TraceContextMetrics } from './metrics.provider';
import { JaegerTracesService } from '../traces/jaeger-traces.service';
import { TraceSummaryService } from '../traces/trace-summary.service';

@Injectable()
export class MetricsService {
  constructor(
    private readonly provider: MetricsProvider,
    private readonly summaryProvider: TraceSummaryService
  ) {}

  async getRouteMetrics(route: string, window: string) {
    if (!route) throw new NotFoundException('Route parameter is required');
    return this.provider.getRouteMetrics(route, window);
  }

  async getServiceMetrics(service: string, window: string) {
    if (!service) throw new NotFoundException('Service parameter is required');
    return this.provider.getServiceMetrics(service, window);
  }

  async getTraceContextMetrics(traceId: string, window: string = '15m'): Promise<TraceContextMetrics> {
    const summary = await this.summaryProvider.getTraceSummary(traceId);
    
    let route = summary.endpoint;
    let service = summary.slowestSpan?.service || 'unknown';

    // If endpoint has METHOD URL, keep it or normalize it
    const routeParts = route.split(' ');
    if (routeParts.length > 1) route = routeParts[1];

    const [routeMetrics, serviceMetrics] = await Promise.all([
      this.provider.getRouteMetrics(route, window, service),
      this.provider.getServiceMetrics(service, window)
    ]);

    return {
      traceId,
      route,
      primaryService: service,
      routeMetrics,
      serviceMetrics
    };
  }
}
