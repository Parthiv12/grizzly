# Debug Flow Visualizer Frontend

Premium trace exploration UI built with React, Vite, TypeScript, and React Flow.

## Run

From `client/`:

```bash
npm install
npm run dev
```

Backend expected at `http://localhost:3000`.

The dev server proxies `/api/*` to backend, so traces are fetched from `/api/traces`.

## Features

- Left trace explorer with search and status filters
- Center graph canvas with React Flow nodes and edges
- Right details inspector for selected span
- Live polling toggle
- Error/slow/success visual states
