import axios from 'axios';
import type { RawTraceEvent } from '../types/trace';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE ?? '/api',
  timeout: 10000
});

export async function fetchAllTraceEvents(): Promise<RawTraceEvent[]> {
  const response = await api.get<RawTraceEvent[]>('/traces');
  return response.data;
}

export async function fetchTraceEventsByService(service: string): Promise<RawTraceEvent[]> {
  const response = await api.get<RawTraceEvent[]>('/traces', {
    params: {
      service
    }
  });
  return response.data;
}

export async function fetchTraceEventsByServiceScoped(service: string, includeInternal: boolean): Promise<RawTraceEvent[]> {
  const response = await api.get<RawTraceEvent[]>('/traces', {
    params: {
      service,
      includeInternal
    }
  });
  return response.data;
}

export async function fetchTraceServices(includeInternal = false): Promise<string[]> {
  const response = await api.get<string[]>('/traces/services/list', {
    params: {
      includeInternal
    }
  });
  return response.data;
}
