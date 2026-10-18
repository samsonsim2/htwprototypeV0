import * as THREE from 'three';

// A small Hevea tree, with a spiral tapping cut and a latex collection cup.
export function createRubberTree() {
  const root = new THREE.Group();
  const bark = new THREE.MeshStandardMaterial({ color: '#78604a', roughness: 1 });
  const leaf = new THREE.MeshStandardMaterial({ color: '#356638', roughness: .65 });
  const latex = new THREE.MeshStandardMaterial({ color: '#fff6df', roughness: .3 });
  const dark = new THREE.MeshStandardMaterial({ color: '#40372e' });
  const add = (geometry: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(x, y, z); root.add(mesh); return mesh;
  };
  add(new THREE.CylinderGeometry(.055, .10, 1.65, 18), bark, 0, .825, 0);
  const tube = (points: THREE.Vector3[], radius: number, mat: THREE.Material) =>
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, radius, 6, false), mat, 0, 0, 0);
  for (let branch = 0; branch < 7; branch++) {
    const a = branch * 2.4;
    const y = 1.10 + (branch % 3) * .18;
    const tip = new THREE.Vector3(Math.cos(a) * .42, y + .31, Math.sin(a) * .42);
    tube([new THREE.Vector3(0, y, 0), new THREE.Vector3(tip.x * .5, y + .18, tip.z * .5), tip], .016, bark);
    // Rubber-tree leaves grow in clusters of three broad, glossy leaflets.
    for (let n = 0; n < 3; n++) {
      const angle = a + (n - 1) * .8;
      const foliage = add(new THREE.SphereGeometry(1, 12, 8), leaf, tip.x + Math.cos(angle) * .10, tip.y - .035, tip.z + Math.sin(angle) * .10);
      foliage.scale.set(.085, .026, .21); foliage.rotation.set(.20, -angle + Math.PI / 2, .15);
    }
  }
  const cut: THREE.Vector3[] = [];
  for (let i = 0; i <= 28; i++) {
    const t = i / 28, angle = -.9 + t * 2.3;
    cut.push(new THREE.Vector3(Math.sin(angle) * .079, .94 - t * .22, Math.cos(angle) * .079));
  }
  tube(cut, .006, dark);
  tube(cut.map(p => new THREE.Vector3(p.x, p.y - .004, p.z + .002)), .002, latex);
  const cup = add(new THREE.CylinderGeometry(.073, .046, .08, 24, 1, true), dark, .077, .54, .105);
  cup.rotation.z = -.12;
  add(new THREE.CylinderGeometry(.047, .047, .008, 20), dark, .077, .50, .105);
  const pool = add(new THREE.CircleGeometry(.062, 24), latex, .077, .51, .105); pool.rotation.x = -Math.PI / 2;
  const drops = Array.from({ length: 5 }, () => {
    const drop = add(new THREE.SphereGeometry(.006, 8, 6), latex, .077, .69, .105);
    drop.scale.y = 1.7; drop.visible = false; return drop;
  });
  let tapped = -100, fills = 0, previousFill = 0;
  return {
    root,
    react(seconds: number) {
      previousFill += (fills - previousFill) * Math.min(1, Math.max(0, (seconds - tapped) / 4));
      tapped = seconds; fills = Math.min(fills + .012, .058);
    },
    animate(seconds: number) {
      const elapsed = seconds - tapped;
      drops.forEach((drop, i) => { drop.visible = elapsed >= 0 && elapsed < 4; drop.position.y = .71 - ((elapsed * .75 + i / 5) % 1) * .16; });
      pool.position.y = .51 + previousFill + (fills - previousFill) * Math.min(1, Math.max(0, elapsed / 4));
    },
  };
}
