import { Controller, Get, Param, Query } from '@nestjs/common';
import { TracingService } from '../common/tracing/tracing.service';
import type { TraceEvent } from '../common/tracing/tracing.service';
import { JaegerTracesService } from './jaeger-traces.service';

type TraceSource = 'memory' | 'jaeger' | 'hybrid';

@Controller('traces')
export class TracesController {
  private readonly internalServiceNames = new Set(['debug-flow-visualizer-backend', 'jaeger-all-in-one']);

  constructor(
    private tracing: TracingService,
    private jaegerTraces: JaegerTracesService
  ) {}

  @Get()
  async getAll(@Query('service') service?: string, @Query('includeInternal') includeInternal?: string) {
    const source = this.getTraceSource();
    const includeInternalTraces = this.parseBoolean(includeInternal);
    const selectedService = this.normalizeService(service);

    if (source === 'memory') {
      return this.filterEvents(this.tracing.getAllTraces(), selectedService, includeInternalTraces);
    }
    if (source === 'jaeger') {
      const jaegerEvents = await this.safeJaegerAll(selectedService);
      return this.filterEvents(jaegerEvents, selectedService, includeInternalTraces);
    }

    const [memoryEvents, jaegerEvents] = await Promise.all([
      Promise.resolve(this.tracing.getAllTraces()),
      this.safeJaegerAll(selectedService)
    ]);
    const filteredJaeger = this.filterEvents(jaegerEvents, selectedService, includeInternalTraces);
    if (filteredJaeger.length > 0) {
      return filteredJaeger;
    }

    const filteredMemory = this.filterEvents(memoryEvents, selectedService, includeInternalTraces);
    return this.mergeEvents(filteredMemory, []);
  }

  @Get('services/list')
  async getServices(@Query('includeInternal') includeInternal?: string) {
    const includeInternalTraces = this.parseBoolean(includeInternal);
    try {
      const services = await this.jaegerTraces.getServices();
      return services.filter((service) => includeInternalTraces || !this.internalServiceNames.has(service));
    } catch {
      return [];
    }
  }

  @Get(':traceId')
  async getOne(@Param('traceId') traceId: string, @Query('service') service?: string, @Query('includeInternal') includeInternal?: string) {
    const source = this.getTraceSource();
    const includeInternalTraces = this.parseBoolean(includeInternal);
    const selectedService = this.normalizeService(service);

    if (source === 'memory') {
      return this.filterEvents(this.tracing.getTrace(traceId), selectedService, includeInternalTraces);
    }
    if (source === 'jaeger') {
      const jaegerEvents = await this.safeJaegerOne(traceId, selectedService);
      return this.filterEvents(jaegerEvents, selectedService, includeInternalTraces);
    }

    const [memoryEvents, jaegerEvents] = await Promise.all([
      Promise.resolve(this.tracing.getTrace(traceId)),
      this.safeJaegerOne(traceId, selectedService)
    ]);

    const filteredJaeger = this.filterEvents(jaegerEvents, selectedService, includeInternalTraces);
    if (filteredJaeger.length > 0) {
      return filteredJaeger;
    }

    const filteredMemory = this.filterEvents(memoryEvents, selectedService, includeInternalTraces);
    return this.mergeEvents(filteredMemory, []);
  }

  private async safeJaegerAll(service?: string) {
    try {
      return await this.jaegerTraces.getAllTraceEvents(service);
    } catch {
      return [];
    }
  }

  private async safeJaegerOne(traceId: string, service?: string) {
    try {
      return await this.jaegerTraces.getTraceEvents(traceId, service);
    } catch {
      return [];
    }
  }

  private getTraceSource(): TraceSource {
    const source = (process.env.TRACE_SOURCE ?? 'memory').toLowerCase();
    if (source === 'jaeger' || source === 'hybrid' || source === 'memory') {
      return source;
    }
    return 'memory';
  }

  private normalizeService(service?: string): string | undefined {
    const value = service?.trim();
    if (!value) {
      return undefined;
    }
    return value;
  }

  private parseBoolean(value?: string): boolean {
    if (!value) {
      return false;
    }
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  }

  private filterEvents(events: TraceEvent[], selectedService?: string, includeInternal = false): TraceEvent[] {
    return events.filter((event) => {
      const metadataService = typeof event.metadata?.serviceName === 'string' ? event.metadata.serviceName : undefined;
      const method = typeof event.metadata?.method === 'string' ? event.metadata.method.toUpperCase() : undefined;
      const url = typeof event.metadata?.url === 'string' ? event.metadata.url : undefined;

      if (!includeInternal) {
        if (metadataService && this.internalServiceNames.has(metadataService)) {
          return false;
        }

        if (method === 'GET' && url && (url === '/traces' || url.startsWith('/api/traces'))) {
          return false;
        }
      }

      if (!selectedService) {
        return true;
      }

      if (!metadataService) {
        return false;
      }

      return metadataService === selectedService;
    });
  }

  private mergeEvents(memoryEvents: ReturnType<TracingService['getAllTraces']>, jaegerEvents: ReturnType<TracingService['getAllTraces']>) {
    const dedup = new Map<string, (typeof memoryEvents)[number]>();
    for (const event of [...memoryEvents, ...jaegerEvents]) {
      const key = `${event.traceId}|${event.layer}|${event.step}|${event.timestamp}`;
      dedup.set(key, event);
    }
    return [...dedup.values()].sort((a, b) => b.timestamp - a.timestamp);
  }
}
