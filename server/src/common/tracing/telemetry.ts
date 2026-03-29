import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

let telemetrySdk: NodeSDK | undefined;

export async function startTelemetry() {
  if (telemetrySdk) {
    return;
  }

  const logLevel = process.env.OTEL_LOG_LEVEL?.toUpperCase();
  if (logLevel === 'DEBUG') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const otlpBase = (process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318').replace(/\/$/, '');
  const traceExporter = new OTLPTraceExporter({
    url: `${otlpBase}/v1/traces`
  });

  telemetrySdk = new NodeSDK({
    traceExporter,
    resource: resourceFromAttributes({
      [SemanticResourceAttributes.SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'debug-flow-visualizer-backend',
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version ?? '0.1.0'
    }),
    instrumentations: [getNodeAutoInstrumentations()]
  });

  await telemetrySdk.start();
}

export async function stopTelemetry() {
  if (!telemetrySdk) {
    return;
  }
  await telemetrySdk.shutdown();
  telemetrySdk = undefined;
}
