export type IssueStatus = 'open' | 'in_progress' | 'resolved';

export interface Issue {
    id: string;
    title: string;
    description: string | null;
    status: IssueStatus;
    priority: 'low' | 'medium' | 'high';
    createdAt: string;
}

export interface CreateIssueInput {
    title: string;
    description?: string | null;
    status?: IssueStatus;
    priority?: 'low' | 'medium' | 'high';
}

export interface RequestTraceMeta {
    httpMethod?: string;
    httpRoute?: string;
    httpUrl?: string;
    forceSlow?: boolean;
    forceDbError?: boolean;
}