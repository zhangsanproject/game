import { describe, expect, it } from 'vitest';
import { RewardSystem } from '../src/game/systems/RewardSystem';

describe('RewardSystem', () => {
  it('rewards each sunk ship exactly once', () => {
    const rewards = new RewardSystem();

    expect(rewards.registerSunk('enemy-1', 25)).toBe(25);
    expect(rewards.registerSunk('enemy-1', 25)).toBe(0);
    expect(rewards.registerSunk('enemy-1', 99)).toBe(0);
    expect(rewards.wasRewarded('enemy-1')).toBe(true);

    expect(rewards.registerSunk('enemy-2', 25)).toBe(25);
    expect(rewards.registerSunk('enemy-2', 25)).toBe(0);
  });

  it('rejects invalid reward values but still records the sink', () => {
    const rewards = new RewardSystem();
    expect(rewards.registerSunk('enemy-bad', Number.NaN)).toBe(0);
    expect(rewards.registerSunk('enemy-bad', 10)).toBe(0);
    expect(rewards.wasRewarded('enemy-bad')).toBe(true);
  });

  it('forgets rewards on session reset', () => {
    const rewards = new RewardSystem();
    expect(rewards.registerSunk('enemy-1', 25)).toBe(25);
    rewards.reset();
    expect(rewards.wasRewarded('enemy-1')).toBe(false);
    expect(rewards.registerSunk('enemy-1', 25)).toBe(25);
  });
});
