import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FADE, fadeGain } from '../src/components/audioFade';

test('fade curves preserve endpoints, volume bounds and monotonicity', () => {
  for (const curve of ['smooth', 'linear', 'exponential'] as const) {
    for (const shape of [0.5, 1, 3]) {
      const settings = { ...DEFAULT_FADE, curve, shape };
      assert.equal(fadeGain(0, settings), 0);
      assert.equal(fadeGain(1, settings), 1);
      let previous = 0;
      for (let i = 0; i <= 100; i++) {
        const incoming = fadeGain(i / 100, settings);
        assert.ok(incoming >= previous && incoming <= 1);
        assert.ok(Math.abs(incoming + (1 - incoming) - 1) < 1e-12);
        previous = incoming;
      }
    }
  }
});
test('smooth default avoids the old early drop and eases at both ends', () => {
  assert.ok(fadeGain(0.1, DEFAULT_FADE) < 0.04);
  assert.equal(fadeGain(0.5, DEFAULT_FADE), 0.5);
  assert.ok(fadeGain(0.9, DEFAULT_FADE) > 0.96);
});
