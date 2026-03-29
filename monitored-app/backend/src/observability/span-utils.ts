import { SpanStatusCode, trace, type Attributes } from '@opentelemetry/api';

export const APP_NAME = 'monitored-ecommerce';
const tracer = trace.getTracer('monitored-ecommerce.business');

export { trace };

export interface SpanMeta {
  httpMethod?: string;
  httpUrl?: string;
  httpRoute?: string;
  httpBody?: any;
  httpHeaders?: Record<string, string | string[] | undefined>;
  
  layer: 'controller' | 'service' | 'repository' | 'database' | 'external' | 'other';
  resource: string;
  operation: string;
  dbOperation?: string;
  dbSystem?: string;

  // Generic key-value pairs for extra attributes
  [key: string]: any;
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
  if (meta.httpUrl) {
    attributes['http.url'] = meta.httpUrl;
  }
  if (meta.httpBody) {
    attributes['http.request.body'] = typeof meta.httpBody === 'string' ? meta.httpBody : JSON.stringify(meta.httpBody);
  }
  if (meta.httpHeaders) {
    attributes['http.request.headers'] = JSON.stringify(meta.httpHeaders);
  }

  return attributes;
}
