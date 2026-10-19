import { describe, expect, it } from 'vitest';
import { GAME_CONFIG, UPGRADE_CONFIG } from '../src/game/config';
import {
  buildPlayerStats,
  getUpgradeCost,
  purchaseUpgrade,
} from '../src/game/systems/UpgradeSystem';
import { createDefaultSave } from '../src/save/SaveData';

describe('upgrade system', () => {
  it('deducts coins and increments exactly one level', () => {
    const save = createDefaultSave();
    save.coins = 100;
    const cost = getUpgradeCost('hull', 0);

    const result = purchaseUpgrade(save, 'hull');

    expect(result.success).toBe(true);
    expect(result.cost).toBe(cost);
    expect(save.coins).toBe(100 - cost);
    expect(save.upgrades.hull).toBe(1);
    expect(save.upgrades.speed).toBe(0);
    expect(save.upgrades.damage).toBe(0);
  });

  it('does not spend coins when funds are insufficient', () => {
    const save = createDefaultSave();
    save.coins = 3;
    const cost = getUpgradeCost('damage', 0);

    const result = purchaseUpgrade(save, 'damage');

    expect(result.success).toBe(false);
    expect(result.reason).toBe('insufficient-coins');
    expect(result.cost).toBe(cost);
    expect(save.coins).toBe(3);
    expect(save.upgrades.damage).toBe(0);
  });

  it('refuses to buy beyond the maximum level', () => {
    const save = createDefaultSave();
    save.coins = 999_999;
    save.upgrades.hull = UPGRADE_CONFIG.maxLevel;

    const result = purchaseUpgrade(save, 'hull');

    expect(result.success).toBe(false);
    expect(result.reason).toBe('max-level');
    expect(save.coins).toBe(999_999);
    expect(save.upgrades.hull).toBe(UPGRADE_CONFIG.maxLevel);
  });

  it('derives stronger ship stats from upgrade levels', () => {
    const base = buildPlayerStats(createDefaultSave().upgrades);
    expect(base.maxHp).toBe(GAME_CONFIG.ship.player.maxHp);
    expect(base.maxSpeed).toBe(GAME_CONFIG.ship.player.maxSpeed);
    expect(base.cannonDamage).toBe(GAME_CONFIG.ship.player.cannonDamage);

    const upgraded = buildPlayerStats({ hull: 2, speed: 2, damage: 3 });
    expect(upgraded.maxHp).toBe(
      GAME_CONFIG.ship.player.maxHp +
        2 * UPGRADE_CONFIG.items.hull.statPerLevel,
    );
    expect(upgraded.maxSpeed).toBeCloseTo(
      GAME_CONFIG.ship.player.maxSpeed +
        2 * UPGRADE_CONFIG.items.speed.statPerLevel,
      5,
    );
    expect(upgraded.acceleration).toBeCloseTo(
      GAME_CONFIG.ship.player.acceleration +
        2 * (UPGRADE_CONFIG.items.speed.secondaryPerLevel ?? 0),
      5,
    );
    expect(upgraded.cannonDamage).toBe(
      GAME_CONFIG.ship.player.cannonDamage +
        3 * UPGRADE_CONFIG.items.damage.statPerLevel,
    );
  });

  it('scales costs by level', () => {
    expect(getUpgradeCost('hull', 1)).toBeGreaterThan(
      getUpgradeCost('hull', 0),
    );
    expect(getUpgradeCost('hull', 2)).toBeGreaterThan(
      getUpgradeCost('hull', 1),
    );
  });
});
