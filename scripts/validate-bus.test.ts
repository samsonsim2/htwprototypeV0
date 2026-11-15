import { test } from 'node:test';
import assert from 'node:assert/strict';
import { busArrivalHandler, nextDoubleDecker } from '../server/busArrivals';

const now = Date.now();
const bus = (Type: string, minutes: number) => ({ Type, EstimatedArrival: new Date(now + minutes * 60000).toISOString() });
test('finds the earliest future double-decker across all three predictions', () => {
  assert.equal(nextDoubleDecker({ Services: [{ ServiceNo: '166', NextBus: bus('SD', 1), NextBus2: bus('DD', 8), NextBus3: bus('DD', 5) }] }, now), bus('DD', 5).EstimatedArrival);
  assert.equal(nextDoubleDecker({ Services: [{ ServiceNo: '166', NextBus: bus('DD', -1), NextBus2: bus('SD', 3), NextBus3: { Type: 'DD', EstimatedArrival: '' } }] }, now), null);
  assert.equal(nextDoubleDecker({ Services: [{ ServiceNo: '130', NextBus: bus('DD', 2) }] }, now), null);
});
test('endpoint restricts stops, caches requests, hides secrets and handles upstream errors', async () => {
  let calls = 0;
  const handler = busArrivalHandler('test-secret', (async (_url, options) => {
    calls++;
    assert.equal((options?.headers as Record<string, string>).AccountKey, 'test-secret');
    return new Response(JSON.stringify({ Services: [{ ServiceNo: '166', NextBus: bus('DD', 5) }] }));
  }) as typeof fetch);
  const invoke = async (stop: string, method = 'GET') => {
    let status = 200;
    let body = '';
    await handler({ url: `/api/bus-arrivals?stop=${stop}`, method } as any, {
      setHeader() {}, set statusCode(value) { status = value; }, end(value: string) { body = value; },
    } as any, () => assert.fail('Unexpected fallthrough'));
    return { status, body };
  };
    assert.equal((await invoke('invalid')).status, 400);
    assert.equal((await invoke('toString')).status, 400);
    assert.equal((await invoke('54009', 'POST')).status, 405);
    const { body: text } = await invoke('54009');
    assert.ok(!text.includes('test-secret'));
    assert.equal(JSON.parse(text).estimatedArrival, bus('DD', 5).EstimatedArrival);
    await invoke('54009');
    assert.equal(calls, 1);
  for (const [key, request, status] of [
    [undefined, fetch, 503],
    ['secret', async () => new Response('denied', { status: 401 }), 502],
  ] as const) {
    const fallback = busArrivalHandler(key, request as typeof fetch);
    let code = 200;
    let body = '';
    await fallback({ url: '/api/bus-arrivals?stop=51069', method: 'GET' } as any, { setHeader() {}, set statusCode(value) { code = value; }, end(value: string) { body = value; } } as any, () => {});
    assert.equal(code, status);
    assert.ok(!body.includes('secret'));
  }
});
