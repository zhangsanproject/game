import type { Team } from '../types';

/** Engine-independent cannonball state. Visuals are handled by the view layer. */
export interface Projectile {
  id: number;
  ownerId: string;
  team: Team;
  x: number;
  z: number;
  vx: number;
  vz: number;
  damage: number;
  ttl: number;
  age: number;
  radius: number;
}
