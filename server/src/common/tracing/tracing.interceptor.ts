import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { TracingService } from './tracing.service';

@Injectable()
export class TracingInterceptor implements NestInterceptor {
  constructor(private tracing: TracingService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest() as any;
    const traceId = req?.traceId || 'unknown-trace';
    const start = Date.now();

    this.tracing.logEvent(traceId, 'controller', 'controller_execution_started', 'success', { path: req?.url });

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        this.tracing.logEvent(traceId, 'controller', 'controller_execution_completed', 'success', { duration });
      }),
      catchError((err) => {
        const duration = Date.now() - start;
        this.tracing.logEvent(traceId, 'controller', 'controller_execution_error', 'error', { duration, error: err?.message });
        return throwError(() => err);
      })
    );
  }
}
