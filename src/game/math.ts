import type { Vec2 } from './types';

export const HALF_PI = Math.PI / 2;
export const TAU = Math.PI * 2;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Exponential smoothing that stays stable regardless of frame rate. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * Math.max(0, dt)));
}

/** Wrap an angle into (-PI, PI]. */
export function normalizeAngle(angle: number): number {
  let value = ((angle + Math.PI) % TAU + TAU) % TAU - Math.PI;
  if (value === -Math.PI) value = Math.PI;
  return value;
}

export function distanceXZ(ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  return Math.hypot(dx, dz);
}

export function distanceTo(from: Vec2, to: Vec2): number {
  return distanceXZ(from.x, from.z, to.x, to.z);
}

/** Heading convention: forward = (cos(h), -sin(h)) in XZ. */
export function headingToPoint(from: Vec2, to: Vec2): number {
  return Math.atan2(-(to.z - from.z), to.x - from.x);
}

export function forwardX(heading: number): number {
  return Math.cos(heading);
}

export function forwardZ(heading: number): number {
  return -Math.sin(heading);
}

export function randomRange(rng: () => number, min: number, max: number): number {
  return min + (max - min) * rng();
}

/**
 * True when the segment from (x0,z0) to (x1,z1) passes within `radius` of the
 * circle centred at (cx,cz). Prevents fast cannonballs tunnelling through ships.
 */
export function segmentCircleHit(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  cx: number,
  cz: number,
  radius: number,
): boolean {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const lengthSq = dx * dx + dz * dz;
  let t = 0;
  if (lengthSq > 0.000001) {
    t = clamp(((cx - x0) * dx + (cz - z0) * dz) / lengthSq, 0, 1);
  }
  const px = x0 + dx * t;
  const pz = z0 + dz * t;
  return (px - cx) * (px - cx) + (pz - cz) * (pz - cz) <= radius * radius;
}
