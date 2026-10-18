import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { GroundEncounter, type GroundState } from '../src/components/ar/GroundEncounter';
import { endGroundSession, launchGroundAR } from '../src/components/ar/session';
import { bindARExitControls } from '../src/components/ar/exitControls';
import { launchHandCamera } from '../src/components/ar/handCamera';
import { coverPoint, handSide, StableHandSide, type Point } from '../src/components/ar/handPose';

// These are isolated stand-ins for browser/XR hardware, not a claim of device testing.
class Canvas extends EventTarget {
  tabIndex = 0;
  removed = false;
  setAttribute() {}
  getContext() { return { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, fillStyle: '' }; }
  remove() { this.removed = true; }
}
Object.defineProperty(globalThis, 'window', { configurable: true, value: { isSecureContext: true, devicePixelRatio: 1, matchMedia: () => ({ matches: false }) } });
Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => new Canvas(), body: { appendChild() {} } } });
Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: class { constructor(private fn: () => void) {} observe() { this.fn(); } disconnect() {} } });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

class Session extends EventTarget {
  ends = 0;
  cancels = 0;
  source = { cancel: () => { this.cancels++; } };
  sourcePromise = Promise.resolve(this.source);
  async requestReferenceSpace() { return {}; }
  requestHitTestSource() { return this.sourcePromise; }
  async end() { this.ends++; this.dispatchEvent(new Event('end')); }
}

function setup(sessionPromise: Promise<Session>, kind: 'mynas' | 'bun' | 'rubber-tree' = 'mynas') {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { xr: { requestSession: () => sessionPromise } } });
  const canvas = new Canvas();
  let loop: ((time: number, frame?: XRFrame) => void) | null = null;
  let scene: THREE.Scene;
  let disposed = false;
  const renderer = {
    domElement: canvas,
    xr: { enabled: false, setReferenceSpaceType() {}, async setSession() {}, getReferenceSpace: () => ({}) },
    setPixelRatio() {}, setClearColor() {}, setSize() {},
    setAnimationLoop(next: typeof loop) { loop = next; },
    render(next: THREE.Scene) { scene = next; },
    dispose() { disposed = true; },
  };
  const states: GroundState[] = [];
  const engine = new GroundEncounter({ clientWidth: 390, clientHeight: 740, appendChild() {} } as unknown as HTMLDivElement, kind, state => states.push(state), renderer as unknown as THREE.WebGLRenderer);
  const frame = (x: number, tracking = true, horizontal = true) => {
    const matrix = new THREE.Matrix4().makeTranslation(x, 0, -2);
    if (!horizontal) matrix.makeRotationZ(Math.PI / 2);
    loop?.(0, { getViewerPose: () => tracking ? {} : null, getHitTestResults: () => [{ getPose: () => ({ transform: { matrix: matrix.elements } }) }] } as unknown as XRFrame);
  };
  return { engine, states, frame, canvas, request: sessionPromise as unknown as Promise<XRSession>, disposed: () => disposed, loop: () => loop, root: () => scene.children.find(child => child instanceof THREE.Group)! };
}

test('closing while the session request is pending ends the late session', async () => {
  const pending = deferred<Session>();
  const fixture = setup(pending.promise);
  const opening = fixture.engine.startGroundAR(fixture.request, () => assert.fail('Disposed view must not reopen its camera'));
  fixture.engine.dispose();
  const session = new Session();
  pending.resolve(session);
  await opening;
  assert.equal(session.ends, 1);
  assert.equal(fixture.canvas.removed, true);
  assert.equal(fixture.disposed(), true);
  assert.equal(fixture.loop(), null);
});

test('closing during hit-test setup cancels a late source without restoring the scene', async () => {
  const source = deferred<Session['source']>();
  const session = new Session();
  session.sourcePromise = source.promise;
  const fixture = setup(Promise.resolve(session), 'bun');
  const opening = fixture.engine.startGroundAR(fixture.request, () => assert.fail('Disposed view must not reopen its camera'));
  // Let requestSession, renderer setup and viewer-space acquisition complete.
  await new Promise(done => setImmediate(done));
  fixture.engine.dispose();
  source.resolve(session.source);
  await opening;
  assert.equal(session.ends, 1);
  assert.equal(session.cancels, 1);
  assert.equal(fixture.states.some(state => state.immersive), false);
});

