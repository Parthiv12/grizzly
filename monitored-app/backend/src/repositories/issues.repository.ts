import { withBusinessSpan } from '../observability/span-utils';
import { insertIssue, selectIssues, updateIssueStatusById } from '../db/issue-queries';
import type { CreateIssueInput, Issue, IssueStatus, RequestTraceMeta } from '../types/issues';

export class IssuesRepository {
  async findAllIssues(meta: RequestTraceMeta): Promise<Issue[]> {
    return withBusinessSpan('issues.repository.findAllIssues', {
      layer: 'repository',
      resource: 'issues',
      operation: 'findAllIssues',
      httpMethod: meta.httpMethod,
      httpRoute: meta.httpRoute,
      dbSystem: 'postgresql',
      dbOperation: 'select'
    }, async () => selectIssues(meta));
  }

  async insertIssue(input: CreateIssueInput, meta: RequestTraceMeta): Promise<Issue> {
    return withBusinessSpan('issues.repository.insertIssue', {
      layer: 'repository',
      resource: 'issues',
      operation: 'insertIssue',
      httpMethod: meta.httpMethod,
      httpRoute: meta.httpRoute,
      dbSystem: 'postgresql',
      dbOperation: 'insert'
    }, async () => insertIssue(input, meta));
  }

  async updateIssueStatus(id: string, status: IssueStatus, meta: RequestTraceMeta): Promise<Issue | null> {
    return withBusinessSpan('issues.repository.updateIssueStatus', {
      layer: 'repository',
      resource: 'issues',
      operation: 'updateIssueStatus',
      httpMethod: meta.httpMethod,
      httpRoute: meta.httpRoute,
      dbSystem: 'postgresql',
      dbOperation: 'update'
    }, async () => updateIssueStatusById(id, status, meta));
  }
}
