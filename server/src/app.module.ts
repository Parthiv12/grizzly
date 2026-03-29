import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { UserRepository } from './user/user.repository';
import { TracingService } from './common/tracing/tracing.service';
import { TracingMiddleware } from './common/tracing/tracing.middleware';
import { TracesController } from './traces/traces.controller';
import { AppController } from './app.controller';
import { DatabaseService } from './common/database/database.service';
import { IssuesController } from './issues/issues.controller';
import { IssuesRepository } from './issues/issues.repository';
import { JaegerTracesService } from './traces/jaeger-traces.service';
import { TraceSummaryService } from './traces/trace-summary.service';
import { MetricsController } from './metrics/metrics.controller';
import { MetricsService } from './metrics/metrics.service';
import { HistoryMetricsProvider } from './metrics/history-metrics.provider';
import { MetricsProvider } from './metrics/metrics.provider';

@Module({
  imports: [],
  controllers: [AppController, AuthController, TracesController, IssuesController, MetricsController],
  providers: [
    AuthService, 
    UserRepository, 
    TracingService, 
    DatabaseService, 
    IssuesRepository, 
    JaegerTracesService, 
    TraceSummaryService,
    MetricsService,
    {
      provide: MetricsProvider,
      useClass: HistoryMetricsProvider
    }
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TracingMiddleware).forRoutes('*');
  }
}
