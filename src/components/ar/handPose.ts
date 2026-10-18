export type Point = { x: number; y: number; z: number };
export type HandSide = 'palm' | 'back';

// MediaPipe's handedness follows a mirrored/selfie convention. Our camera feed
// is unmirrored, so reverse that label's winding. Edge-on poses stay neutral.
export function handSide(points: Point[], handedness: string): HandSide | null {
  if (points.length !== 21 || !['Left', 'Right'].includes(handedness)) return null;
  const wrist = points[0], index = points[5], pinky = points[17];
  const ax = index.x - wrist.x, ay = index.y - wrist.y;
  const bx = pinky.x - wrist.x, by = pinky.y - wrist.y;
  const cross = (ax * by - ay * bx) / Math.max(.00001, Math.hypot(ax, ay) * Math.hypot(bx, by));
  if (!Number.isFinite(cross) || Math.abs(cross) < .18) return null;
  return cross * (handedness === 'Right' ? -1 : 1) > 0 ? 'palm' : 'back';
}

export class StableHandSide {
  private candidate: HandSide | null = null;
  private since = 0;
  current: HandSide | null = null;
  update(next: HandSide | null, now: number) {
    if (next !== this.candidate) { this.candidate = next; this.since = now; this.current = null; }
    if (next === null) this.current = null;
    else if (now - this.since >= 140) this.current = next;
    return this.current;
  }
}

// Match object-fit:cover exactly, including portrait crops and rotation resizes.
export function coverPoint(point: Point, videoWidth: number, videoHeight: number, width: number, height: number): Point {
  const scale = Math.max(width / videoWidth, height / videoHeight);
  return { x: point.x * videoWidth * scale + (width - videoWidth * scale) / 2,
    y: point.y * videoHeight * scale + (height - videoHeight * scale) / 2, z: point.z * videoWidth * scale };
}
