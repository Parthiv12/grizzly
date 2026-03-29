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

@Module({
  imports: [],
  controllers: [AppController, AuthController, TracesController, IssuesController],
  providers: [AuthService, UserRepository, TracingService, DatabaseService, IssuesRepository, JaegerTracesService]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TracingMiddleware).forRoutes('*');
  }
}
