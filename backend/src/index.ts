import dotenv from 'dotenv';
dotenv.config();

import { app, API_PORT, startMarketRefresh, logStartupStatus } from './app.js';

startMarketRefresh();

app.listen(API_PORT, () => {
  console.log(`StockLab API running on port ${API_PORT}`);
  console.log('Database initialized and demo market seeded.');
  logStartupStatus();
});