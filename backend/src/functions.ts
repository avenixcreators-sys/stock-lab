import dotenv from 'dotenv';
dotenv.config();

import { onRequest } from 'firebase-functions/v2/https';
import { app, startMarketRefresh } from './app.js';

// Market-data refresh keeps prices current while this Cloud Function instance
// is warm. Each serverless instance maintains its own SQLite cache under /tmp
// (see database.ts) and re-seeds the catalog on cold start.
startMarketRefresh();

export const api = onRequest(
  {
    region: 'asia-south1',
    timeoutSeconds: 300,
    memory: '256MiB',
  },
  app
);