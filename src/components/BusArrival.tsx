import { useEffect, useState } from 'react';

type Arrival = { estimatedArrival: string | null; updatedAt: string };
export default function BusArrival({ stop }: { stop: '54009' | '51069' }) {
  const [arrival, setArrival] = useState<Arrival | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let disposed = false;
    let controller: AbortController | undefined;
    setArrival(null);
    setError(false);
    const refresh = async () => {
      if (document.hidden) return;
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch(`/api/bus-arrivals?stop=${stop}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Unavailable');
        const data: Arrival = await response.json();
        if (!disposed) { setArrival(data); setError(false); setNow(Date.now()); }
      } catch (cause) {
        if (!disposed && !(cause instanceof DOMException && cause.name === 'AbortError')) setError(true);
      }
    };
    void refresh();
    const polling = window.setInterval(() => void refresh(), 20000);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    const visible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { disposed = true; controller?.abort(); clearInterval(polling); clearInterval(clock); document.removeEventListener('visibilitychange', visible); };
  }, [stop]);
  const eta = arrival?.estimatedArrival ? Date.parse(arrival.estimatedArrival) : null;
  const stale = arrival && now - Date.parse(arrival.updatedAt) > 60000;
  let text = 'Checking next double-decker...';
  if (error || stale) text = 'Live arrivals temporarily unavailable';
  else if (arrival && eta === null) text = 'No double-decker in the next 3 buses';
  else if (eta !== null) text = eta < now - 20000 ? 'Refreshing arrival...' : eta - now < 60000 ? 'Next double-decker arriving now' : `Next double-decker in ${Math.ceil((eta - now) / 60000)} mins`;
  return <span className="bus-arrival" role="status">{text}</span>;
}
