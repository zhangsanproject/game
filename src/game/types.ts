/** Shared, engine-independent value types. No DOM, Three.js or storage here. */

export type Team = 'player' | 'enemy';
export type ShipKind = 'player' | 'enemy';
export type UpgradeType = 'hull' | 'speed' | 'damage';

export interface Vec2 {
  x: number;
  z: number;
}

export interface ShipIntent {
  /** -1 = reverse/brake, 0 = coast, 1 = full ahead */
  throttle: number;
  /** -1 = right, 1 = left */
  steer: number;
}

export interface ShipStats {
  maxHp: number;
  maxSpeed: number;
  acceleration: number;
  /** radians per second at full manoeuvring efficiency */
  turnRate: number;
  hitRadius: number;
  cannonDamage: number;
  /** seconds between shots */
  fireCooldown: number;
  projectileSpeed: number;
  cannonRange: number;
}

export interface GridObstacle {
  x: number;
  z: number;
  radius: number;
}
