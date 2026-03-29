import { Body, Controller, Get, HttpException, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { TracingService } from '../common/tracing/tracing.service';
import { IssuesRepository, type IssuePriority, type IssueStatus } from './issues.repository';

interface CreateIssueBody {
  title?: string;
  description?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
}

@Controller('issues')
export class IssuesController {
  constructor(
    private readonly issues: IssuesRepository,
    private readonly tracing: TracingService
  ) {}

  @Get()
  async getAll(@Req() req: any, @Res() res: any) {
    const traceId = req.traceId || 'unknown-trace';
    this.tracing.logEvent(traceId, 'controller', 'issues_list_request_received', 'success');

    try {
      const result = await this.issues.listIssues(traceId);
      res.json({ items: result, requestId: traceId });
    } catch (error: any) {
      this.tracing.logEvent(traceId, 'controller', 'issues_list_request_error', 'error', {
        error: error?.message ?? 'Failed to query issues'
      });
      res.status(500).json({ error: 'Failed to fetch issues', requestId: traceId });
    }
  }

  @Post()
  async create(@Body() body: CreateIssueBody, @Req() req: any, @Res() res: any) {
    const traceId = req.traceId || 'unknown-trace';
    this.tracing.logEvent(traceId, 'controller', 'issues_create_request_received', 'success', {
      title: body?.title,
      status: body?.status,
      priority: body?.priority
    });

    if (!body?.title?.trim()) {
      throw new HttpException('title is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const created = await this.issues.createIssue({
        title: body.title.trim(),
        description: body.description,
        status: body.status,
        priority: body.priority
      }, traceId);
      res.status(201).json({ item: created, requestId: traceId });
    } catch (error: any) {
      this.tracing.logEvent(traceId, 'controller', 'issues_create_request_error', 'error', {
        error: error?.message ?? 'Failed to create issue'
      });
      res.status(500).json({ error: 'Failed to create issue', requestId: traceId });
    }
  }
}
