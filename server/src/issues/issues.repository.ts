import { Injectable } from '@nestjs/common';
import { SpanStatusCode, context as otelContext, trace } from '@opentelemetry/api';
import { DatabaseService } from '../common/database/database.service';
import { TracingService } from '../common/tracing/tracing.service';

export type IssueStatus = 'open' | 'in_progress' | 'closed';
export type IssuePriority = 'low' | 'medium' | 'high';

export interface IssueRecord {
  id: string;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  createdAt: string;
}

interface IssueRow {
  id: string;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  created_at: Date;
}

@Injectable()
export class IssuesRepository {
  private readonly tracer = trace.getTracer('debug-flow-visualizer.issues-repository');

  constructor(
    private readonly database: DatabaseService,
    private readonly tracing: TracingService
  ) {}

  async listIssues(traceId: string): Promise<IssueRecord[]> {
    const span = this.tracer.startSpan('db.issues.list', {
      attributes: {
        'db.system': 'postgresql',
        'db.operation': 'SELECT',
        'db.sql.table': 'issues',
        'trace.request_id': traceId
      }
    }, otelContext.active());

    this.tracing.logEvent(traceId, 'database', 'issues_query_started', 'success', { operation: 'list_issues' });

    try {
      const result = await this.database.query<IssueRow>(
        `SELECT id::text, title, description, status, priority, created_at FROM issues ORDER BY created_at DESC`
      );
      this.tracing.logEvent(traceId, 'database', 'issues_query_completed', 'success', { operation: 'list_issues', count: result.rowCount ?? 0 });
      span.setStatus({ code: SpanStatusCode.OK });
      return result.rows.map(this.toIssueRecord);
    } catch (error: any) {
      this.tracing.logEvent(traceId, 'database', 'issues_query_error', 'error', {
        operation: 'list_issues',
        error: error?.message ?? 'Unknown database error'
      });
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error?.message ?? 'Database query failed' });
      throw error;
    } finally {
      span.end();
    }
  }

  async createIssue(input: {
    title: string;
    description?: string;
    status?: IssueStatus;
    priority?: IssuePriority;
  }, traceId: string): Promise<IssueRecord> {
    const span = this.tracer.startSpan('db.issues.insert', {
      attributes: {
        'db.system': 'postgresql',
        'db.operation': 'INSERT',
        'db.sql.table': 'issues',
        'trace.request_id': traceId
      }
    }, otelContext.active());

    this.tracing.logEvent(traceId, 'database', 'issues_query_started', 'success', { operation: 'create_issue' });

    try {
      const result = await this.database.query<IssueRow>(
        `INSERT INTO issues (title, description, status, priority)
         VALUES ($1, $2, COALESCE($3, 'open'), COALESCE($4, 'medium'))
         RETURNING id::text, title, description, status, priority, created_at`,
        [input.title, input.description ?? null, input.status ?? null, input.priority ?? null]
      );
      this.tracing.logEvent(traceId, 'database', 'issues_query_completed', 'success', {
        operation: 'create_issue',
        issueId: result.rows[0]?.id
      });
      span.setAttribute('issue.id', result.rows[0]?.id ?? 'unknown');
      span.setStatus({ code: SpanStatusCode.OK });
      return this.toIssueRecord(result.rows[0]);
    } catch (error: any) {
      this.tracing.logEvent(traceId, 'database', 'issues_query_error', 'error', {
        operation: 'create_issue',
        error: error?.message ?? 'Unknown database error'
      });
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error?.message ?? 'Database query failed' });
      throw error;
    } finally {
      span.end();
    }
  }

  private toIssueRecord(row: IssueRow): IssueRecord {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      createdAt: new Date(row.created_at).toISOString()
    };
  }
}
