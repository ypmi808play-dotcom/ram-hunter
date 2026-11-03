export interface Rect { x: number; y: number; width: number; height: number }
export function segmentIntersectsRect(ax: number, ay: number, bx: number, by: number, r: Rect) {
  let low = 0, high = 1;
  for (const [a, d, min, max] of [[ax, bx - ax, r.x, r.x + r.width], [ay, by - ay, r.y, r.y + r.height]]) {
    if (Math.abs(d) < 0.00001) { if (a < min || a > max) return false; continue; }
    const p = (min - a) / d, q = (max - a) / d;
    low = Math.max(low, Math.min(p, q)); high = Math.min(high, Math.max(p, q));
    if (low > high) return false;
  }
  return true;
}
export function clearSight(ax: number, ay: number, bx: number, by: number, obstacles: readonly Rect[]) {
  return !obstacles.some(r => segmentIntersectsRect(ax, ay, bx, by, r));
}
