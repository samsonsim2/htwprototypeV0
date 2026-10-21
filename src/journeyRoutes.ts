import type { LocationPin } from './config';

export const WALKING_STOP_IDS = ['pin-11', 'pin-11b', 'pin-12', 'pin-13'];
export const isWalkingStop = (id: string) => WALKING_STOP_IDS.includes(id);

export function journeyPins(pins: LocationPin[], walking: boolean) {
  return pins.filter(pin => walking ? pin.id !== 'pin-10' : pin.id !== 'pin-10b' && !isWalkingStop(pin.id));
}

export function walkingPath(pins: LocationPin[]) {
  return ['pin-10', ...WALKING_STOP_IDS, 'pin-14']
    .map(id => pins.find(pin => pin.id === id)).filter((pin): pin is LocationPin => !!pin);
}

// Allow visitors reopening the tour along the walk to opt in again.
export function nearWalkingPath(pos: [number, number], pins: LocationPin[]) {
  return nearPath(pos, walkingPath(pins), 60);
}

function nearPath(pos: [number, number], path: LocationPin[], corridor: number) {
  const scale = Math.cos(pos[0] * Math.PI / 180);
  const point = (pin: LocationPin) => [(pin.lng - pos[1]) * 111320 * scale, (pin.lat - pos[0]) * 111320];
  if (path.some(pin => Math.hypot(...point(pin)) <= pin.radius)) return true;
  return path.slice(1).some((pin, i) => {
    const [ax, ay] = point(path[i]);
    const [bx, by] = point(pin);
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(ax + t * dx, ay + t * dy) <= corridor;
  });
}

export function backOnBusPath(pos: [number, number], pins: LocationPin[]) {
  const endpoints = pins.filter(pin => pin.id === 'pin-10' || pin.id === 'pin-14');
  // The shared entry/exit areas and walking corridor must not cancel the walk.
  if (endpoints.some(pin => nearPath(pos, [pin], 0)) || nearWalkingPath(pos, pins)) return false;
  return nearPath(pos, journeyPins(pins, false), 30);
}
