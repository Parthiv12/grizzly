import { Router, type Request, type Response } from 'express';
import { withBusinessSpan } from '../observability/span-utils';
import { IssuesService, NotFoundError, ValidationError } from '../services/issues.service';
import { IssuesRepository } from '../repositories/issues.repository';
import type { RequestTraceMeta } from '../types/issues';

const repository = new IssuesRepository();
const service = new IssuesService(repository);

export const issuesRouter = Router();

issuesRouter.get('/', async (req, res) => {
  await handleRequest(req, res, '/api/issues', 'getIssues', async (meta) => {
    const items = await service.getIssues(meta);
    return { status: 200, body: { items } };
  });
});

issuesRouter.post('/', async (req, res) => {
  await handleRequest(req, res, '/api/issues', 'createIssue', async (meta) => {
    const item = await service.createIssue(req.body ?? {}, meta);
    return { status: 201, body: { item } };
  });
});

issuesRouter.patch('/:id/status', async (req, res) => {
  await handleRequest(req, res, '/api/issues/:id/status', 'updateIssueStatus', async (meta) => {
    const item = await service.updateIssueStatus(req.params.id, req.body?.status, meta);
    return { status: 200, body: { item } };
  });
});

async function handleRequest(
  req: Request,
  res: Response,
  route: string,
  operation: 'getIssues' | 'createIssue' | 'updateIssueStatus',
  action: (meta: RequestTraceMeta) => Promise<{ status: number; body: unknown }>
) {
  const traceMeta = buildTraceMeta(req, route);
  const spanName = `issues.controller.${operation}`;

  try {
    const result = await withBusinessSpan(spanName, {
      layer: 'controller',
      resource: 'issues',
      operation,
      httpMethod: traceMeta.httpMethod,
      httpRoute: traceMeta.httpRoute
    }, async () => action(traceMeta));

    res.status(result.status).json(result.body);
  } catch (error: any) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }

    if (error instanceof NotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: error?.message ?? 'Internal server error' });
  }
}

function buildTraceMeta(req: Request, route: string): RequestTraceMeta {
  return {
    httpMethod: req.method,
    httpRoute: route,
    forceSlow: req.query.slow === '1',
    forceDbError: req.query.forceDbError === '1'
  };
}
