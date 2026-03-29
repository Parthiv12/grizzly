import { useState, useEffect } from 'react';
import { TraceContextMetrics } from '../types/metrics';
import { fetchTraceContextMetrics } from '../services/metricsApi';

export function useTraceMetrics(traceId?: string, window: string = '15m') {
  const [data, setData] = useState<TraceContextMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!traceId) {
      setData(null);
      return;
    }

    let isMounted = true;
    
    async function fetchMetrics() {
      if (!traceId) return;
      setLoading(true);
      setError(null);
      
      try {
        const result = await fetchTraceContextMetrics(traceId, window);
        if (isMounted) {
          setData(result);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to fetch metrics');
          setData(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void fetchMetrics();

    return () => {
      isMounted = false;
    };
  }, [traceId, window]);

  return { data, loading, error };
}
