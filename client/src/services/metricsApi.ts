import type { TraceContextMetrics } from '../types/metrics';

const API_BASE_URL = '/api';

export async function fetchTraceContextMetrics(traceId: string, window: string = '15m'): Promise<TraceContextMetrics> {
  const response = await fetch(`${API_BASE_URL}/metrics/trace/${traceId}/context?window=${window}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch context metrics for trace ${traceId}`);
  }
  return response.json();
}
