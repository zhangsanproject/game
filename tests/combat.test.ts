import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/game/config';
import { EnemyShip } from '../src/game/entities/EnemyShip';
import { PlayerShip } from '../src/game/entities/PlayerShip';
import {
  CombatSystem,
  type CombatEvent,
} from '../src/game/systems/CombatSystem';
import type { ShipStats } from '../src/game/types';

function makePlayer(overrides: Partial<ShipStats> = {}): PlayerShip {
  return new PlayerShip(
    { x: 0, z: 0 },
    0,
    { ...GAME_CONFIG.ship.player, ...overrides },
  );
}

function makeEnemy(x = 14): EnemyShip {
  return new EnemyShip(
    'enemy-1',
    '靶船',
    { x, z: 0 },
    Math.PI,
    GAME_CONFIG.ship.enemy,
    GAME_CONFIG.match.enemyCoinValue,
    1,
    0,
  );
}

function stepUntil(
  combat: CombatSystem,
  ships: (PlayerShip | EnemyShip)[],
  events: CombatEvent[],
  predicate: () => boolean,
): void {
  for (let i = 0; i < 240 && !predicate(); i += 1) {
    combat.update(ships, 1 / 60, events);
  }
}

describe('CombatSystem', () => {
  it('spawns one projectile, respects cooldown and damages the target', () => {
    const combat = new CombatSystem(() => 0.5);
    const player = makePlayer();
    const enemy = makeEnemy();
    const events: CombatEvent[] = [];

    expect(combat.tryFire(player, player.heading, events, 0)).toBe(true);
    expect(combat.getProjectiles()).toHaveLength(1);
    expect(combat.tryFire(player, player.heading, events, 0)).toBe(false);

    stepUntil(combat, [player, enemy], events, () => enemy.hp < enemy.maxHp);

    expect(enemy.hp).toBeCloseTo(
      GAME_CONFIG.ship.enemy.maxHp - GAME_CONFIG.ship.player.cannonDamage,
      5,
    );
    expect(player.hp).toBe(player.maxHp);
    expect(events.some((event) => event.type === 'hit')).toBe(true);
  });

  it('uses upgraded cannon damage', () => {
    const combat = new CombatSystem(() => 0.5);
    const player = makePlayer({ cannonDamage: 31 });
    const enemy = makeEnemy();
    const events: CombatEvent[] = [];

    combat.tryFire(player, 0, events, 0);
    stepUntil(combat, [player, enemy], events, () => enemy.hp < enemy.maxHp);

    expect(enemy.hp).toBeCloseTo(GAME_CONFIG.ship.enemy.maxHp - 31, 5);
  });

  it('emits a sunk event exactly once for a destroyed ship', () => {
    const combat = new CombatSystem(() => 0.5);
    const player = makePlayer();
    const enemy = makeEnemy();
    enemy.hp = 1;
    const events: CombatEvent[] = [];

    combat.tryFire(player, 0, events, 0);
    stepUntil(combat, [player, enemy], events, () => !enemy.alive);

    expect(enemy.alive).toBe(false);
    expect(events.filter((event) => event.type === 'sunk')).toHaveLength(1);

    player.fireCooldownRemaining = 0;
    combat.tryFire(player, 0, events, 0);
    for (let i = 0; i < 120; i += 1) {
      combat.update([player, enemy], 1 / 60, events);
    }
    expect(events.filter((event) => event.type === 'sunk')).toHaveLength(1);
  });

  it('recharges the cannon after the cooldown elapses', () => {
    const combat = new CombatSystem(() => 0.5);
    const player = makePlayer();
    const events: CombatEvent[] = [];

    expect(combat.tryFire(player, 0, events, 0)).toBe(true);
    expect(combat.tryFire(player, 0, events, 0)).toBe(false);
    combat.update([player], player.stats.fireCooldown + 0.05, events);
    expect(combat.tryFire(player, 0, events, 0)).toBe(true);
  });
});
