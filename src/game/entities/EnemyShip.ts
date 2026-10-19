import { Ship } from './Ship';
import type { ShipStats, Vec2 } from '../types';

export class EnemyShip extends Ship {
  /** Which side the AI prefers to keep toward the player (broadside). */
  readonly preferredSide: 1 | -1;
  readonly aiPhase: number;

  constructor(
    id: string,
    name: string,
    position: Vec2,
    heading: number,
    stats: ShipStats,
    coinValue: number,
    preferredSide: 1 | -1,
    aiPhase: number,
  ) {
    super({
      id,
      team: 'enemy',
      kind: 'enemy',
      name,
      position,
      heading,
      stats,
      coinValue,
    });
    this.preferredSide = preferredSide;
    this.aiPhase = aiPhase;
  }
}
