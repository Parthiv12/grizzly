import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | undefined;

export async function startTelemetry() {
  if (sdk) {
    return;
  }

  if ((process.env.OTEL_LOG_LEVEL ?? '').toUpperCase() === 'DEBUG') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const otlpBase = (process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://127.0.0.1:4318').replace(/\/$/, '');
  const traceExporter = new OTLPTraceExporter({ 
    url: `${otlpBase}/v1/traces`,
    timeoutMillis: 30000
  });

  sdk = new NodeSDK({
    traceExporter,
    resource: resourceFromAttributes({
      [SemanticResourceAttributes.SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'monitored-ecommerce'
    }),
    instrumentations: [getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': {
        ignoreIncomingRequestHook: (req: any) => {
          // Ignore health checks and our new 2s auto-polling 
          // so we don't spam the TraceLens dashboard with noise!
          const url = req.url || '';
          return url.includes('/health') || url.includes('/orders');
        }
      }
    })]
  });

  await sdk.start();
}

export async function stopTelemetry() {
  if (!sdk) {
    return;
  }
  await sdk.shutdown();
  sdk = undefined;
}
