import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { TracingService } from './tracing.service';
import { context as otelContext, trace, SpanStatusCode, type Context } from '@opentelemetry/api';

type RequestWithTrace = Request & { traceId?: string; startTime?: number; otelContext?: Context };

const requestTracer = trace.getTracer('debug-flow-visualizer.middleware');

@Injectable()
export class TracingMiddleware implements NestMiddleware {
  constructor(private tracing: TracingService) {}

  use(req: RequestWithTrace, res: Response, next: NextFunction) {
    const traceId = req.headers['x-trace-id'] as string || uuidv4();
    const requestSpan = requestTracer.startSpan(`HTTP ${req.method} ${req.originalUrl || req.url}`, {
      attributes: {
        'http.method': req.method,
        'http.target': req.originalUrl || req.url,
        'trace.request_id': traceId
      }
    });

    const requestContext = trace.setSpan(otelContext.active(), requestSpan);

    req.traceId = traceId;
    req.startTime = Date.now();
    req.otelContext = requestContext;
    res.setHeader('x-trace-id', traceId);

    otelContext.with(requestContext, () => {
      this.tracing.logEvent(traceId, 'controller', 'request_received', 'success', {
        method: req.method,
        url: req.originalUrl || req.url
      });

      res.on('finish', () => {
        const duration = Date.now() - (req.startTime || Date.now());
        this.tracing.logEvent(traceId, 'controller', 'request_completed', 'success', { statusCode: res.statusCode, duration });

        requestSpan.setAttribute('http.status_code', res.statusCode);
        if (res.statusCode >= 500) {
          requestSpan.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${res.statusCode}` });
        } else {
          requestSpan.setStatus({ code: SpanStatusCode.OK });
        }
        requestSpan.end();
      });

      next();
    });
  }
}
