# Monitored App (Issue Tracker)

Separate target application for the hybrid architecture demo.

## Structure

- frontend: React + Vite app on port 5174
- backend: Express + Postgres + OpenTelemetry app on port 4000

## Run

### 1) Start infra

- Jaeger container: `docker start jaeger`
- Postgres container: `docker start debugflow-postgres`

### 2) Run backend

From monitored-app/backend:

npm.cmd install
npm.cmd run dev

### 3) Run frontend

From monitored-app/frontend:

npm.cmd install
npm.cmd run dev

## Endpoints (backend)

- GET /health
- GET /api/issues
- POST /api/issues
- PATCH /api/issues/:id/status

## Observability

The backend exports traces via OTLP HTTP to Jaeger at:

http://localhost:4318/v1/traces

Service name in Jaeger:

issue-tracker-backend
