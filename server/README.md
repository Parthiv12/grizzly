# Debug Flow Visualizer — Backend (NestJS)

This is a minimal NestJS backend demonstrating structured tracing across Controller → Service → Repository → Database layers.

Quick start:

```bash
npm install
npm run start:dev
```

OpenTelemetry + Jaeger:

```bash
docker run --rm --name jaeger \
	-e COLLECTOR_OTLP_ENABLED=true \
	-p 16686:16686 \
	-p 4318:4318 \
	jaegertracing/all-in-one:latest
```

Optional environment variables:

- `OTEL_SERVICE_NAME` (default: `debug-flow-visualizer-backend`)
- `OTEL_EXPORTER_OTLP_ENDPOINT` (default: `http://localhost:4318`)
- `OTEL_LOG_LEVEL` (`DEBUG` enables OTel SDK diagnostics)
- `TRACE_EVENT_LIMIT` (default: `2000` in-memory events)

After starting the backend and generating requests, open Jaeger UI at `http://localhost:16686`.

Endpoints:
- POST /auth/login  { email, password }
- GET  /traces
- GET  /traces/:traceId

Responses include `requestId` and the server sets `x-trace-id` header.
