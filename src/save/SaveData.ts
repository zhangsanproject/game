import { SAVE_CONFIG, UPGRADE_CONFIG } from '../game/config';
import type { UpgradeType } from '../game/types';

export const UPGRADE_TYPES: readonly UpgradeType[] = ['hull', 'speed', 'damage'];

export interface UpgradeLevels {
  hull: number;
  speed: number;
  damage: number;
}

export interface SaveData {
  version: number;
  coins: number;
  upgrades: UpgradeLevels;
  /** Lifetime enemies sunk, useful for future achievements. */
  totalSunk: number;
}

export function createDefaultSave(): SaveData {
  return {
    version: SAVE_CONFIG.version,
    coins: 0,
    upgrades: { hull: 0, speed: 0, damage: 0 },
    totalSunk: 0,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizedInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

/**
 * Never throws. Unknown/older/future save versions and malformed fields fall
 * back to safe defaults so a corrupted localStorage blob cannot brick the game.
 */
export function sanitizeSaveData(raw: unknown): SaveData {
  if (!isRecord(raw)) return createDefaultSave();
  if (raw.version !== SAVE_CONFIG.version) return createDefaultSave();

  const rawUpgrades = isRecord(raw.upgrades) ? raw.upgrades : {};
  const levels = {} as UpgradeLevels;
  for (const type of UPGRADE_TYPES) {
    levels[type] = sanitizedInteger(
      rawUpgrades[type],
      0,
      0,
      UPGRADE_CONFIG.maxLevel,
    );
  }

  return {
    version: SAVE_CONFIG.version,
    coins: sanitizedInteger(raw.coins, 0, 0, 9_999_999),
    upgrades: levels,
    totalSunk: sanitizedInteger(raw.totalSunk, 0, 0, 9_999_999),
  };
}
