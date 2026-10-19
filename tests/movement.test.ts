import { describe, expect, it } from 'vitest';
import { GAME_CONFIG, LOOP_CONFIG } from '../src/game/config';
import { Ship } from '../src/game/entities/Ship';
import { clampDelta } from '../src/game/GameLoop';
import { MovementSystem } from '../src/game/systems/MovementSystem';
import type { ShipStats } from '../src/game/types';

function makeShip(overrides: Partial<ShipStats> = {}): Ship {
  const stats: ShipStats = { ...GAME_CONFIG.ship.player, ...overrides };
  return new Ship({
    id: 'test-ship',
    team: 'player',
    kind: 'player',
    name: '测试船',
    position: { x: 0, z: 0 },
    heading: 0,
    stats,
  });
}

function simulate(
  system: MovementSystem,
  ship: Ship,
  seconds: number,
  dt = 1 / 60,
): void {
  const steps = Math.ceil(seconds / dt);
  for (let i = 0; i < steps; i += 1) system.update(ship, dt);
}

describe('MovementSystem', () => {
  it('accelerates gradually and never exceeds the speed cap', () => {
    const system = new MovementSystem();
    const ship = makeShip();
    ship.intent.throttle = 1;

    system.update(ship, 0.05);
    expect(ship.speed).toBeGreaterThan(0);
    expect(ship.speed).toBeLessThan(GAME_CONFIG.ship.player.maxSpeed);

    // 6 seconds at full throttle stays well inside the circular world bound.
    for (let i = 0; i < 120; i += 1) system.update(ship, 0.05);
    expect(ship.speed).toBeCloseTo(GAME_CONFIG.ship.player.maxSpeed, 5);
    expect(ship.speed).toBeLessThanOrEqual(GAME_CONFIG.ship.player.maxSpeed + 1e-9);
    expect(ship.position.x).toBeGreaterThan(0);
  });

  it('coasts down with inertia instead of stopping instantly', () => {
    const system = new MovementSystem();
    const ship = makeShip();
    ship.speed = 10;
    system.update(ship, 0.05);
    expect(ship.speed).toBeLessThan(10);
    expect(ship.speed).toBeGreaterThan(8);

    simulate(system, ship, 6, 0.05);
    expect(ship.speed).toBe(0);
  });

  it('caps reverse speed separately', () => {
    const system = new MovementSystem();
    const ship = makeShip();
    ship.intent.throttle = -1;
    for (let i = 0; i < 200; i += 1) system.update(ship, 0.05);

    const reverseCap =
      GAME_CONFIG.ship.player.maxSpeed * GAME_CONFIG.movement.reverseFactor;
    expect(ship.speed).toBeCloseTo(-reverseCap, 5);
    expect(Math.abs(ship.speed)).toBeLessThan(GAME_CONFIG.ship.player.maxSpeed);
  });

  it('turns more sharply at speed, but still responds while nearly stopped', () => {
    const system = new MovementSystem();

    const slow = makeShip();
    slow.intent.steer = 1;
    system.update(slow, 0.05);
    const slowTurn = Math.abs(slow.heading);

    const fast = makeShip();
    fast.speed = fast.stats.maxSpeed;
    fast.intent.steer = 1;
    system.update(fast, 0.05);
    const fastTurn = Math.abs(fast.heading);

    expect(slowTurn).toBeGreaterThan(0);
    expect(fastTurn).toBeGreaterThan(slowTurn);
    expect(fastTurn).toBeLessThan(Math.PI / 2);
  });

  it('clamps abnormal frame gaps before simulation', () => {
    expect(clampDelta(5)).toBeCloseTo(LOOP_CONFIG.maxDelta);
    expect(clampDelta(0.016)).toBeCloseTo(0.016);
    expect(clampDelta(-1)).toBe(0);
    expect(clampDelta(Number.NaN)).toBe(0);
  });
});
