import express from 'express';
import { config } from 'dotenv';
import path from 'node:path';
import { busArrivalHandler } from './busArrivals';

config({ path: '.env.local' });
config();
const app = express();
app.use(busArrivalHandler(process.env.LTA_ACCOUNT_KEY));
app.use(express.static(path.resolve('dist')));
app.get('*', (_req, res) => res.sendFile(path.resolve('dist/index.html')));
app.listen(Number(process.env.PORT) || 3000, '0.0.0.0');