test('placement rejects walls, stays in world space, and hides during tracking loss', async () => {
  const session = new Session();
  const fixture = setup(Promise.resolve(session));
  let ends = 0;
  await fixture.engine.startGroundAR(fixture.request, () => ends++);
  fixture.engine.place();
  assert.equal(fixture.states.at(-1)?.placed, false, 'A session alone must not allow placement');
  fixture.frame(1, false);
  fixture.engine.place();
  assert.equal(fixture.states.at(-1)?.placed, false, 'No placement while tracking is lost');
  fixture.frame(1, true, false);
  fixture.engine.place();
  assert.equal(fixture.states.at(-1)?.placed, false);
  fixture.frame(1);
  fixture.engine.place();
  assert.equal(fixture.states.at(-1)?.placed, true);
  assert.equal(fixture.root().position.x, 1);
  fixture.frame(3);
  assert.equal(fixture.root().position.x, 1, 'Moving the phone must not move an already placed object');
  fixture.frame(3, false);
  assert.equal(fixture.root().visible, false);
  fixture.frame(3, true);
  assert.equal(fixture.root().visible, true);
  assert.equal(fixture.root().position.x, 1);
  fixture.engine.rotate();
  assert.equal(fixture.root().scale.x, 1, 'Objects retain their fixed physical size');
  await session.end();
  assert.equal(ends, 1);
  assert.equal(fixture.states.at(-1)?.immersive, false);
  assert.equal(fixture.states.at(-1)?.placed, false);
  fixture.engine.dispose();
  assert.equal(session.cancels, 1);
});

test('all ground models require tracked ground and release their rendering resources', async () => {
  for (const kind of ['mynas', 'bun', 'rubber-tree'] as const) {
    const fixture = setup(Promise.resolve(new Session()), kind);
    fixture.engine.place();
    fixture.frame(0);
    assert.equal(fixture.root().visible, false, 'Untracked preview must never place objects');
    assert.equal(fixture.states.some(state => state.placed), false);
    await fixture.engine.startGroundAR(fixture.request, () => {});
    fixture.frame(0);
    fixture.engine.place();
    fixture.frame(0);
    const root = fixture.root();
    assert.equal(root.visible, true);
    const box = new THREE.Box3().setFromObject(root);
    for (const value of [...box.min.toArray(), ...box.max.toArray()]) assert.ok(Number.isFinite(value));
    assert.ok(box.max.y > 0 && box.max.y < (kind === 'rubber-tree' ? 2 : .5));
    let geometriesDisposed = 0;
    const geometries = new Set<THREE.BufferGeometry>();
    root.traverse(child => { if (child instanceof THREE.Mesh) geometries.add(child.geometry); });
    geometries.forEach(geometry => geometry.addEventListener('dispose', () => geometriesDisposed++));
    fixture.engine.reset();
    assert.equal(root.visible, false);
    fixture.engine.dispose();
    assert.equal(geometriesDisposed, geometries.size);
    assert.equal(fixture.loop(), null);
  }
});

test('the launch requests tracking synchronously and closes a late session only once', async () => {
  const pending = deferred<XRSession>();
  let called = false;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { xr: {
    requestSession(mode: string, options: XRSessionInit) {
      called = true;
      assert.equal(mode, 'immersive-ar');
      assert.deepEqual(options.requiredFeatures, ['hit-test', 'dom-overlay']);
      assert.ok(options.domOverlay?.root);
      return pending.promise;
    },
  } } });
  const launch = launchGroundAR();
  assert.equal(called, true, 'Must request in the capsule click, not an effect or lazy callback');
  launch.dispose();
  const session = new Session();
  pending.resolve(session as unknown as XRSession);
  await launch.session;
  launch.dispose();
  assert.equal(session.ends, 1);
  assert.equal((launch.overlayRoot as unknown as Canvas).removed, true);
});

test('hit-test startup failure is reported without treating it as a normal user exit', async () => {
  const session = new Session();
  session.requestHitTestSource = () => Promise.reject(new Error('No surface tracking'));
  const fixture = setup(Promise.resolve(session));
  await assert.rejects(fixture.engine.startGroundAR(fixture.request, () => assert.fail('Startup failure must stay visible')), /No surface tracking/);
  assert.equal(session.ends, 1);
  fixture.engine.dispose();
});

test('leaving AR keeps its overlay mounted until the native session finishes ending', async () => {
  const ending = deferred<void>();
  const session = new Session();
  session.end = () => ending.promise;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { xr: { requestSession: () => Promise.resolve(session) } } });
  const launch = launchGroundAR();
  await launch.session;
  const closing = launch.dispose();
  assert.equal((launch.overlayRoot as unknown as Canvas).removed, false);
  ending.resolve();
  await closing;
  assert.equal((launch.overlayRoot as unknown as Canvas).removed, true);
});

