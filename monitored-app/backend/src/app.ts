import express from 'express';
import cors from 'cors';
import { authRouter } from './controllers/auth.controller';
import { usersRouter } from './controllers/users.controller';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'monitored-issue-tracker' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);

  return app;
}
