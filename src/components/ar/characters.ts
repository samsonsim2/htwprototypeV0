import * as THREE from 'three';
import { createRubberTree } from './rubberTree';

export type EncounterKind = 'mynas' | 'bun' | 'rubber-tree';

const material = (color: string, roughness = .7) => new THREE.MeshStandardMaterial({ color, roughness });

function ellipsoid(parent: THREE.Object3D, mat: THREE.Material, position: number[], size: number[]) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mat);
  mesh.position.set(...position as [number, number, number]);
  mesh.scale.set(...size as [number, number, number]);
  parent.add(mesh);
  return mesh;
}

function shadow(parent: THREE.Group, x: number, z: number, width: number, depth: number) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(32, 32, 2, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(0,0,0,.3)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, .001, z);
  parent.add(mesh);
}

function myna() {
  const bird = new THREE.Group();
  const charcoal = material('#171b21', .45);
  const wingMat = material('#252c34');
  const orange = material('#ff9c24', .48);
  const cream = material('#efeee3');
  const eyeMat = material('#080a0c', .12);
  ellipsoid(bird, charcoal, [0, .13, 0], [.067, .09, .09]);
  const head = new THREE.Group();
  head.position.set(0, .225, .048);
  bird.add(head);
  ellipsoid(head, charcoal, [0, 0, 0], [.052, .052, .054]);
  // A little swept crest, orange eye patches and white wing flashes identify a myna.
  ellipsoid(head, charcoal, [0, .039, -.024], [.021, .032, .025]).rotation.x = -.5;
  for (const side of [-1, 1]) {
    ellipsoid(head, orange, [side * .047, .005, .02], [.008, .016, .02]);
    ellipsoid(head, eyeMat, [side * .052, .008, .027], [.005, .006, .006]);
    ellipsoid(head, cream, [side * .055, .01, .031], [.0018, .002, .002]);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(.004, .005, .047, 8), orange);
    leg.position.set(side * .027, .035, .02);
    bird.add(leg);
    for (const toe of [-1, 0, 1]) {
      const foot = new THREE.Mesh(new THREE.CapsuleGeometry(.003, .035, 3, 6), orange);
      foot.rotation.x = Math.PI / 2;
      foot.rotation.z = toe * .25;
      foot.position.set(side * .027 + toe * .008, .012, .04);
      bird.add(foot);
    }
  }
  const beak = new THREE.Mesh(new THREE.ConeGeometry(.017, .064, 12), orange);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, -.008, .073);
  head.add(beak);
  const wings: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(side * .054, .16, -.008);
    ellipsoid(wing, wingMat, [side * .006, -.022, -.015], [.019, .06, .065]);
    ellipsoid(wing, cream, [side * .019, -.025, -.01], [.005, .032, .022]);
    bird.add(wing);
    wings.push(wing);
  }
  ellipsoid(bird, charcoal, [0, .105, -.105], [.029, .019, .075]).rotation.x = -.2;
  return { bird, head, wings };
}

function pinkBun() {
  const bun = new THREE.Group();
  const pink = material('#ee91b2', .9);
  const ridge = material('#d96b94', .85);
  const leaf = material('#446c46');
  ellipsoid(bun, leaf, [0, .007, 0], [.115, .006, .084]);
  ellipsoid(bun, pink, [0, .034, 0], [.092, .037, .07]);
  // Raised concentric stamps suggest an ang ku kueh rather than a generic sphere.
  for (const radius of [.026, .049, .073]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, .0019, 6, 48), ridge);
    ring.rotation.x = -Math.PI / 2;
    ring.scale.y = .72;
    ring.position.y = .034 + .036 * Math.sqrt(1 - (radius / .096) ** 2);
    bun.add(ring);
  }
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    const petal = ellipsoid(bun, ridge, [Math.cos(a) * .013, .071, Math.sin(a) * .009], [.009, .0015, .003]);
    petal.rotation.y = -a;
  }
  return bun;
}

export function createEncounter(kind: EncounterKind) {
  const root = new THREE.Group();
  const actors = new THREE.Group();
  root.add(actors);
  const birds = kind === 'mynas' ? [myna(), myna()] : [];
  birds.forEach(({ bird }, i) => { bird.position.x = i === 0 ? -.15 : .15; bird.rotation.y = i === 0 ? .35 : -.5; actors.add(bird); shadow(root, bird.position.x, 0, .22, .26); });
  const bun = kind === 'bun' ? pinkBun() : null;
  if (bun) { actors.add(bun); shadow(root, 0, 0, .26, .2); }
  const tree = kind === 'rubber-tree' ? createRubberTree() : null;
  if (tree) { actors.add(tree.root); shadow(root, 0, 0, .5, .5); }
  let reactionAt = -100;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    root,
    react: (seconds: number) => { reactionAt = seconds; tree?.react(seconds); },
    animate: (seconds: number) => {
      tree?.animate(seconds);
      const reacting = seconds - reactionAt;
      birds.forEach(({ bird, head, wings }, i) => {
        const t = seconds + i * 1.7;
        const hop = !reducedMotion && reacting < 1.4 ? Math.max(0, Math.sin(reacting * 11 + i)) * .07 : 0;
        bird.position.y = hop;
        head.rotation.z = Math.sin(t * 1.1) * .12;
        head.rotation.x = Math.max(0, Math.sin(t * .9)) * .22;
        wings.forEach((wing, side) => { wing.rotation.z = (side === 0 ? -1 : 1) * (hop > 0 ? .75 : .025 * Math.sin(t * 2)); });
      });
      if (bun) {
        const squash = !reducedMotion && reacting < 1 ? Math.sin(reacting * Math.PI * 4) * .13 * (1 - reacting) : 0;
        bun.scale.set(1 + squash * .4, 1 - squash, 1 + squash * .4);
      }
    },
  };
}

export function disposeScene(scene: THREE.Scene) {
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const mat of Array.isArray(object.material) ? object.material : [object.material]) materials.add(mat);
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(mat => {
    const map = (mat as THREE.MeshBasicMaterial).map;
    map?.dispose();
    mat.dispose();
  });
}
