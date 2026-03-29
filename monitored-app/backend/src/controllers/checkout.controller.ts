import { Router, Request, Response } from 'express';
import { SpanStatusCode } from '@opentelemetry/api';
import { SpanMeta, trace, withBusinessSpan } from '../observability/span-utils';
import { checkoutService } from '../services/checkout.service';

export const checkoutRouter = Router();

checkoutRouter.post('/', async (req, res) => {
  await handleCheckoutRequest(req, res, '/checkout', async (meta) => {
    return withBusinessSpan('submit_checkout', {
      layer: 'controller',
      resource: 'checkout',
      operation: 'submit',
      httpMethod: meta.httpMethod,
      httpRoute: meta.httpRoute
    }, async () => {
      const result = await checkoutService.processCheckout(req.body, meta);
      return { status: 200, body: result };
    });
  });
});

async function handleCheckoutRequest(
  req: Request,
  res: Response,
  routePath: string,
  handler: (meta: SpanMeta) => Promise<{ status: number; body: any }>
) {
  const meta: SpanMeta = {
    layer: 'controller',
    resource: 'checkout_router',
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

checkoutRouter.get('/orders', async (req: Request, res: Response) => {
  const meta: SpanMeta = {
    layer: 'controller',
    resource: 'checkout_router',
    operation: 'request_orders',
    httpMethod: req.method,
    httpUrl: req.originalUrl,
    httpRoute: '/orders'
  };

  try {
    const orders = await checkoutService.getRecentOrders();
    const span = trace.getActiveSpan();
    if (span) {
       res.setHeader('x-trace-id', span.spanContext().traceId);
    }
    res.status(200).json(orders);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
