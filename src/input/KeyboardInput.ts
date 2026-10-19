export interface KeyboardHandlers {
  onPause: () => void;
  onDock: () => void;
}

export interface KeyboardState {
  throttle: number;
  steer: number;
  fire: boolean;
}

const GAME_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
]);

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
}

/** WASD / arrows / space plus single-press E (dock) and Esc/P (pause). */
export class KeyboardInput {
  private readonly pressed = new Set<string>();
  private enabled = true;

  constructor(private readonly handlers: KeyboardHandlers) {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.pressed.clear();
  }

  read(): KeyboardState {
    if (!this.enabled) return { throttle: 0, steer: 0, fire: false };
    const forward = this.pressed.has('KeyW') || this.pressed.has('ArrowUp');
    const backward = this.pressed.has('KeyS') || this.pressed.has('ArrowDown');
    const left = this.pressed.has('KeyA') || this.pressed.has('ArrowLeft');
    const right = this.pressed.has('KeyD') || this.pressed.has('ArrowRight');
    return {
      throttle: (forward ? 1 : 0) - (backward ? 1 : 0),
      steer: (left ? 1 : 0) - (right ? 1 : 0),
      fire: this.pressed.has('Space'),
    };
  }

  clear(): void {
    this.pressed.clear();
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    this.pressed.clear();
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (isTextEntry(event.target)) return;

    if (event.code === 'Escape' || event.code === 'KeyP') {
      if (!event.repeat) this.handlers.onPause();
      event.preventDefault();
      return;
    }

    if (event.code === 'KeyE') {
      if (!event.repeat) this.handlers.onDock();
      event.preventDefault();
      return;
    }

    if (!this.enabled) return;
    if (!GAME_KEYS.has(event.code)) return;
    event.preventDefault();
    this.pressed.add(event.code);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.pressed.delete(event.code);
  };

  private readonly handleBlur = (): void => {
    this.pressed.clear();
  };
}
