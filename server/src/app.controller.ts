import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getRoot() {
    return {
      name: 'Debug Flow Visualizer Backend',
      status: 'ok',
      endpoints: {
        login: 'POST /auth/login',
        traces: 'GET /traces',
        traceById: 'GET /traces/:traceId',
        issuesList: 'GET /issues',
        issuesCreate: 'POST /issues'
      }
    };
  }
}
