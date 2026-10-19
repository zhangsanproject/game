import { forwardX, forwardZ } from '../math';
import type { ShipIntent, ShipKind, ShipStats, Team, Vec2 } from '../types';

export interface ShipOptions {
  id: string;
  team: Team;
  kind: ShipKind;
  name: string;
  position: Vec2;
  heading: number;
  stats: ShipStats;
  coinValue?: number;
}

/**
 * Pure gameplay representation of a ship. It deliberately contains no Three.js
 * objects or DOM references so movement, AI and combat can be tested headlessly.
 */
export class Ship {
  readonly id: string;
  readonly team: Team;
  readonly kind: ShipKind;
  readonly name: string;
  readonly coinValue: number;

  stats: ShipStats;
  position: Vec2;
  heading: number;
  speed = 0;
  hp: number;
  maxHp: number;
  alive = true;
  fireCooldownRemaining = 0;
  intent: ShipIntent = { throttle: 0, steer: 0 };
  volleySide: 1 | -1 = 1;

  constructor(options: ShipOptions) {
    this.id = options.id;
    this.team = options.team;
    this.kind = options.kind;
    this.name = options.name;
    this.stats = { ...options.stats };
    this.position = { ...options.position };
    this.heading = options.heading;
    this.coinValue = options.coinValue ?? 0;
    this.maxHp = this.stats.maxHp;
    this.hp = this.maxHp;
  }

  get forwardX(): number {
    return forwardX(this.heading);
  }

  get forwardZ(): number {
    return forwardZ(this.heading);
  }

  get velocityX(): number {
    return this.forwardX * this.speed;
  }

  get velocityZ(): number {
    return this.forwardZ * this.speed;
  }

  /** Returns the damage actually applied. Never revives a sunk ship. */
  applyDamage(amount: number): number {
    if (!this.alive || !Number.isFinite(amount) || amount <= 0) return 0;
    const applied = Math.min(this.hp, amount);
    this.hp -= applied;
    if (this.hp <= 0.0001) {
      this.hp = 0;
      this.alive = false;
      this.speed = 0;
    }
    return applied;
  }

  heal(amount: number): number {
    if (!this.alive || !Number.isFinite(amount) || amount <= 0) return 0;
    const healed = Math.min(amount, this.maxHp - this.hp);
    this.hp += healed;
    return healed;
  }
}
