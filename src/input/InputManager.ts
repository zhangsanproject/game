import { clamp } from '../game/math';
import { KeyboardInput, type KeyboardHandlers } from './KeyboardInput';
import { TouchInput } from './TouchInput';

export interface InputSnapshot {
  throttle: number;
  steer: number;
  fire: boolean;
}

export interface TouchElements {
  joystick: HTMLElement;
  knob: HTMLElement;
  fireButton: HTMLElement;
}

/** Normalises keyboard and touch into one gameplay-neutral snapshot. */
export class InputManager {
  readonly keyboard: KeyboardInput;
  readonly touch: TouchInput;

  constructor(handlers: KeyboardHandlers, touchElements: TouchElements) {
    this.keyboard = new KeyboardInput(handlers);
    this.touch = new TouchInput(
      touchElements.joystick,
      touchElements.knob,
      touchElements.fireButton,
    );
  }

  read(): InputSnapshot {
    const keyboard = this.keyboard.read();
    const touch = this.touch.read();
    return {
      throttle: clamp(keyboard.throttle + touch.throttle, -1, 1),
      steer: clamp(keyboard.steer + touch.steer, -1, 1),
      fire: keyboard.fire || touch.fire,
    };
  }

  setActive(active: boolean): void {
    this.keyboard.setEnabled(active);
    if (!active) this.touch.reset();
  }

  reset(): void {
    this.keyboard.clear();
    this.touch.reset();
  }

  dispose(): void {
    this.keyboard.dispose();
    this.touch.dispose();
  }
}
