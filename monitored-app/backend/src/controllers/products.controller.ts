import { Router, Request, Response } from 'express';
import { SpanStatusCode } from '@opentelemetry/api';
import { SpanMeta, trace, withBusinessSpan } from '../observability/span-utils';
import { productsRepository } from '../repositories/products.repository';

export const productsRouter = Router();

productsRouter.get('/', async (req, res) => {
  await handleProductsRequest(req, res, '/products', async (meta) => {
    return withBusinessSpan('get_catalog', {
      layer: 'controller',
      resource: 'products',
      operation: 'catalog',
      httpMethod: meta.httpMethod,
      httpRoute: meta.httpRoute
    }, async () => {
      const items = await productsRepository.getProducts(meta);
      return { status: 200, body: items };
    });
  });
});

async function handleProductsRequest(
  req: Request,
  res: Response,
  routePath: string,
  handler: (meta: SpanMeta) => Promise<{ status: number; body: any }>
) {
  const meta: SpanMeta = {
    layer: 'controller',
    resource: 'products',
    operation: 'request',
    httpMethod: req.method,
    httpUrl: req.originalUrl,
    httpRoute: routePath
  };

  try {
    const result = await handler(meta);
    const span = trace.getActiveSpan();
    if (span) {
      res.setHeader('x-trace-id', span.spanContext().traceId);
    }
    res.status(result.status).json(result.body);
  } catch (error: any) {
    const span = trace.getActiveSpan();
    if (span) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error?.message });
      res.setHeader('x-trace-id', span.spanContext().traceId);
    }
    res.status(500).json({ error: error?.message ?? 'Internal server error' });
  }
}
