import express from 'express';
import cors from 'cors';
import { productsRouter } from './controllers/products.controller';
import { checkoutRouter } from './controllers/checkout.controller';
import { authRouter } from './controllers/auth.controller';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'monitored-ecommerce' });
  });

  app.use('/api/products', productsRouter);
  app.use('/api/checkout', checkoutRouter);
  app.use('/api/auth', authRouter);

  return app;
}
