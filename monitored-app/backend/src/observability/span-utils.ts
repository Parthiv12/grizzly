import { SpanStatusCode, trace, type Attributes } from '@opentelemetry/api';
import type { RequestTraceMeta } from '../types/issues';

export const APP_NAME = 'monitored-issue-tracker';
const tracer = trace.getTracer('monitored-issue-tracker.business');

export interface SpanMeta extends Partial<RequestTraceMeta> {
  layer: 'controller' | 'service' | 'repository' | 'database' | 'external' | 'other';
  resource: string;
  operation: string;
  dbOperation?: string;
  dbSystem?: string;
}

export async function withBusinessSpan<T>(name: string, meta: SpanMeta, work: () => Promise<T>): Promise<T> {
  const attributes = buildAttributes(meta);
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await work();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error: any) {
      span.recordException(error);
      span.setAttribute('error', true);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error?.message ?? 'Unhandled error' });
      throw error;
    } finally {
      span.end();
    }
  });
}

function buildAttributes(meta: SpanMeta): Attributes {
  const attributes: Attributes = {
    'app.name': APP_NAME,
    'flow.layer': meta.layer,
    'flow.resource': meta.resource,
    'flow.operation': meta.operation
  };

  if (meta.httpMethod) {
    attributes['http.method'] = meta.httpMethod;
  }
  if (meta.httpRoute) {
    attributes['http.route'] = meta.httpRoute;
  }
  if (meta.dbOperation) {
    attributes['db.operation'] = meta.dbOperation;
  }
  if (meta.dbSystem) {
    attributes['db.system'] = meta.dbSystem;
  }

  return attributes;
}
