import type { QueryResultRow } from 'pg';
import { withBusinessSpan } from '../observability/span-utils';
import { pool } from './pool';
import type { CreateIssueInput, Issue, IssueStatus, RequestTraceMeta } from '../types/issues';

interface IssueRow extends QueryResultRow {
  id: string;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: 'low' | 'medium' | 'high';
  created_at: Date;
}

export async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS issues (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      priority TEXT NOT NULL DEFAULT 'medium',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function selectIssues(meta: RequestTraceMeta): Promise<Issue[]> {
  return withBusinessSpan('db.query.issues.select', {
    layer: 'database',
    resource: 'issues',
    operation: 'select',
    httpMethod: meta.httpMethod,
    httpRoute: meta.httpRoute,
    dbOperation: 'select',
    dbSystem: 'postgresql'
  }, async () => {
    await maybeSimulateSlowPath(meta);
    maybeSimulateDbError(meta);

    const result = await pool.query<IssueRow>(
      'SELECT id::text, title, description, status, priority, created_at FROM issues ORDER BY created_at DESC'
    );
    return result.rows.map(mapRowToIssue);
  });
}

export async function insertIssue(input: CreateIssueInput, meta: RequestTraceMeta): Promise<Issue> {
  return withBusinessSpan('db.query.issues.insert', {
    layer: 'database',
    resource: 'issues',
    operation: 'insert',
    httpMethod: meta.httpMethod,
    httpRoute: meta.httpRoute,
    dbOperation: 'insert',
    dbSystem: 'postgresql'
  }, async () => {
    await maybeSimulateSlowPath(meta);
    maybeSimulateDbError(meta);

    const result = await pool.query<IssueRow>(
      `INSERT INTO issues (title, description, status, priority)
       VALUES ($1, $2, COALESCE($3, 'open'), COALESCE($4, 'medium'))
       RETURNING id::text, title, description, status, priority, created_at`,
      [input.title, input.description ?? null, input.status ?? null, input.priority ?? null]
    );

    return mapRowToIssue(result.rows[0]);
  });
}

export async function updateIssueStatusById(id: string, status: IssueStatus, meta: RequestTraceMeta): Promise<Issue | null> {
  return withBusinessSpan('db.query.issues.update', {
    layer: 'database',
    resource: 'issues',
    operation: 'update',
    httpMethod: meta.httpMethod,
    httpRoute: meta.httpRoute,
    dbOperation: 'update',
    dbSystem: 'postgresql'
  }, async () => {
    await maybeSimulateSlowPath(meta);
    maybeSimulateDbError(meta);

    const result = await pool.query<IssueRow>(
      `UPDATE issues
       SET status = $2
       WHERE id = $1
       RETURNING id::text, title, description, status, priority, created_at`,
      [id, status]
    );

    if (result.rowCount === 0) {
      return null;
    }

    return mapRowToIssue(result.rows[0]);
  });
}

function mapRowToIssue(row: IssueRow): Issue {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    createdAt: new Date(row.created_at).toISOString()
  };
}

function maybeSimulateDbError(meta: RequestTraceMeta) {
  if (meta.forceDbError) {
    throw new Error('Intentional database error for observability demo');
  }
}

async function maybeSimulateSlowPath(meta: RequestTraceMeta) {
  if (meta.forceSlow) {
    await new Promise((resolve) => setTimeout(resolve, 900));
  }
}
