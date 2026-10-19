import { clamp } from '../game/math';

export interface TouchState {
  throttle: number;
  steer: number;
  fire: boolean;
}

/**
 * Floating virtual joystick + independent fire button. Uses Pointer Events so
 * a thumb can hold the stick while another finger fires. Each control owns its
 * own pointer id and pointer capture.
 */
export class TouchInput {
  private joystickPointerId: number | null = null;
  private firePointerId: number | null = null;
  private centerX = 0;
  private centerY = 0;
  private maxOffset = 40;
  private readonly joystickState = { x: 0, y: 0, throttle: 0, steer: 0 };
  private firing = false;

  constructor(
    private readonly joystick: HTMLElement,
    private readonly knob: HTMLElement,
    private readonly fireButton: HTMLElement,
  ) {
    this.joystick.addEventListener('pointerdown', this.handleJoystickDown);
    this.joystick.addEventListener('pointermove', this.handleJoystickMove);
    this.joystick.addEventListener('pointerup', this.handleJoystickUp);
    this.joystick.addEventListener('pointercancel', this.handleJoystickUp);
    this.joystick.addEventListener('lostpointercapture', this.handleJoystickUp);
    this.joystick.addEventListener('contextmenu', this.preventDefault);

    this.fireButton.addEventListener('pointerdown', this.handleFireDown);
    this.fireButton.addEventListener('pointerup', this.handleFireUp);
    this.fireButton.addEventListener('pointercancel', this.handleFireUp);
    this.fireButton.addEventListener('lostpointercapture', this.handleFireUp);
    this.fireButton.addEventListener('contextmenu', this.preventDefault);
  }

  read(): TouchState {
    return {
      throttle: this.joystickState.throttle,
      steer: this.joystickState.steer,
      fire: this.firing,
    };
  }

  reset(): void {
    this.joystickPointerId = null;
    this.firePointerId = null;
    this.firing = false;
    this.joystickState.x = 0;
    this.joystickState.y = 0;
    this.joystickState.throttle = 0;
    this.joystickState.steer = 0;
    this.knob.style.transform = 'translate(0px, 0px)';
  }

  dispose(): void {
    this.joystick.removeEventListener('pointerdown', this.handleJoystickDown);
    this.joystick.removeEventListener('pointermove', this.handleJoystickMove);
    this.joystick.removeEventListener('pointerup', this.handleJoystickUp);
    this.joystick.removeEventListener('pointercancel', this.handleJoystickUp);
    this.joystick.removeEventListener('lostpointercapture', this.handleJoystickUp);
    this.joystick.removeEventListener('contextmenu', this.preventDefault);
    this.fireButton.removeEventListener('pointerdown', this.handleFireDown);
    this.fireButton.removeEventListener('pointerup', this.handleFireUp);
    this.fireButton.removeEventListener('pointercancel', this.handleFireUp);
    this.fireButton.removeEventListener('lostpointercapture', this.handleFireUp);
    this.fireButton.removeEventListener('contextmenu', this.preventDefault);
  }

  private readonly preventDefault = (event: Event): void => {
    event.preventDefault();
  };

  private readonly handleJoystickDown = (event: PointerEvent): void => {
    if (this.joystickPointerId !== null) return;
    event.preventDefault();
    this.joystickPointerId = event.pointerId;
    this.joystick.setPointerCapture(event.pointerId);
    const rect = this.joystick.getBoundingClientRect();
    this.centerX = rect.left + rect.width / 2;
    this.centerY = rect.top + rect.height / 2;
    this.maxOffset = Math.max(24, rect.width * 0.32);
    this.updateJoystick(event.clientX, event.clientY);
  };

  private readonly handleJoystickMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.joystickPointerId) return;
    event.preventDefault();
    this.updateJoystick(event.clientX, event.clientY);
  };

  private readonly handleJoystickUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.joystickPointerId) return;
    this.joystickPointerId = null;
    this.joystickState.x = 0;
    this.joystickState.y = 0;
    this.joystickState.throttle = 0;
    this.joystickState.steer = 0;
    this.knob.style.transform = 'translate(0px, 0px)';
  };

  private updateJoystick(clientX: number, clientY: number): void {
    let dx = clientX - this.centerX;
    let dy = clientY - this.centerY;
    const length = Math.hypot(dx, dy);
    if (length > this.maxOffset) {
      const scale = this.maxOffset / length;
      dx *= scale;
      dy *= scale;
    }
    this.knob.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;

    let x = dx / this.maxOffset;
    let y = dy / this.maxOffset;
    const deadzone = 0.14;
    if (Math.abs(x) < deadzone) x = 0;
    if (Math.abs(y) < deadzone) y = 0;
    this.joystickState.x = x;
    this.joystickState.y = y;
    this.joystickState.throttle = clamp(-y, -1, 1);
    this.joystickState.steer = clamp(-x, -1, 1);
  }

  private readonly handleFireDown = (event: PointerEvent): void => {
    if (this.firePointerId !== null) return;
    event.preventDefault();
    this.firePointerId = event.pointerId;
    this.fireButton.setPointerCapture(event.pointerId);
    this.firing = true;
    this.fireButton.classList.add('is-held');
  };

  private readonly handleFireUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.firePointerId) return;
    this.firePointerId = null;
    this.firing = false;
    this.fireButton.classList.remove('is-held');
  };
}
