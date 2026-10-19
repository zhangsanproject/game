import { LOOP_CONFIG } from './config';
import type { Platform } from '../platform/Platform';

/** Exported for tests: reject negative/NaN deltas and clamp huge frame gaps. */
export function clampDelta(
  seconds: number,
  max: number = LOOP_CONFIG.maxDelta,
): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.min(seconds, Math.max(0, max));
}

/**
 * requestAnimationFrame loop supplied by the Platform. Rendering continues
 * while gameplay is paused; the Game decides whether to advance simulation.
 */
export class GameLoop {
  private handle: number | null = null;
  private lastTime: number | null = null;
  private running = false;

  constructor(
    private readonly platform: Platform,
    private readonly step: (dt: number) => void,
    private readonly render: () => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = null;
    this.handle = this.platform.requestFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    if (this.handle !== null) {
      this.platform.cancelFrame(this.handle);
      this.handle = null;
    }
    this.lastTime = null;
  }

  isRunning(): boolean {
    return this.running;
  }

  private readonly tick = (time: number): void => {
    if (!this.running) return;

    const previous = this.lastTime;
    this.lastTime = time;
    const dt = previous === null ? 0 : clampDelta((time - previous) / 1000);

    this.step(dt);
    this.render();

    if (!this.running) return;
    this.handle = this.platform.requestFrame(this.tick);
  };
}
