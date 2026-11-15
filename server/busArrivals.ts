import type { IncomingMessage, ServerResponse } from 'node:http';

export const BUS_STOPS = {
  '54009': 'Ang Mo Kio Interchange',
  '51069': 'Mt Alvernia Hospital',
} as const;

type Bus = { Type?: string; EstimatedArrival?: string; DestinationCode?: string };
export function nextDoubleDecker(data: { Services?: { ServiceNo: string; NextBus?: Bus; NextBus2?: Bus; NextBus3?: Bus }[] }, now = Date.now()) {
  const service = data.Services?.find(item => item.ServiceNo === '166');
  return [service?.NextBus, service?.NextBus2, service?.NextBus3]
    .filter((bus): bus is Bus => bus?.Type === 'DD' && Number.isFinite(Date.parse(bus.EstimatedArrival ?? '')) && Date.parse(bus.EstimatedArrival!) >= now)
    .sort((a, b) => Date.parse(a.EstimatedArrival!) - Date.parse(b.EstimatedArrival!))[0]?.EstimatedArrival ?? null;
}

export function busArrivalHandler(accountKey: string | undefined, request = fetch) {
  const cache = new Map<string, { expires: number; body: string }>();
  const pending = new Map<string, Promise<string>>();
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/api/bus-arrivals') return next();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    const fail = (status: number, error: string) => { res.statusCode = status; res.end(JSON.stringify({ error })); };
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return fail(405, 'Method not allowed'); }
    const stop = url.searchParams.get('stop') ?? '';
    if (!Object.hasOwn(BUS_STOPS, stop)) return fail(400, 'Unsupported bus stop');
    if (!accountKey) return fail(503, 'Bus arrival service is not configured');
    try {
      const hit = cache.get(stop);
      if (hit && hit.expires > Date.now()) return res.end(hit.body);
      let result = pending.get(stop);
      if (!result) {
        result = (async () => {
          const response = await request(`https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival?BusStopCode=${stop}&ServiceNo=166`, {
            headers: { AccountKey: accountKey, accept: 'application/json' }, signal: AbortSignal.timeout(10000),
          });
          if (!response.ok) throw new Error('LTA request failed');
          const data = await response.json();
          if (!Array.isArray(data.Services)) throw new Error('Invalid LTA response');
          const body = JSON.stringify({ stop, service: '166', estimatedArrival: nextDoubleDecker(data), updatedAt: new Date().toISOString() });
          cache.set(stop, { expires: Date.now() + 20000, body });
          return body;
        })();
        pending.set(stop, result);
      }
      try { res.end(await result); } finally { pending.delete(stop); }
    } catch { fail(502, 'Live arrivals are temporarily unavailable'); }
  };
}
