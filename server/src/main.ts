import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TracingInterceptor } from './common/tracing/tracing.interceptor';
import { TracingService } from './common/tracing/tracing.service';
import { startTelemetry, stopTelemetry } from './common/tracing/telemetry';

async function bootstrap() {
  await startTelemetry();

  const app = await NestFactory.create(AppModule);
  app.enableCors();

  const tracingService = app.get(TracingService);
  app.useGlobalInterceptors(new TracingInterceptor(tracingService));

  const gracefulShutdown = async () => {
    await app.close();
    await stopTelemetry();
    process.exit(0);
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);

  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port, '0.0.0.0');
  console.log(`Server listening on port ${port}`);
}

bootstrap();