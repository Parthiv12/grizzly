export type IssueStatus = 'open' | 'in_progress' | 'closed';
export type IssuePriority = 'low' | 'medium' | 'high';

export interface Issue {
  id: string;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  createdAt: string;
}

export interface CreateIssueInput {
  title: string;
  description?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
}

export interface RequestTraceMeta {
  httpMethod: string;
  httpRoute: string;
  forceSlow?: boolean;
  forceDbError?: boolean;
}
