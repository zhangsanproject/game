import type { WebGLRenderer } from 'three';
import type { StorageAdapter } from '../save/Storage';

export interface ViewportSize {
  width: number;
  height: number;
  dpr: number;
}

export type FrameCallback = (time: number) => void;

/**
 * Browser/runtime capabilities injected into the game. The simulation never
 * touches window, document or localStorage directly; a future Douyin mini-game
 * host only needs to provide another implementation of this interface.
 */
export interface Platform {
  readonly isTouch: boolean;
  readonly storage: StorageAdapter;

  now(): number;
  requestFrame(callback: FrameCallback): number;
  cancelFrame(handle: number): void;
  getViewport(): ViewportSize;

  createRenderer(canvas: HTMLCanvasElement): WebGLRenderer;

  onResize(callback: (viewport: ViewportSize) => void): () => void;
  onVisibilityChange(callback: (hidden: boolean) => void): () => void;

  dispose(): void;
}
