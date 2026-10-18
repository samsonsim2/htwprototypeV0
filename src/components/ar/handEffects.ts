import type { HandSide, Point } from './handPose';

// Procedural camera-filter art; all anchors come from the detected hand.
export function drawHandEffect(ctx: CanvasRenderingContext2D, points: Point[], side: HandSide, growth: number, seconds: number) {
  const wrist = points[0], middle = points[9];
  const width = Math.hypot(points[5].x - points[17].x, points[5].y - points[17].y);
  if (width < 8) return;
  const cx = wrist.x * .4 + middle.x * .6, cy = wrist.y * .4 + middle.y * .6;
  if (side === 'palm') {
    ctx.save(); ctx.translate(cx, cy);
    ctx.rotate(Math.atan2(middle.y - wrist.y, middle.x - wrist.x) + Math.PI / 2);
    const r = width * .43;
    ctx.scale(growth, growth);
    ctx.fillStyle = 'rgba(25,8,0,.22)'; ctx.beginPath(); ctx.ellipse(0, r * .4, r * .92, r * .40, 0, 0, Math.PI * 2); ctx.fill();
    const red = ctx.createRadialGradient(-r * .35, -r * .4, 0, 0, 0, r * 1.2);
    red.addColorStop(0, '#ff8a55'); red.addColorStop(.35, '#f03c26'); red.addColorStop(.8, '#bd1c16'); red.addColorStop(1, '#7a0f10');
    ctx.fillStyle = red; ctx.beginPath();
    for (let i = 0; i <= 80; i++) {
      const a = i / 80 * Math.PI * 2, rr = r * (1 + .035 * Math.cos(5 * a));
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr * .86;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,230,190,.32)'; ctx.beginPath(); ctx.ellipse(-r * .32, -r * .28, r * .20, r * .10, -.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#38632d'; ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI / 5 - Math.PI / 2, rr = r * (i % 2 ? .12 : .46);
      const x = Math.cos(a) * rr, y = -r * .63 + Math.sin(a) * rr * .48;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#33572b'; ctx.lineWidth = r * .075;
    ctx.beginPath(); ctx.moveTo(0, -r * .64); ctx.quadraticCurveTo(r * .12, -r * .85, r * .02, -r); ctx.stroke();
    ctx.restore();
    return;
  }
  const joints = [[0, 5], [0, 9], [0, 13], [0, 17], [5, 9], [9, 13], [13, 17], [1, 2], [2, 3], [5, 6], [6, 7], [9, 10], [10, 11], [13, 14], [14, 15], [17, 18], [18, 19]];
  ctx.lineCap = 'round';
  joints.forEach(([a, b], segment) => {
    const start = points[a], end = points[b];
    for (let strand = 0; strand < 12; strand++) {
      const seed = segment * 12 + strand, t = (strand + .5) / 12;
      const spread = Math.sin(seed * 7.37) * width * .055;
      const x = start.x + (end.x - start.x) * t + spread;
      const y = start.y + (end.y - start.y) * t + Math.cos(seed * 3.1) * width * .04;
      let dx = x - cx, dy = y - cy; const len = Math.hypot(dx, dy) || 1;
      const length = width * (.15 + .16 * (Math.sin(seed * 2.4) + 1) / 2) * growth;
      dx = dx / len * length; dy = dy / len * length;
      const curl = Math.sin(seed) * width * .08 * growth + Math.sin(seconds * 2 + seed) * width * .014;
      ctx.strokeStyle = ['#bc2521', '#df3c23', '#f36b35', '#90211e'][seed % 4];
      ctx.lineWidth = Math.max(.8, width * .009);
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + dx * .25 - dy * .35, y + dy * .25 + dx * .35, x + dx + curl, y + dy - curl, x + dx, y + dy);
      ctx.stroke();
    }
  });
}
