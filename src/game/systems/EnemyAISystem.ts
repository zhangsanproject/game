import { GAME_CONFIG } from '../config';
import { clamp, distanceTo, headingToPoint, normalizeAngle } from '../math';
import type { EnemyShip } from '../entities/EnemyShip';
import type { Ship } from '../entities/Ship';
import type { GridObstacle } from '../types';

export interface AIDecision {
  throttle: number;
  steer: number;
  fire: boolean;
  aimHeading: number;
}

/**
 * Simple, readable ship AI:
 * - close the distance while far away,
 * - settle into a broadside circle at medium range,
 * - back off if the player is almost touching,
 * - lead the player's velocity when firing,
 * - avoid the world edge and keep some distance from other enemies.
 *
 * It only returns intent; the actual physics/firing is handled by the systems.
 */
export class EnemyAISystem {
  constructor(private readonly rng: () => number = Math.random) {}

  decide(
    enemy: EnemyShip,
    player: Ship,
    enemies: readonly EnemyShip[],
    boundsRadius: number,
    obstacles: readonly GridObstacle[] = [],
  ): AIDecision {
    let desiredHeading = enemy.heading;
    let throttle = 0.6;
    let fire = false;
    let aimHeading = enemy.heading;

    if (!player.alive) {
      desiredHeading = normalizeAngle(enemy.heading + Math.sin(enemy.aiPhase) * 0.5);
      throttle = 0.3;
    } else {
      const distance = distanceTo(enemy.position, player.position);
      const toPlayer = headingToPoint(enemy.position, player.position);

      if (distance > GAME_CONFIG.ai.engageRange) {
        desiredHeading = toPlayer;
        throttle = 1;
      } else if (distance < GAME_CONFIG.ai.tooCloseRange) {
        desiredHeading = normalizeAngle(toPlayer + Math.PI);
        throttle = 0.82;
      } else {
        desiredHeading = normalizeAngle(
          toPlayer + enemy.preferredSide * (Math.PI / 2),
        );
        throttle = 0.62;
      }

      const distanceFromCenter = Math.hypot(enemy.position.x, enemy.position.z);
      if (distanceFromCenter > boundsRadius - 30) {
        desiredHeading = headingToPoint(enemy.position, { x: 0, z: 0 });
        throttle = Math.max(throttle, 0.78);
      }

      for (const obstacle of obstacles) {
        if (distanceTo(enemy.position, obstacle) < obstacle.radius + 12) {
          desiredHeading = headingToPoint(obstacle, enemy.position);
          throttle = Math.max(throttle, 0.7);
          break;
        }
      }

      const separation = this.separationHeading(enemy, enemies);
      if (separation !== null) {
        const delta = normalizeAngle(separation - desiredHeading);
        desiredHeading = normalizeAngle(desiredHeading + delta * 0.7);
        throttle = Math.max(throttle, 0.5);
      }

      if (
        distance <= enemy.stats.cannonRange &&
        distance > 5 &&
        enemy.fireCooldownRemaining <= 0.0001
      ) {
        const travel = (distance / enemy.stats.projectileSpeed) *
          GAME_CONFIG.ai.leadFactor;
        const targetX = player.position.x + player.velocityX * travel;
        const targetZ = player.position.z + player.velocityZ * travel;
        aimHeading = headingToPoint(enemy.position, { x: targetX, z: targetZ });
        fire = true;
      }
    }

    // Add a tiny amount of wander so parallel-running enemies do not stack.
    desiredHeading = normalizeAngle(
      desiredHeading +
        Math.sin(enemy.aiPhase + throttle * 3) * 0.04 +
        (this.rng() - 0.5) * 0.02,
    );

    const steer = clamp(
      normalizeAngle(desiredHeading - enemy.heading) * GAME_CONFIG.ai.turnGain,
      -1,
      1,
    );

    return { throttle, steer, fire, aimHeading };
  }

  private separationHeading(
    enemy: EnemyShip,
    enemies: readonly EnemyShip[],
  ): number | null {
    let pushX = 0;
    let pushZ = 0;
    const range = GAME_CONFIG.ai.separationRange;

    for (const other of enemies) {
      if (other === enemy || !other.alive) continue;
      const dx = enemy.position.x - other.position.x;
      const dz = enemy.position.z - other.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 0.001 && distance < range) {
        const strength = 1 - distance / range;
        pushX += (dx / distance) * strength;
        pushZ += (dz / distance) * strength;
      }
    }

    if (Math.hypot(pushX, pushZ) < 0.01) return null;
    return Math.atan2(-pushZ, pushX);
  }
}
