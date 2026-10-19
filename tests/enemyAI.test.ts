import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/game/config';
import { EnemyShip } from '../src/game/entities/EnemyShip';
import { PlayerShip } from '../src/game/entities/PlayerShip';
import { EnemyAISystem } from '../src/game/systems/EnemyAISystem';

function setup(distance: number): {
  player: PlayerShip;
  enemy: EnemyShip;
  ai: EnemyAISystem;
} {
  const player = new PlayerShip(
    { x: distance, z: 0 },
    0,
    GAME_CONFIG.ship.player,
  );
  const enemy = new EnemyShip(
    'enemy-1',
    '赤帆 1',
    { x: 0, z: 0 },
    0,
    GAME_CONFIG.ship.enemy,
    GAME_CONFIG.match.enemyCoinValue,
    1,
    0,
  );
  return { player, enemy, ai: new EnemyAISystem(() => 0.5) };
}

describe('EnemyAISystem', () => {
  it('closes distance when far away', () => {
    const { player, enemy, ai } = setup(120);
    const decision = ai.decide(enemy, player, [enemy], GAME_CONFIG.world.sailRadius);

    expect(decision.throttle).toBeGreaterThan(0.8);
    expect(decision.fire).toBe(false);
    expect(Number.isFinite(decision.steer)).toBe(true);
  });

  it('fires when the player is inside cannon range and the cooldown is ready', () => {
    const { player, enemy, ai } = setup(24);
    enemy.fireCooldownRemaining = 0;
    const decision = ai.decide(enemy, player, [enemy], GAME_CONFIG.world.sailRadius);

    expect(decision.fire).toBe(true);
    expect(Number.isFinite(decision.aimHeading)).toBe(true);
    expect(Math.abs(decision.throttle)).toBeLessThanOrEqual(1);
    expect(Math.abs(decision.steer)).toBeLessThanOrEqual(1);
  });

  it('does not fire during its cooldown', () => {
    const { player, enemy, ai } = setup(24);
    enemy.fireCooldownRemaining = 2;
    const decision = ai.decide(enemy, player, [enemy], GAME_CONFIG.world.sailRadius);
    expect(decision.fire).toBe(false);
  });
});
