import type { IncomingMessage, ServerResponse } from 'node:http';
import { busArrivalHandler } from '../server/busArrivals.js';

// Vercel runs API routes independently of Vite's development middleware.
const handleArrival = busArrivalHandler(process.env.LTA_ACCOUNT_KEY);

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleArrival(req, res, () => {
    res.statusCode = 404;
    res.end();
  });
}
