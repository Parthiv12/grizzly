export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

export function shortTraceId(traceId: string): string {
  if (traceId.length <= 12) {
    return traceId;
  }
  return `${traceId.slice(0, 8)}...${traceId.slice(-4)}`;
}
