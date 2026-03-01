/**
 * Line-segment vs circle collision and bounce/block for enemies.
 */

/**
 * Squared distance from point (px, py) to segment (x1,y1)-(x2,y2).
 * Returns squared distance (avoids sqrt until needed).
 */
function pointToSegmentSq(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return (px - x1) ** 2 + (py - y1) ** 2;
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return (px - projX) ** 2 + (py - projY) ** 2;
}

/**
 * Check if circle at (cx, cy) with radius r intersects segment (x1,y1)-(x2,y2).
 */
export function circleSegmentIntersect(cx, cy, r, x1, y1, x2, y2) {
  const dSq = pointToSegmentSq(cx, cy, x1, y1, x2, y2);
  return dSq <= r * r;
}

/**
 * Get normal of segment (pointing "left" of direction (x2-x1, y2-y1)).
 * Unit vector.
 */
function segmentNormal(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  return { nx: -dy / len, ny: dx / len };
}

/**
 * Reflect velocity (vx, vy) over segment (x1,y1)-(x2,y2).
 * Uses segment normal and reflects so enemy bounces off the line.
 */
export function reflectOffSegment(vx, vy, x1, y1, x2, y2) {
  const { nx, ny } = segmentNormal(x1, y1, x2, y2);
  const dot = vx * nx + vy * ny;
  return {
    vx: vx - 2 * dot * nx,
    vy: vy - 2 * dot * ny,
  };
}

/**
 * Check enemy (x, y, radius) against all lines; if collision, reflect velocity
 * and optionally nudge position out of the line.
 */
export function resolveLineCollisions(enemy, lines) {
  const { x, y, vx, vy, radius } = enemy;
  let outVx = vx;
  let outVy = vy;
  let outX = x;
  let outY = y;

  for (const points of lines) {
    for (let i = 0; i < points.length - 1; i++) {
      const x1 = points[i].x, y1 = points[i].y;
      const x2 = points[i + 1].x, y2 = points[i + 1].y;
      if (circleSegmentIntersect(x, y, radius, x1, y1, x2, y2)) {
        const reflected = reflectOffSegment(outVx, outVy, x1, y1, x2, y2);
        outVx = reflected.vx;
        outVy = reflected.vy;
        // Nudge out of line to avoid sticking
        const { nx, ny } = segmentNormal(x1, y1, x2, y2);
        const nudge = radius + 2;
        outX = x + nx * nudge;
        outY = y + ny * nudge;
      }
    }
  }

  enemy.vx = outVx;
  enemy.vy = outVy;
  enemy.x = outX;
  enemy.y = outY;
}
