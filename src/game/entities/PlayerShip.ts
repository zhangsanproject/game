import { Ship } from './Ship';
import type { ShipStats, Vec2 } from '../types';

export class PlayerShip extends Ship {
  constructor(position: Vec2, heading: number, stats: ShipStats) {
    super({
      id: 'player',
      team: 'player',
      kind: 'player',
      name: '海风号',
      position,
      heading,
      stats,
    });
  }
}
