/**
 * Central tuning values. Keep this module free of DOM / Three.js imports so the
 * simulation, save layer and unit tests can all share it.
 */

import type { UpgradeType } from './types';

export const GAME_CONFIG = {
  world: {
    seaSize: 760,
    sailRadius: 235,
    projectileLimit: 340,
    fogColor: 0xb8e3e7,
    fogDensity: 0.0027,
    sunDirection: { x: -0.36, y: 0.73, z: -0.57 },
  },

  harbor: {
    center: { x: 0, z: 88 },
    dockPoint: { x: 0, z: 45 },
    dockRadius: 20,
    shoreRadius: 24,
    shelfRadius: 50,
    avoidRadius: 24,
  },

  /**
   * Decorative tropical islands. The first four entries (harbor + these three)
   * are also fed to the sea shader to render turquoise shelves and shore foam.
   */
  decorativeIslands: [
    { id: 'west', x: -84, z: 48, shoreRadius: 18, shelfRadius: 38, height: 1.0 },
    { id: 'east', x: 100, z: 2, shoreRadius: 22, shelfRadius: 44, height: 1.25 },
    { id: 'south', x: 28, z: -128, shoreRadius: 15, shelfRadius: 32, height: 0.9 },
  ],

  playerSpawn: {
    x: 0,
    z: 18,
    heading: -Math.PI / 2, // faces +Z, toward the harbor at spawn
  },

  match: {
    killTarget: 5,
    killTargetStep: 5,
    initialEnemies: 2,
    maxActiveEnemies: 3,
    spawnInterval: 7.5,
    enemyCoinValue: 25,
    minSpawnDistance: 70,
    maxSpawnDistance: 115,
    minEnemySeparation: 18,
    minSpawnDistanceFromHarbor: 58,
  },

  ship: {
    player: {
      maxHp: 100,
      maxSpeed: 16,
      acceleration: 6.8,
      turnRate: 1.05,
      hitRadius: 2.4,
      cannonDamage: 22,
      fireCooldown: 0.85,
      projectileSpeed: 34,
      cannonRange: 45,
    },
    enemy: {
      maxHp: 66,
      maxSpeed: 11.5,
      acceleration: 4.2,
      turnRate: 0.72,
      hitRadius: 2.3,
      cannonDamage: 7,
      fireCooldown: 2.8,
      projectileSpeed: 27,
      cannonRange: 38,
    },
  },

  movement: {
    reverseFactor: 0.35,
    brakeFactor: 0.9,
    minTurnFactor: 0.28,
    boundarySpeedLoss: 0.45,
    shipSeparation: 5.4,
  },

  combat: {
    projectileTtl: 2.4,
    projectileRadius: 0.3,
    playerSpread: 0.018,
    enemySpread: 0.06,
  },

  ai: {
    engageRange: 32,
    tooCloseRange: 10,
    turnGain: 1.8,
    leadFactor: 0.72,
    separationRange: 9,
  },

  camera: {
    fov: 50,
    near: 0.1,
    far: 1200,
    height: 35,
    distance: 22,
    lookAhead: 5.5,
    damping: 4.5,
    speedFovBoost: 3,
  },
} as const;

export interface UpgradeDefinition {
  name: string;
  tagline: string;
  description: string;
  baseCost: number;
  costGrowth: number;
  statPerLevel: number;
  secondaryPerLevel?: number;
}

export const UPGRADE_CONFIG: {
  maxLevel: number;
  items: Record<UpgradeType, UpgradeDefinition>;
} = {
  maxLevel: 5,
  items: {
    hull: {
      name: '船体耐久',
      tagline: 'HULL',
      description: '最大船体 +25，入港修理免费。',
      baseCost: 35,
      costGrowth: 1.7,
      statPerLevel: 25,
    },
    speed: {
      name: '航速强化',
      tagline: 'SPEED',
      description: '提升最高航速，并让加速响应更灵敏。',
      baseCost: 45,
      costGrowth: 1.7,
      statPerLevel: 1.4,
      secondaryPerLevel: 0.35,
    },
    damage: {
      name: '火炮伤害',
      tagline: 'CANNON',
      description: '每发炮弹伤害 +6。',
      baseCost: 40,
      costGrowth: 1.75,
      statPerLevel: 6,
    },
  },
};

export const SAVE_CONFIG = {
  key: 'age-of-wind-web-save',
  version: 1,
} as const;

export const LOOP_CONFIG = {
  /** Never simulate more than 50 ms in a single frame. */
  maxDelta: 0.05,
} as const;
