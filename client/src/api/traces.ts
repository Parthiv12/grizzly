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
