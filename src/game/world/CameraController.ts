import * as THREE from 'three';
import { GAME_CONFIG } from '../config';
import { clamp, damp } from '../math';
import type { Vec2 } from '../types';

/**
 * Oblique top-down chase camera with exponential smoothing, a speed-based FOV
 * boost and a small decaying shake on cannon impacts.
 */
export class CameraController {
  readonly camera: THREE.PerspectiveCamera;
  private readonly basePosition = new THREE.Vector3();
  private readonly desiredPosition = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();
  private readonly desiredLook = new THREE.Vector3();
  private shake = 0;
  private currentFov: number = GAME_CONFIG.camera.fov;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(
      GAME_CONFIG.camera.fov,
      aspect,
      GAME_CONFIG.camera.near,
      GAME_CONFIG.camera.far,
    );
    this.camera.position.set(0, 22, 0);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  addShake(amount: number): void {
    this.shake = Math.min(1.4, this.shake + amount);
  }

  snapTo(target: Vec2, heading: number): void {
    this.computeDesired(target, heading);
    this.basePosition.copy(this.desiredPosition);
    this.lookTarget.copy(this.desiredLook);
    this.camera.position.copy(this.basePosition);
    this.camera.lookAt(this.lookTarget);
  }

  update(
    dt: number,
    target: Vec2,
    heading: number,
    speedRatio: number,
  ): void {
    this.computeDesired(target, heading);

    const smoothing = 1 - Math.exp(-GAME_CONFIG.camera.damping * Math.min(dt, 0.1));
    this.basePosition.lerp(this.desiredPosition, smoothing);
    this.lookTarget.lerp(this.desiredLook, smoothing);

    this.camera.position.copy(this.basePosition);
    if (this.shake > 0.001) {
      const amplitude = this.shake * 0.55;
      this.camera.position.x += (Math.random() - 0.5) * amplitude;
      this.camera.position.y += (Math.random() - 0.5) * amplitude * 0.7;
      this.camera.position.z += (Math.random() - 0.5) * amplitude;
      this.shake *= Math.exp(-dt * 7);
    } else {
      this.shake = 0;
    }
    this.camera.lookAt(this.lookTarget);

    const targetFov =
      GAME_CONFIG.camera.fov +
      clamp(speedRatio, 0, 1) * GAME_CONFIG.camera.speedFovBoost;
    this.currentFov = damp(this.currentFov, targetFov, 3.2, dt);
    if (Math.abs(this.camera.fov - this.currentFov) > 0.015) {
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }
  }

  private computeDesired(target: Vec2, heading: number): void {
    const forwardX = Math.cos(heading);
    const forwardZ = -Math.sin(heading);
    // In a narrow portrait viewport, aim less far ahead so the ship sits closer
    // to the vertical centre and the bottom touch controls stay clear.
    const portrait = this.camera.aspect < 0.9;
    const lookAhead =
      GAME_CONFIG.camera.lookAhead * (portrait ? 0.8 : 1);
    this.desiredPosition.set(
      target.x - forwardX * GAME_CONFIG.camera.distance,
      GAME_CONFIG.camera.height,
      target.z - forwardZ * GAME_CONFIG.camera.distance,
    );
    this.desiredLook.set(
      target.x + forwardX * lookAhead,
      1.1,
      target.z + forwardZ * lookAhead,
    );
  }
}
