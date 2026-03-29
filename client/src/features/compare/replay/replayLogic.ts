import { TraceSummary } from '../../../types/trace';

export function extractReplayableRequest(trace: TraceSummary) {
  const meta = trace.requestMetadata;
  // Fallback to trace.route if we don't have meta.url explicitly, 
  // though route might have params like /api/issues/:id. URL is exact.
  const urlPath = meta?.url || trace.route;
  if (!urlPath || urlPath === '/unknown') return null;

  let parsedHeaders: Record<string, string> = {};
  if (meta?.headers) {
    try {
      parsedHeaders = JSON.parse(meta.headers);
    } catch {}
  }

  let parsedBody: any = undefined;
  if (meta?.body) {
    try {
      parsedBody = JSON.parse(meta.body);
    } catch {}
  }

  return {
    method: trace.method.toUpperCase(),
    url: urlPath,
    body: parsedBody,
    headers: parsedHeaders
  };
}

export function isReplaySafe(trace: TraceSummary): boolean {
  const req = extractReplayableRequest(trace);
  if (!req) return false;
  return req.method === 'GET'; 
}

// We define a helper to abstract away finding the latest trace from a set.
// It will be used inside the component where the traces list is held.
export function findLatestTraceForRoute(traces: TraceSummary[], route: string, afterTimestamp: number): TraceSummary | null {
  const newerTraces = traces.filter(t => t.route === route && t.startedAt > afterTimestamp);
  newerTraces.sort((a, b) => b.startedAt - a.startedAt); // descending
  return newerTraces[0] || null;
}

export async function executeReplayRequest(trace: TraceSummary): Promise<void> {
  const req = extractReplayableRequest(trace);
  if (!req) {
    throw new Error('Missing request metadata needed for replay.');
  }

  // The monitored app is known to run on port 4000 locally
  const targetUrl = `http://localhost:4000${req.url}`;
  
  const init: RequestInit = {
    method: req.method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
    init.body = JSON.stringify(req.body);
  }

  const res = await fetch(targetUrl, init);
  if (!res.ok) {
    console.warn(`Replay returned status ${res.status}`);
  }
}
