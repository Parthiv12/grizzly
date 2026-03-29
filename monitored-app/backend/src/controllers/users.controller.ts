import { Router, type Request, type Response } from 'express';
import { withBusinessSpan, trace } from '../observability/span-utils';
import { authService } from '../services/auth.service';
import type { RequestTraceMeta } from '../types/users';

export const usersRouter = Router();

usersRouter.get('/', async (req, res) => {
  await handleRequest(req, res, '/users', async (meta) => {
    const items = await authService.getUsers(meta);
    return { status: 200, body: items };
  });
});

usersRouter.get('/stats', async (req, res) => {
  await handleRequest(req, res, '/users/stats', async (meta) => {
    return withBusinessSpan('get_dashboard_stats', {
      layer: 'service',
      resource: 'users',
      operation: 'stats',
      httpMethod: meta.httpMethod,
      httpRoute: meta.httpRoute
    }, async () => {
      // Simulate dashboard load queries
      await new Promise(r => setTimeout(r, 45));
      return { status: 200, body: { activeUsers: 42, newSignups: 7, serverHealth: 'Good' } };
    });
  });
});

async function handleRequest(
  req: Request,
  res: Response,
  route: string,
  action: (meta: RequestTraceMeta) => Promise<{ status: number; body: unknown }>
) {
  const traceMeta = buildTraceMeta(req, route);
  const spanName = 'request_received';

  try {
    const result = await withBusinessSpan(spanName, {
      layer: 'controller',
      resource: 'users',
      operation: 'execute',
      httpMethod: traceMeta.httpMethod,
      httpRoute: traceMeta.httpRoute,
      httpUrl: traceMeta.httpUrl
    }, async () => action(traceMeta));
    
    const span = trace.getActiveSpan();
    if (span) {
       res.setHeader('x-trace-id', span.spanContext().traceId);
    }

    res.status(result.status).json(result.body);
  } catch (error: any) {
    const span = trace.getActiveSpan();
    if (span) {
       res.setHeader('x-trace-id', span.spanContext().traceId);
    }
    res.status(500).json({ error: error?.message ?? 'Internal server error' });
  }
}

function buildTraceMeta(req: Request, route: string): RequestTraceMeta {
  return {
    httpMethod: req.method,
    httpRoute: route,
    httpUrl: req.originalUrl || req.url,
  };
}
