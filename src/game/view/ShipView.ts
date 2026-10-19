import * as THREE from 'three';
import { clamp } from '../math';
import type { Ship } from '../entities/Ship';
import type { ShipKind } from '../types';
import type { ShipAssets, ShipPalette } from './ShipAssets';

/**
 * Owns one procedurally built ship group and maps a pure Ship onto it. All
 * geometry/material references are shared through ShipAssets.
 */
export class ShipView {
  readonly group = new THREE.Group();
  private readonly phase = Math.random() * Math.PI * 2;
  private sinkTime = 0;

  constructor(
    private readonly scene: THREE.Scene,
    assets: ShipAssets,
    kind: ShipKind,
  ) {
    this.group.rotation.order = 'YXZ';
    this.group.scale.setScalar(kind === 'player' ? 1.04 : 1.0);
    this.build(assets, assets.geometries, kind === 'player' ? assets.player : assets.enemy);
    scene.add(this.group);
  }

  sync(ship: Ship, time: number, dt: number): void {
    if (ship.alive) {
      this.sinkTime = 0;
      this.group.visible = true;
      const speedRatio = clamp(
        Math.abs(ship.speed) / Math.max(0.001, ship.stats.maxSpeed),
        0,
        1,
      );
      this.group.position.set(
        ship.position.x,
        0.3 + Math.sin(time * 1.55 + this.phase) * 0.15,
        ship.position.z,
      );
      this.group.rotation.y = ship.heading;
      this.group.rotation.x = Math.sin(time * 1.15 + this.phase) * 0.014;
      this.group.rotation.z =
        Math.sin(time * 1.85 + this.phase * 1.3) * 0.026 -
        clamp(ship.intent.steer, -1, 1) * 0.06 * speedRatio;
      return;
    }

    this.sinkTime += Math.max(0, Math.min(dt, 0.1));
    const fall = Math.min(this.sinkTime, 3.6);
    this.group.position.set(ship.position.x, 0.3 - fall * 0.52, ship.position.z);
    this.group.rotation.y = ship.heading;
    this.group.rotation.z = Math.min(0.72, this.sinkTime * 0.32);
    this.group.rotation.x = Math.min(0.24, this.sinkTime * 0.09);
    if (this.sinkTime > 3.5) this.group.visible = false;
  }

  get finishedSinking(): boolean {
    return this.sinkTime > 3.5;
  }

  remove(): void {
    this.scene.remove(this.group);
    this.group.clear();
  }

  private build(
    assets: ShipAssets,
    geometries: ShipAssets['geometries'],
    palette: ShipPalette,
  ): void {
    const add = (
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      x: number,
      y: number,
      z: number,
      rotationX = 0,
      rotationY = 0,
      rotationZ = 0,
    ): THREE.Mesh => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.rotation.set(rotationX, rotationY, rotationZ);
      this.group.add(mesh);
      return mesh;
    };

    add(geometries.hull, palette.hull, 0, 0, 0);
    add(geometries.deck, palette.deck, 0.05, 0.64, 0);
    add(geometries.cabin, palette.deck, -1.15, 0.96, 0);
    add(geometries.cabinRoof, palette.dark, -1.15, 1.32, 0);
    add(geometries.mast, palette.dark, 0.35, 2.4, 0);
    add(geometries.yard, palette.dark, 0.42, 3.36, 0);

    add(geometries.sailMain, palette.sail, 0.48, 2.3, 0, 0, Math.PI / 2, 0);
    add(geometries.sailTop, palette.sail, 0.48, 3.82, 0, 0, Math.PI / 2, 0);
    add(geometries.sailBow, palette.sail, 1.67, 2.05, 0, 0, Math.PI / 2, 0);
    add(geometries.stripe, palette.accent, 0.5, 1.4, 0, 0, Math.PI / 2, 0);

    add(geometries.bowsprit, palette.dark, 2.35, 0.88, 0, 0, 0, 0.16);

    for (const x of [-0.85, 0, 0.85]) {
      add(geometries.cannon, palette.metal, x, 0.45, 0.84);
      add(geometries.cannon, palette.metal, x, 0.45, -0.84);
    }

    for (const x of [-1.2, -0.2, 0.8]) {
      add(geometries.rail, palette.dark, x, 0.9, 0.58);
      add(geometries.rail, palette.dark, x, 0.9, -0.58);
    }

    add(geometries.flagPole, palette.dark, -1.95, 1.55, 0);
    add(geometries.flag, palette.accent, -1.95, 2.24, 0.4, 0, Math.PI / 2, 0);
    add(geometries.lantern, palette.lamp, -1.72, 1.48, 0);

    // Shared assets are owned by ShipAssets; touching them here is only to make
    // the dependency explicit for future per-faction customization.
    void assets;
  }
}