test('failed exit keeps its controls mounted and a second tap can end the session', async () => {
  const session = new Session();
  session.end = async () => {
    session.ends++;
    if (session.ends === 1) throw new Error('Temporary shutdown failure');
    session.dispatchEvent(new Event('end'));
  };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { xr: { requestSession: () => Promise.resolve(session) } } });
  const launch = launchGroundAR();
  await launch.session;
  await assert.rejects(launch.dispose(), /Temporary shutdown failure/);
  assert.equal((launch.overlayRoot as unknown as Canvas).removed, false);
  await launch.dispose();
  assert.equal(session.ends, 2);
  assert.equal((launch.overlayRoot as unknown as Canvas).removed, true);
});

test('a stalled exit unlocks for retry and the end event completes exit without waiting for its promise', async () => {
  const session = new Session();
  session.end = () => new Promise<void>(() => {});
  const xr = session as unknown as XRSession;
  await assert.rejects(endGroundSession(xr, 10), /too long/);
  const retry = endGroundSession(xr);
  session.dispatchEvent(new Event('end'));
  await retry;
});

test('XR-only taps and keyboard clicks can activate exit; other targets and right clicks cannot', () => {
  const root = new EventTarget();
  const button = { contains: (target: unknown) => target === button };
  let exits = 0;
  const unbind = bindARExitControls(root as HTMLElement, button as unknown as HTMLButtonElement, () => { exits++; });
  const fire = (type: string, target: unknown, mouseButton?: number) => {
    const event = new Event(type, { cancelable: true });
    Object.defineProperty(event, 'target', { value: target });
    if (mouseButton !== undefined) Object.defineProperty(event, 'button', { value: mouseButton });
    root.dispatchEvent(event);
    return event;
  };
  assert.equal(fire('beforexrselect', button).defaultPrevented, true);
  assert.equal(exits, 1); // No pointerdown/touchstart/click was delivered.
  fire('click', button);
  assert.equal(exits, 2);
  fire('beforexrselect', root);
  fire('pointerdown', button, 2);
  assert.equal(exits, 2);
  unbind();
  fire('beforexrselect', button);
  assert.equal(exits, 2);
});

test('closing the hand filter before permission resolves stops the late camera stream', async () => {
  const pending = deferred<MediaStream>();
  let stopped = 0;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: () => pending.promise } } });
  const launch = launchHandCamera();
  await launch.dispose();
  pending.resolve({ getTracks: () => [{ stop: () => { stopped++; } }] } as unknown as MediaStream);
  await launch.stream;
  assert.equal(stopped, 1);
  assert.equal((launch.overlayRoot as unknown as Canvas).removed, true);
});

test('palm/back decisions reverse for the other hand and stay neutral edge-on', () => {
  const points: Point[] = Array.from({ length: 21 }, () => ({ x: .5, y: .8, z: 0 }));
  points[5] = { x: .3, y: .3, z: 0 }; points[17] = { x: .7, y: .3, z: 0 };
  assert.equal(handSide(points, 'Right'), 'back');
  assert.equal(handSide(points, 'Left'), 'palm');
  const mirrored = points.map(p => ({ ...p, x: 1 - p.x }));
  assert.equal(handSide(mirrored, 'Left'), 'back');
  assert.equal(handSide(mirrored, 'Right'), 'palm');
  points[17] = points[5];
  assert.equal(handSide(points, 'Right'), null);
  assert.equal(handSide([], 'Right'), null);
});

test('hand effects wait for a stable side and landmark coordinates match portrait camera cropping', () => {
  const stable = new StableHandSide();
  assert.equal(stable.update('palm', 0), null);
  assert.equal(stable.update('palm', 150), 'palm');
  assert.equal(stable.update('back', 160), null);
  assert.equal(stable.update('palm', 200), null);
  assert.equal(stable.update('palm', 350), 'palm');
  assert.equal(stable.update(null, 400), null);
  const center = coverPoint({ x: .5, y: .5, z: 0 }, 640, 480, 360, 800);
  assert.equal(center.x, 180); assert.equal(center.y, 400);
  const edge = coverPoint({ x: 0, y: 0, z: 0 }, 640, 480, 360, 800);
  assert.ok(edge.x < 0); assert.equal(edge.y, 0);
});
