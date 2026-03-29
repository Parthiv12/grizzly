import { Controller, Get, Param } from '@nestjs/common';
import { TracingService } from '../common/tracing/tracing.service';
import { JaegerTracesService } from './jaeger-traces.service';

type TraceSource = 'memory' | 'jaeger' | 'hybrid';

@Controller('traces')
export class TracesController {
  constructor(
    private tracing: TracingService,
    private jaegerTraces: JaegerTracesService
  ) {}

  @Get()
  async getAll() {
    const source = this.getTraceSource();

    if (source === 'memory') {
      return this.tracing.getAllTraces();
    }
    if (source === 'jaeger') {
      return this.safeJaegerAll();
    }

    const [memoryEvents, jaegerEvents] = await Promise.all([
      Promise.resolve(this.tracing.getAllTraces()),
      this.safeJaegerAll()
    ]);
    return this.mergeEvents(memoryEvents, jaegerEvents);
  }

  @Get(':traceId')
  async getOne(@Param('traceId') traceId: string) {
    const source = this.getTraceSource();

    if (source === 'memory') {
      return this.tracing.getTrace(traceId);
    }
    if (source === 'jaeger') {
      return this.safeJaegerOne(traceId);
    }

    const [memoryEvents, jaegerEvents] = await Promise.all([
      Promise.resolve(this.tracing.getTrace(traceId)),
      this.safeJaegerOne(traceId)
    ]);
    return this.mergeEvents(memoryEvents, jaegerEvents);
  }

  private async safeJaegerAll() {
    try {
      return await this.jaegerTraces.getAllTraceEvents();
    } catch {
      return [];
    }
  }

  private async safeJaegerOne(traceId: string) {
    try {
      return await this.jaegerTraces.getTraceEvents(traceId);
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

  private mergeEvents(memoryEvents: ReturnType<TracingService['getAllTraces']>, jaegerEvents: ReturnType<TracingService['getAllTraces']>) {
    const dedup = new Map<string, (typeof memoryEvents)[number]>();
    for (const event of [...memoryEvents, ...jaegerEvents]) {
      const key = `${event.traceId}|${event.layer}|${event.step}|${event.timestamp}`;
      dedup.set(key, event);
    }
    return [...dedup.values()].sort((a, b) => b.timestamp - a.timestamp);
  }
}
