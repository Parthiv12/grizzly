import type { CreateIssueInput, Issue, IssueStatus, RequestTraceMeta } from '../types/issues';
import { withBusinessSpan } from '../observability/span-utils';
import { IssuesRepository } from '../repositories/issues.repository';

const VALID_STATUSES: IssueStatus[] = ['open', 'in_progress', 'closed'];
const VALID_PRIORITIES = ['low', 'medium', 'high'] as const;

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class IssuesService {
  constructor(private readonly repository: IssuesRepository) {}

  async getIssues(meta: RequestTraceMeta): Promise<Issue[]> {
    return withBusinessSpan('issues.service.getIssues', {
      layer: 'service',
      resource: 'issues',
      operation: 'getIssues',
      httpMethod: meta.httpMethod,
      httpRoute: meta.httpRoute
    }, async () => this.repository.findAllIssues(meta));
  }

  async createIssue(input: Partial<CreateIssueInput>, meta: RequestTraceMeta): Promise<Issue> {
    return withBusinessSpan('issues.service.createIssue', {
      layer: 'service',
      resource: 'issues',
      operation: 'createIssue',
      httpMethod: meta.httpMethod,
      httpRoute: meta.httpRoute
    }, async () => {
      const valid = await this.validateIssue(input, meta);
      return this.repository.insertIssue(valid, meta);
    });
  }

  async updateIssueStatus(id: string, status: string | undefined, meta: RequestTraceMeta): Promise<Issue> {
    return withBusinessSpan('issues.service.updateIssueStatus', {
      layer: 'service',
      resource: 'issues',
      operation: 'updateIssueStatus',
      httpMethod: meta.httpMethod,
      httpRoute: meta.httpRoute
    }, async () => {
      const normalizedStatus = await this.validateStatus(status, meta);
      const issue = await this.repository.updateIssueStatus(id, normalizedStatus, meta);

      if (!issue) {
        throw new NotFoundError('Issue not found');
      }

      return issue;
    });
  }

  private async validateIssue(input: Partial<CreateIssueInput>, meta: RequestTraceMeta): Promise<CreateIssueInput> {
    return withBusinessSpan('issues.service.validateIssue', {
      layer: 'service',
      resource: 'issues',
      operation: 'validateIssue',
      httpMethod: meta.httpMethod,
      httpRoute: meta.httpRoute
    }, async () => {
      const title = input.title?.trim();
      if (!title) {
        throw new ValidationError('title is required');
      }

      if (input.priority && !VALID_PRIORITIES.includes(input.priority)) {
        throw new ValidationError('priority must be low, medium, or high');
      }

      if (input.status && !VALID_STATUSES.includes(input.status)) {
        throw new ValidationError('status must be open, in_progress, or closed');
      }

      return {
        title,
        description: input.description?.trim() || undefined,
        status: input.status,
        priority: input.priority
      };
    });
  }

  private async validateStatus(status: string | undefined, meta: RequestTraceMeta): Promise<IssueStatus> {
    return withBusinessSpan('issues.service.validateStatus', {
      layer: 'service',
      resource: 'issues',
      operation: 'validateStatus',
      httpMethod: meta.httpMethod,
      httpRoute: meta.httpRoute
    }, async () => {
      if (!status || !VALID_STATUSES.includes(status as IssueStatus)) {
        throw new ValidationError('status must be open, in_progress, or closed');
      }
      return status as IssueStatus;
    });
  }
}
