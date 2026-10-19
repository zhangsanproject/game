import { GAME_CONFIG } from '../config';
import { clamp, normalizeAngle } from '../math';
import type { Ship } from '../entities/Ship';
import type { GridObstacle } from '../types';

/**
 * Applies throttle/steering intent with acceleration, drag, a speed cap and a
 * speed-dependent turn rate. Kept independent from rendering.
 */
export class MovementSystem {
  update(ship: Ship, dt: number): void {
    if (!ship.alive || !Number.isFinite(dt) || dt <= 0) return;

    const { stats } = ship;
    const throttle = clamp(ship.intent.throttle, -1, 1);
    const steer = clamp(ship.intent.steer, -1, 1);
    const reverseMax = stats.maxSpeed * GAME_CONFIG.movement.reverseFactor;

    let targetSpeed = 0;
    if (throttle > 0) targetSpeed = throttle * stats.maxSpeed;
    else if (throttle < 0) targetSpeed = throttle * reverseMax;

    if (targetSpeed > ship.speed) {
      ship.speed = Math.min(targetSpeed, ship.speed + stats.acceleration * dt);
    } else if (targetSpeed < ship.speed) {
      const deceleration =
        stats.acceleration * (throttle === 0 ? 0.65 : GAME_CONFIG.movement.brakeFactor);
      ship.speed = Math.max(targetSpeed, ship.speed - deceleration * dt);
    }
    ship.speed = clamp(ship.speed, -reverseMax, stats.maxSpeed);
    if (Math.abs(ship.speed) < 0.005 && throttle === 0) ship.speed = 0;

    if (steer !== 0) {
      const speedRatio = clamp(Math.abs(ship.speed) / stats.maxSpeed, 0, 1);
      const efficiency =
        GAME_CONFIG.movement.minTurnFactor +
        (1 - GAME_CONFIG.movement.minTurnFactor) * speedRatio;
      const direction = ship.speed < -0.05 ? -1 : 1;
      ship.heading = normalizeAngle(
        ship.heading + steer * stats.turnRate * efficiency * direction * dt,
      );
    }

    if (ship.speed !== 0) {
      ship.position.x += ship.forwardX * ship.speed * dt;
      ship.position.z += ship.forwardZ * ship.speed * dt;
    }

    this.keepInsideWorld(ship);
  }

  private keepInsideWorld(ship: Ship): void {
    const limit = GAME_CONFIG.world.sailRadius;
    const distance = Math.hypot(ship.position.x, ship.position.z);
    if (distance <= limit || distance === 0) return;
    const scale = limit / distance;
    ship.position.x *= scale;
    ship.position.z *= scale;
    ship.speed *= 1 - GAME_CONFIG.movement.boundarySpeedLoss;
  }

  /** Softly pushes overlapping hulls apart. Does not deal collision damage. */
  resolveOverlaps(ships: readonly Ship[]): void {
    const minDistance = GAME_CONFIG.movement.shipSeparation;
    for (let i = 0; i < ships.length; i += 1) {
      const a = ships[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < ships.length; j += 1) {
        const b = ships[j];
        if (!b.alive) continue;
        const dx = b.position.x - a.position.x;
        const dz = b.position.z - a.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist >= minDistance) continue;
        const angle = dist > 0.001 ? Math.atan2(dz, dx) : 0;
        const overlap = (minDistance - dist) * 0.5;
        const ox = Math.cos(angle) * overlap;
        const oz = Math.sin(angle) * overlap;
        a.position.x -= ox;
        a.position.z -= oz;
        b.position.x += ox;
        b.position.z += oz;
      }
    }
  }

  resolveObstacles(ships: readonly Ship[], obstacles: readonly GridObstacle[]): void {
    for (const ship of ships) {
      if (!ship.alive) continue;
      for (const obstacle of obstacles) {
        const dx = ship.position.x - obstacle.x;
        const dz = ship.position.z - obstacle.z;
        const dist = Math.hypot(dx, dz);
        const minDistance = obstacle.radius + ship.stats.hitRadius;
        if (dist >= minDistance) continue;
        const angle = dist > 0.001 ? Math.atan2(dz, dx) : 0;
        ship.position.x = obstacle.x + Math.cos(angle) * minDistance;
        ship.position.z = obstacle.z + Math.sin(angle) * minDistance;
        ship.speed *= 0.55;
      }
    }
  }
}
