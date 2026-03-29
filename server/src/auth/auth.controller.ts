import { Controller, Post, Body, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { TracingService } from '../common/tracing/tracing.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService, private tracing: TracingService) {}

  @Post('login')
  async login(@Body() body: { email?: string; password?: string }, @Req() req: any, @Res() res: any) {
    const traceId = req.traceId || 'unknown-trace';
    this.tracing.logEvent(traceId, 'controller', 'login_request_received', 'success', { body: { email: body?.email } });

    try {
      const result = await this.authService.login(body.email, body.password, traceId);
      res.json({ ...result, requestId: traceId });
    } catch (err: any) {
      const status = err?.status || 500;
      this.tracing.logEvent(traceId, 'controller', 'login_request_error', 'error', { error: err?.message });
      res.status(status).json({ error: err?.message, requestId: traceId });
    }
  }
}
