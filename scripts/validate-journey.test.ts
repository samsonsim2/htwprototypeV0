import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { LocationPin } from '../src/config';
import { journeyPins, walkingPath, nearWalkingPath, backOnBusPath, WALKING_STOP_IDS } from '../src/journeyRoutes';

const ids = ['pin-8', 'pin-9', 'pin-9b', ...WALKING_STOP_IDS, 'pin-13', 'pin-13b', 'pin-14'];
const pins: LocationPin[] = ids.map((id, i) => ({
  id, name: id, lat: 1.34 + i * 0.002, lng: 103.83, radius: 25,
  audioUrl: `${id}.mp3`, buttonLabel: id, description: '',
}));

test('bus next/previous skip all walking stops and the Get Off recording', () => {
  const route = journeyPins(pins, false).map(pin => pin.id);
  assert.deepEqual(route, ['pin-8', 'pin-9', 'pin-13', 'pin-13b', 'pin-14']);
  assert.equal(route[route.indexOf('pin-9') + 1], 'pin-13');
  assert.equal(route[route.indexOf('pin-13') - 1], 'pin-9');
});

test('walking mode selects Get Off and preserves five independent recordings in order', () => {
  assert.deepEqual(WALKING_STOP_IDS, ['pin-10', 'pin-11', 'pin-11b', 'pin-12', 'pin-12b']);
  const route = journeyPins(pins, true);
  assert.deepEqual(route.map(pin => pin.id), ids.filter(id => id !== 'pin-9'));
  for (const id of WALKING_STOP_IDS) assert.equal(route.find(pin => pin.id === id)?.audioUrl, `${id}.mp3`);
  assert.equal(pins.length, ids.length);
});

test('walking map branch preserves endpoints and direction, even with unordered source data', () => {
  assert.deepEqual(walkingPath([...pins].reverse()).map(pin => pin.id),
    ['pin-9', ...WALKING_STOP_IDS, 'pin-13']);
});

test('walking recovery is available at stops and between stop geofences', () => {
  const walk = walkingPath(pins);
  for (const pin of walk) assert.equal(nearWalkingPath([pin.lat, pin.lng], pins), true);
  const midpoint: [number, number] = [(walk[2].lat + walk[3].lat) / 2, walk[2].lng];
  assert.equal(nearWalkingPath(midpoint, pins), true);
  assert.equal(nearWalkingPath([1.4, 103.9], pins), false);
  assert.equal(nearWalkingPath(midpoint, []), false);
});

test('returning to bus mode excludes walking GPS candidates again', () => {
  journeyPins(pins, true);
  assert.equal(journeyPins(pins, false).some(pin => WALKING_STOP_IDS.includes(pin.id)), false);
});

test('bus return detection excludes shared endpoints, walking stops and the walking corridor', () => {
  const coords: Record<string, [number, number]> = {
    'pin-8': [1.35, 103.84], 'pin-9': [1.3464, 103.8388],
    'pin-10': [1.3458626601144086, 103.83792485944144],
    'pin-11': [1.3456217097428054, 103.83658693895325],
    'pin-11b': [1.345196032059016, 103.83560879934382],
    'pin-12': [1.3438015917681236, 103.83543835393914],
    'pin-12b': [1.342491686652401, 103.83502084637337],
    'pin-13': [1.3412, 103.8366], 'pin-14': [1.332, 103.839],
  };
  const route = Object.entries(coords).map(([id, [lat, lng]]) => ({ ...pins[0], id, lat, lng, radius: 50 }));
  assert.equal(backOnBusPath(coords['pin-8'], route), true);
  assert.equal(backOnBusPath(coords['pin-14'], route), true);
  assert.equal(backOnBusPath([1.3482, 103.8394], route), true);
  for (const id of ['pin-9', ...WALKING_STOP_IDS, 'pin-13']) {
    assert.equal(backOnBusPath(coords[id], route), false, id);
  }
  assert.equal(backOnBusPath([1.3445, 103.836], route), false);
  assert.equal(backOnBusPath([1.4, 103.9], route), false);
});
