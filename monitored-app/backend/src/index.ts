import 'dotenv/config';
import { startTelemetry, stopTelemetry } from './telemetry';

async function bootstrap() {
  await startTelemetry();

  // Load app modules only after telemetry starts so auto-instrumentation can patch them.
  const [{ createApp }, { initializeDatabase }] = await Promise.all([
    import('./app'),
    import('./db/issue-queries')
  ]);

  const app = createApp();
  await initializeDatabase();

  const port = Number(process.env.PORT ?? 4000);
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Monitored Issue Tracker backend listening on http://localhost:${port}`);
  });
}

void bootstrap();

async function gracefulShutdown() {
  await stopTelemetry();
  process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
