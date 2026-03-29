import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TracingInterceptor } from './common/tracing/tracing.interceptor';
import { TracingService } from './common/tracing/tracing.service';
import { startTelemetry, stopTelemetry } from './common/tracing/telemetry';

async function bootstrap() {
  await startTelemetry();

  const app = await NestFactory.create(AppModule);
  app.enableCors(); // This opens port 3000 to Vercel!
  
  const tracingService = app.get(TracingService);
  app.useGlobalInterceptors(new TracingInterceptor(tracingService));

  const gracefulShutdown = async () => {
    await app.close();
    await stopTelemetry();
    process.exit(0);
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);

  await app.listen(3000);
  console.log('Server listening on http://localhost:3000');
}

bootstrap();
