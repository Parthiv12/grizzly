import { Router, type Request, type Response } from 'express';
import { withBusinessSpan, trace } from '../observability/span-utils';
import { authService } from '../services/auth.service';
import type { RequestTraceMeta } from '../types/users';

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  await handleRequest(req, res, '/auth/register', async (meta) => {
    const item = await authService.registerUser(req.body, meta);
    return { status: 201, body: { item } };
  });
});

authRouter.post('/login', async (req, res) => {
  await handleRequest(req, res, '/auth/login', async (meta) => {
    const result = await authService.loginUser(req.body, meta);
    return { status: 200, body: result };
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
      resource: 'auth',
      operation: 'execute',
      httpMethod: traceMeta.httpMethod,
      httpRoute: traceMeta.httpRoute,
      httpUrl: traceMeta.httpUrl
    }, async () => action(traceMeta));
    
    // Attach nice trace ID to header if available
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
