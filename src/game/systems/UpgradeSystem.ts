import { GAME_CONFIG, UPGRADE_CONFIG } from '../config';
import type { SaveData } from '../../save/SaveData';
import type { ShipStats, UpgradeType } from '../types';

export type PurchaseFailure = 'insufficient-coins' | 'max-level';

export interface PurchaseResult {
  success: boolean;
  reason?: PurchaseFailure;
  cost: number;
  newLevel: number;
}

export function getUpgradeCost(type: UpgradeType, currentLevel: number): number {
  const definition = UPGRADE_CONFIG.items[type];
  const level = Math.max(0, Math.min(UPGRADE_CONFIG.maxLevel, Math.floor(currentLevel)));
  return Math.round(definition.baseCost * Math.pow(definition.costGrowth, level));
}

/** Mutates the save data only when the purchase succeeds. */
export function purchaseUpgrade(save: SaveData, type: UpgradeType): PurchaseResult {
  const currentLevel = save.upgrades[type];
  if (currentLevel >= UPGRADE_CONFIG.maxLevel) {
    return {
      success: false,
      reason: 'max-level',
      cost: 0,
      newLevel: currentLevel,
    };
  }

  const cost = getUpgradeCost(type, currentLevel);
  if (save.coins < cost) {
    return {
      success: false,
      reason: 'insufficient-coins',
      cost,
      newLevel: currentLevel,
    };
  }

  save.coins -= cost;
  save.upgrades[type] = currentLevel + 1;
  return {
    success: true,
    cost,
    newLevel: currentLevel + 1,
  };
}

/** Derives runtime ship stats from persistent upgrade levels. */
export function buildPlayerStats(
  levels: SaveData['upgrades'],
  base: ShipStats = GAME_CONFIG.ship.player,
): ShipStats {
  const { items } = UPGRADE_CONFIG;
  return {
    ...base,
    maxHp: base.maxHp + levels.hull * items.hull.statPerLevel,
    maxSpeed: base.maxSpeed + levels.speed * items.speed.statPerLevel,
    acceleration:
      base.acceleration +
      levels.speed * (items.speed.secondaryPerLevel ?? 0),
    cannonDamage: base.cannonDamage + levels.damage * items.damage.statPerLevel,
  };
}
