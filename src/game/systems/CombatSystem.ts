import { GAME_CONFIG } from '../config';
import { segmentCircleHit } from '../math';
import type { Ship } from '../entities/Ship';
import type { Projectile } from '../entities/Projectile';
import type { Team } from '../types';

export interface FireEvent {
  type: 'fire';
  shipId: string;
  team: Team;
  x: number;
  z: number;
  heading: number;
  side: 1 | -1;
}

export interface HitEvent {
  type: 'hit';
  targetId: string;
  team: Team;
  x: number;
  z: number;
  damage: number;
}

export interface SunkEvent {
  type: 'sunk';
  shipId: string;
  team: Team;
  x: number;
  z: number;
  coins: number;
}

export type CombatEvent = FireEvent | HitEvent | SunkEvent;

/** Pure combat simulation: aiming, cooldowns, projectile flight and hits. */
export class CombatSystem {
  private readonly projectiles: Projectile[] = [];
  private nextId = 1;

  constructor(private readonly rng: () => number = Math.random) {}

  getProjectiles(): readonly Projectile[] {
    return this.projectiles;
  }

  hasProjectile(id: number): boolean {
    return this.projectiles.some((projectile) => projectile.id === id);
  }

  reset(): void {
    this.projectiles.length = 0;
  }

  /**
   * Fires a cannonball from alternating port/starboard guns. The return value
   * makes it easy for AI/input code to know whether the cooldown blocked it.
   */
  tryFire(
    ship: Ship,
    aimHeading: number,
    events: CombatEvent[],
    spread = 0,
  ): boolean {
    if (!ship.alive || ship.fireCooldownRemaining > 0.0001) return false;

    const safeAim = Number.isFinite(aimHeading) ? aimHeading : ship.heading;
    const side: 1 | -1 = ship.volleySide === 1 ? -1 : 1;
    ship.volleySide = side;

    const aim = safeAim + (this.rng() - 0.5) * spread * 2;
    const fx = Math.cos(aim);
    const fz = -Math.sin(aim);
    const rightX = -fz;
    const rightZ = fx;
    const x = ship.position.x + fx * 1.9 + rightX * side * 0.95;
    const z = ship.position.z + fz * 1.9 + rightZ * side * 0.95;
    const speed = ship.stats.projectileSpeed;

    this.projectiles.push({
      id: this.nextId,
      ownerId: ship.id,
      team: ship.team,
      x,
      z,
      vx: fx * speed + ship.forwardX * ship.speed * 0.3,
      vz: fz * speed + ship.forwardZ * ship.speed * 0.3,
      damage: ship.stats.cannonDamage,
      ttl: GAME_CONFIG.combat.projectileTtl,
      age: 0,
      radius: GAME_CONFIG.combat.projectileRadius,
    });
    this.nextId += 1;

    ship.fireCooldownRemaining = ship.stats.fireCooldown;
    events.push({
      type: 'fire',
      shipId: ship.id,
      team: ship.team,
      x,
      z,
      heading: aim,
      side,
    });
    return true;
  }

  update(ships: readonly Ship[], dt: number, events: CombatEvent[]): void {
    if (!Number.isFinite(dt) || dt <= 0) return;

    for (const ship of ships) {
      if (ship.alive && ship.fireCooldownRemaining > 0) {
        ship.fireCooldownRemaining = Math.max(0, ship.fireCooldownRemaining - dt);
      }
    }

    let writeIndex = 0;
    for (const projectile of this.projectiles) {
      projectile.ttl -= dt;
      projectile.age += dt;

      const previousX = projectile.x;
      const previousZ = projectile.z;
      projectile.x += projectile.vx * dt;
      projectile.z += projectile.vz * dt;

      let target: Ship | undefined;
      if (projectile.ttl > 0) {
        for (const ship of ships) {
          if (!ship.alive || ship.team === projectile.team) continue;
          const reach = ship.stats.hitRadius + projectile.radius;
          if (
            segmentCircleHit(
              previousX,
              previousZ,
              projectile.x,
              projectile.z,
              ship.position.x,
              ship.position.z,
              reach,
            )
          ) {
            target = ship;
            break;
          }
        }
      }

      if (target) {
        const damage = target.applyDamage(projectile.damage);
        events.push({
          type: 'hit',
          targetId: target.id,
          team: target.team,
          x: projectile.x,
          z: projectile.z,
          damage,
        });
        if (!target.alive) {
          events.push({
            type: 'sunk',
            shipId: target.id,
            team: target.team,
            x: target.position.x,
            z: target.position.z,
            coins: target.coinValue,
          });
        }
        continue;
      }

      if (projectile.ttl <= 0) continue;
      if (
        projectile.x * projectile.x + projectile.z * projectile.z >
        GAME_CONFIG.world.projectileLimit * GAME_CONFIG.world.projectileLimit
      ) {
        continue;
      }

      this.projectiles[writeIndex] = projectile;
      writeIndex += 1;
    }
    this.projectiles.length = writeIndex;
  }
}
