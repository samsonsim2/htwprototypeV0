import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { LocationPin } from '../src/config';
import { journeyPins, walkingPath, nearWalkingPath, backOnBusPath, WALKING_STOP_IDS } from '../src/journeyRoutes';

const ids = ['pin-9', 'pin-10', 'pin-10b', ...WALKING_STOP_IDS, 'pin-14', 'pin-14b', 'pin-15'];
const pins: LocationPin[] = ids.map((id, i) => ({
  id, name: id, lat: 1.34 + i * 0.002, lng: 103.83, radius: 25,
  audioUrl: `${id}.mp3`, buttonLabel: id, description: '',
}));

test('bus next/previous skip all walking stops and the Get Off recording', () => {
  const route = journeyPins(pins, false).map(pin => pin.id);
  assert.deepEqual(route, ['pin-9', 'pin-10', 'pin-14', 'pin-14b', 'pin-15']);
  assert.equal(route[route.indexOf('pin-10') + 1], 'pin-14');
  assert.equal(route[route.indexOf('pin-14') - 1], 'pin-10');
});

test('walking mode selects Get Off and preserves four independent recordings in order', () => {
  const route = journeyPins(pins, true);
  assert.deepEqual(route.map(pin => pin.id), ids.filter(id => id !== 'pin-10'));
  for (const id of WALKING_STOP_IDS) assert.equal(route.find(pin => pin.id === id)?.audioUrl, `${id}.mp3`);
  assert.equal(pins.length, ids.length);
});

test('walking map branch preserves endpoints and direction, even with unordered source data', () => {
  assert.deepEqual(walkingPath([...pins].reverse()).map(pin => pin.id),
    ['pin-10', ...WALKING_STOP_IDS, 'pin-14']);
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
    'pin-9': [1.35, 103.84], 'pin-10': [1.3464, 103.8388],
    'pin-11': [1.346, 103.8377], 'pin-11b': [1.34575, 103.8371],
    'pin-12': [1.3455, 103.8364], 'pin-13': [1.3435, 103.8356],
    'pin-14': [1.3412, 103.8366], 'pin-15': [1.332, 103.839],
  };
  const route = Object.entries(coords).map(([id, [lat, lng]]) => ({ ...pins[0], id, lat, lng, radius: 50 }));
  assert.equal(backOnBusPath(coords['pin-9'], route), true);
  assert.equal(backOnBusPath(coords['pin-15'], route), true);
  assert.equal(backOnBusPath([1.3482, 103.8394], route), true);
  for (const id of ['pin-10', ...WALKING_STOP_IDS, 'pin-14']) {
    assert.equal(backOnBusPath(coords[id], route), false, id);
  }
  assert.equal(backOnBusPath([1.3445, 103.836], route), false);
  assert.equal(backOnBusPath([1.4, 103.9], route), false);
});
