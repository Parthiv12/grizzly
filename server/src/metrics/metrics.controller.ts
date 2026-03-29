import { Controller, Get, Param, Query } from '@nestjs/common';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('route')
  async getRouteMetrics(@Query('route') route?: string, @Query('window') window = '15m') {
    return this.metricsService.getRouteMetrics(route || 'unknown', window);
  }

  @Get('service')
  async getServiceMetrics(@Query('service') service?: string, @Query('window') window = '15m') {
    return this.metricsService.getServiceMetrics(service || 'unknown', window);
  }

  @Get('trace/:traceId/context')
  async getTraceContextMetrics(@Param('traceId') traceId: string, @Query('window') window = '15m') {
    return this.metricsService.getTraceContextMetrics(traceId, window);
  }
}
