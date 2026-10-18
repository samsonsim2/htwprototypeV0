import * as THREE from 'three';
import { createEncounter, disposeScene, type EncounterKind } from './characters';
import { endGroundSession } from './session';

export type GroundState = { immersive: boolean; surface: boolean; placed: boolean; tracking: boolean };

// Objects cannot be placed without an active tracked WebXR session.
export class GroundEncounter {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 1, .01, 30);
  private encounter: ReturnType<typeof createEncounter>;
  private reticle = new THREE.Mesh(new THREE.RingGeometry(.09, .105, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .85, depthTest: false }));
  private ray = new THREE.Raycaster();
  private startedAt = performance.now();
  private seconds = () => (performance.now() - this.startedAt) / 1000;
  private resize: ResizeObserver;
  private session: XRSession | null = null;
  private hitSource: XRHitTestSource | null = null;
  private state: GroundState = { immersive: false, surface: false, placed: false, tracking: true };
  private disposed = false;
  private rotation = 0;
  private ended?: () => void;

  constructor(private host: HTMLDivElement, private kind: EncounterKind, private onState: (state: GroundState) => void,
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })) {
    this.renderer = renderer;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.xr.enabled = true;
    this.renderer.xr.setReferenceSpaceType('local');
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(this.renderer.domElement);
    this.camera.position.set(0, 1.15, 1.65);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x657267, 2.7));
    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(1, 3, 2);
    this.scene.add(key);
    this.encounter = createEncounter(kind);
    this.encounter.root.visible = false;
    this.scene.add(this.encounter.root);
    this.reticle.matrixAutoUpdate = false;
    this.reticle.visible = false;
    this.scene.add(this.reticle);
    this.resize = new ResizeObserver(() => {
      if (this.disposed) return;
      this.camera.aspect = host.clientWidth / host.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(host.clientWidth, host.clientHeight);
    });
    this.resize.observe(host);
    this.renderer.setAnimationLoop((_time, frame) => {
      if (this.disposed) return;
      if (frame && this.session) {
        const space = this.renderer.xr.getReferenceSpace();
        if (space) {
          const tracking = !!frame.getViewerPose(space);
          let surface = false;
          if (tracking && this.hitSource && !this.state.placed) {
            for (const hit of frame.getHitTestResults(this.hitSource)) {
              const pose = hit.getPose(space);
              // Ignore walls: the local Y axis of the hit must face upwards.
              if (pose && pose.transform.matrix[5] > .85) {
                this.reticle.matrix.fromArray(pose.transform.matrix);
                surface = true;
                break;
              }
            }
          }
          this.reticle.visible = surface && !this.state.placed;
          this.encounter.root.visible = tracking && this.state.placed;
          this.update({ surface, tracking });
        }
      }
      this.encounter.animate(this.seconds());
      this.renderer.render(this.scene, this.camera);
    });
  }

  private update(next: Partial<GroundState>) {
    const state = { ...this.state, ...next };
    if (Object.keys(state).some(key => state[key as keyof GroundState] !== this.state[key as keyof GroundState])) {
      this.state = state;
      this.onState({ ...state });
    }
  }

  private select = (event: XRInputSourceEvent) => {
    if (this.state.placed) {
      const reference = this.renderer.xr.getReferenceSpace();
      const pose = reference && event.frame.getPose(event.inputSource.targetRaySpace, reference);
      if (pose) {
        const matrix = new THREE.Matrix4().fromArray(pose.transform.matrix);
        this.ray.ray.origin.setFromMatrixPosition(matrix);
        this.ray.ray.direction.set(0, 0, -1).transformDirection(matrix);
        if (this.ray.intersectObject(this.encounter.root, true).length) this.interact();
      }
    } else this.place();
  };

  async startGroundAR(request: Promise<XRSession>, onEnd: () => void) {
    const session = await request;
    if (this.disposed) { await endGroundSession(session); return; }
    this.session = session;
    this.ended = onEnd;
    session.addEventListener('end', this.sessionEnded);
    session.addEventListener('select', this.select);
    try {
      await this.renderer.xr.setSession(session);
      const viewer = await session.requestReferenceSpace('viewer');
      if (!session.requestHitTestSource) throw new Error('Surface detection is unavailable.');
      const source = await session.requestHitTestSource({ space: viewer });
      if (this.disposed || this.session !== session) { source?.cancel(); return; }
      this.hitSource = source ?? null;
      if (!this.hitSource) throw new Error('Surface detection could not start.');
      this.reset();
      this.update({ immersive: true, tracking: true });
    } catch (error) {
      this.ended = undefined;
      await endGroundSession(session);
      throw error;
    }
  }

  private sessionEnded = () => {
    this.hitSource?.cancel();
    this.hitSource = null;
    this.session?.removeEventListener('select', this.select);
    this.session?.removeEventListener('end', this.sessionEnded);
    this.session = null;
    if (this.disposed) return;
    this.camera.position.set(0, 1.15, 1.65);
    this.camera.lookAt(0, 0, 0);
    this.reset();
    this.update({ immersive: false, tracking: true });
    this.ended?.();
  };

  place() {
    if (!this.session || !this.state.immersive || !this.state.surface || !this.state.tracking || this.state.placed) return;
    this.reticle.matrix.decompose(this.encounter.root.position, this.encounter.root.quaternion, this.encounter.root.scale);
    this.encounter.root.rotateY(this.rotation);
    this.encounter.root.scale.setScalar(1);
    this.encounter.root.visible = true;
    this.reticle.visible = false;
    this.update({ placed: true });
    if (this.kind !== 'rubber-tree') this.interact();
  }

  interact() { this.encounter.react(this.seconds()); }
  rotate() { this.rotation += Math.PI / 4; this.encounter.root.rotateY(Math.PI / 4); }
  reset() {
    this.encounter.root.visible = false;
    this.reticle.visible = false;
    this.update({ placed: false, surface: false });
  }

  dispose() {
    this.disposed = true;
    this.resize.disconnect();
    this.hitSource?.cancel();
    this.hitSource = null;
    if (this.session) {
      this.session.removeEventListener('end', this.sessionEnded);
      this.session.removeEventListener('select', this.select);
      void endGroundSession(this.session).catch(() => {});
    }
    this.renderer.setAnimationLoop(null);
    disposeScene(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
