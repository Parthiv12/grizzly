<div align="center">
  <h1>🔍 TraceLens</h1>
  <p><b>X-Ray vision for your backend. TraceLens visualizes exactly where your microservices fail or slow down.</b></p>
</div>

<br />

## 📖 Overview

Debugging distributed systems is painful. Logs are scattered, requests hop across services, and figuring out what actually happened takes way too long.

**TraceLens** is an open-source observability platform that turns raw backend request logs into a live, highly interactive visual node graph. Instead of reading text logs, TraceLens maps the exact lifespan of a request as it waterfalls through your Controllers, Services, and Databases.

## ✨ Features
* **Live Visual Graph:** Dynamically reconstructs parent-child span relationships from OpenTelemetry data.
* **Latency & Bottleneck Detection:** Instantly spot slow API calls and database bottlenecks visually.
* **Error Tracing:** Catch 500 errors and watch exactly how they cascade through your microservices.
* **Included "Mock-azon" Demo:** This repository comes with a fully functioning E-Commerce microservice architecture designed to break—perfect for testing out the dashboard!

---

## 🏗️ Architecture

TraceLens is split into a 4-part monorepo.

### 1. TraceLens Core Platform
- **Backend (`/server`):** A NestJS/Node.js backend that fetches, parses, and normalizes raw OpenTelemetry span data.
- **Frontend (`/client`):** A React + Vite UI using React Flow to magically convert spans into an interactive graphical network.

### 2. The Monitored App Demo ("Mock-azon")
- **Backend (`/monitored-app/backend`):** An Express.js microservice environment simulating Checkout, Inventory, and Payment services, instrumented with `@opentelemetry/sdk-node`.
- **Frontend (`/monitored-app/frontend`):** A beautiful Vite storefront UI with built-in "Bug Toggles" that allow you to intentionally sabotage the backend to generate traces!

---

## 🚀 Quickstart (Running Locally)

To run TraceLens and the Mock-azon demo locally, you need to spin up all 4 components. Open four separate terminal windows in VSCode.

### Step 1: TraceLens Backend
```bash
cd server
npm install
npm run start:dev
```
*(Runs on `http://localhost:3000`)*

### Step 2: TraceLens UI
```bash
cd client
npm install
npm run dev
```
*(Runs on `http://localhost:5174` or your local Vite port)*

### Step 3: Mock-azon Backend
```bash
cd monitored-app/backend
npm install
npm run dev
```
*(Runs on `http://localhost:4000`)*

### Step 4: Mock-azon UI
```bash
cd monitored-app/frontend
npm install
npm run dev
```
*(Runs on `http://localhost:5173` or your local Vite port)*

---

## 🛠️ Tech Stack
* **Frontend:** React, Vite, TSX, Tailwind CSS, React Flow
* **Backend:** Node.js, NestJS, Express.js, TypeScript
* **Observability:** OpenTelemetry (OTLP), Jaeger
* **Database:** PostgreSQL (simulated telemetry correlations)

## 💡 Built For
This project was conceptualized and built during a Hackathon to solve the massive mental load developers face when trying to debug complex, silent failures inside distributed systems.
