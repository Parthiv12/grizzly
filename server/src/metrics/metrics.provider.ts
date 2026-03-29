import { Injectable } from '@nestjs/common';

export interface RouteMetrics {
  window: string;
  requestCount: number;
  successCount: number;
  errorCount: number;
  errorRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  slowCount: number;
  dbHeavyCount: number;
  lastUpdated: string;
}

export interface ServiceMetrics {
  window: string;
  requestCount: number;
  errorCount: number;
  errorRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  slowCount: number;
  mostCommonBottleneck: string;
  lastUpdated: string;
}

export interface TraceContextMetrics {
  traceId: string;
  route: string;
  primaryService: string;
  routeMetrics: RouteMetrics;
  serviceMetrics: ServiceMetrics;
}

export abstract class MetricsProvider {
  abstract getRouteMetrics(route: string, window: string): Promise<RouteMetrics>;
  abstract getServiceMetrics(service: string, window: string): Promise<ServiceMetrics>;
}
