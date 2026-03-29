import express from 'express';
import cors from 'cors';
import { issuesRouter } from './controllers/issues.controller';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'monitored-issue-tracker' });
  });

  app.use('/api/issues', issuesRouter);

  return app;
}
