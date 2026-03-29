import { Router, Request, Response } from 'express';
import { SpanStatusCode } from '@opentelemetry/api';
import { SpanMeta, trace, withBusinessSpan } from '../observability/span-utils';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  await handleAuthRequest(req, res, '/login', async (meta) => {
    return withBusinessSpan('login_user', {
      layer: 'controller',
      resource: 'auth',
      operation: 'authenticate',
      httpMethod: meta.httpMethod,
      httpRoute: meta.httpRoute
    }, async () => {
      
      const { email, password, forceSlowDb } = req.body;

      if (!email || !password) {
        throw new Error('Email and password required');
      }

      // Simulate Authentication Service
      return withBusinessSpan('auth_service_validate', {
        layer: 'service',
        resource: 'auth_service',
        operation: 'validate',
      }, async () => {
        
        // Simulate checking the database for the user with an INTENTIONAL BOTTLENECK
        const user = await withBusinessSpan('db_select_user', {
             layer: 'database',
             resource: 'users_db',
             operation: 'select'
        }, async () => {
             if (forceSlowDb) {
               await new Promise(r => setTimeout(r, 2500)); // The 2.5s slow trace!
             } else {
               await new Promise(r => setTimeout(r, 20)); // Fast query
             }
             return { id: 'u_123', name: 'Demo User', email: email };
        });

        // Hardcode a password check failure
        if (password === 'wrongpassword') {
            throw new Error('Invalid credentials');
        }

        return { status: 200, body: { ...user, token: 'mock-jwt-token-123' } };
      });
    });
  });
});

async function handleAuthRequest(
  req: Request,
  res: Response,
  routePath: string,
  handler: (meta: SpanMeta) => Promise<{ status: number; body: any }>
) {
  const meta: SpanMeta = {
    layer: 'controller',
    resource: 'auth_router',
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
    res.status(401).json({ error: error?.message ?? 'Unauthorized' });
  }
}
