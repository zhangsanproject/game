import {
  ACESFilmicToneMapping,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import type {
  FrameCallback,
  Platform,
  ViewportSize,
} from '../Platform';
import type { StorageAdapter } from '../../save/Storage';
import { WebStorage } from './WebStorage';

/** First-stage Platform implementation for desktop and mobile browsers. */
export class WebPlatform implements Platform {
  readonly isTouch: boolean;
  readonly storage: StorageAdapter;

  private readonly disposers: Array<() => void> = [];

  constructor() {
    this.storage = new WebStorage();
    const coarsePointer =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches;
    const forcedTouch = new URLSearchParams(window.location.search).get('touch') === '1';
    this.isTouch = coarsePointer || forcedTouch;
  }

  now(): number {
    return performance.now();
  }

  requestFrame(callback: FrameCallback): number {
    return window.requestAnimationFrame(callback);
  }

  cancelFrame(handle: number): void {
    window.cancelAnimationFrame(handle);
  }

  getViewport(): ViewportSize {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: window.devicePixelRatio || 1,
    };
  }

  createRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
    try {
      const renderer = new WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
      renderer.outputColorSpace = SRGBColorSpace;
      renderer.toneMapping = ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.14;
      renderer.shadowMap.enabled = false;
      return renderer;
    } catch (error) {
      console.error('WebGL renderer creation failed', error);
      throw new Error(
        '无法初始化 WebGL。请确认浏览器已启用硬件加速，或换用支持 WebGL 的现代浏览器后重试。',
      );
    }
  }

  onResize(callback: (viewport: ViewportSize) => void): () => void {
    const handler = (): void => callback(this.getViewport());
    window.addEventListener('resize', handler);
    window.addEventListener('orientationchange', handler);
    const dispose = (): void => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('orientationchange', handler);
    };
    this.disposers.push(dispose);
    return dispose;
  }

  onVisibilityChange(callback: (hidden: boolean) => void): () => void {
    const handler = (): void => {
      callback(document.visibilityState === 'hidden');
    };
    document.addEventListener('visibilitychange', handler);
    const dispose = (): void => {
      document.removeEventListener('visibilitychange', handler);
    };
    this.disposers.push(dispose);
    return dispose;
  }

  dispose(): void {
    for (const dispose of this.disposers.splice(0)) dispose();
  }
}
