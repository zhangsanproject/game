/**
 * Guarantees that each sunk enemy pays out exactly once, even if the combat
 * event is delivered more than once in a frame. Session-scoped on purpose.
 */
export class RewardSystem {
  private readonly rewardedShipIds = new Set<string>();

  /** Returns the coins granted (0 when a duplicate sink is reported). */
  registerSunk(shipId: string, coins: number): number {
    if (this.rewardedShipIds.has(shipId)) return 0;
    this.rewardedShipIds.add(shipId);
    if (!Number.isFinite(coins) || coins <= 0) return 0;
    return Math.round(coins);
  }

  wasRewarded(shipId: string): boolean {
    return this.rewardedShipIds.has(shipId);
  }

  reset(): void {
    this.rewardedShipIds.clear();
  }
}
