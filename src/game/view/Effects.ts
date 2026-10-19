import * as THREE from 'three';
import { clamp, lerp, TAU } from '../math';

interface EffectItem {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  life: number;
  duration: number;
  vx: number;
  vy: number;
  vz: number;
  gravity: number;
  scaleStart: number;
  scaleEnd: number;
  opacityStart: number;
  spin: number;
  stretchX: number;
  stretchZ: number;
}

interface SpawnOptions {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  life: number;
  scaleStart: number;
  scaleEnd: number;
  opacity: number;
  gravity?: number;
  spin?: number;
  stretchX?: number;
  stretchZ?: number;
  rotationY?: number;
}

/**
 * A fixed-capacity particle pool. Each pool owns one shared geometry and a
 * material per slot (needed because opacity differs per particle). Slots are
 * re-used round-robin, so effects can never accumulate without bound.
 */
function createFoamTexture(): THREE.DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = ((x + 0.5) / size) * 2 - 1;
      const ny = ((y + 0.5) / size) * 2 - 1;
      const radius = Math.hypot(nx, ny);
      let alpha = Math.pow(Math.max(0, 1 - radius), 1.5);
      const noise =
        0.7 +
        0.3 * Math.sin(x * 1.31 + y * 2.17) * Math.sin(x * 0.73 - y * 1.87);
      alpha *= 0.55 + 0.45 * noise;
      const index = (y * size + x) * 4;
      data[index] = 255;
      data[index + 1] = 255;
      data[index + 2] = 255;
      data[index + 3] = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
    }
  }
  const texture = new THREE.DataTexture(
    data,
    size,
    size,
    THREE.RGBAFormat,
  );
  texture.needsUpdate = true;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

class MeshEffectPool {
  private readonly items: EffectItem[] = [];
  private cursor = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly geometry: THREE.BufferGeometry,
    color: number,
    count: number,
    additive: boolean,
    private readonly texture?: THREE.Texture,
  ) {
    for (let i = 0; i < count; i += 1) {
      const material = new THREE.MeshBasicMaterial({
        color,
        map: texture ?? null,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      this.items.push({
        mesh,
        material,
        life: 0,
        duration: 1,
        vx: 0,
        vy: 0,
        vz: 0,
        gravity: 0,
        scaleStart: 1,
        scaleEnd: 1,
        opacityStart: 1,
        spin: 0,
        stretchX: 1,
        stretchZ: 1,
      });
    }
  }

  spawn(options: SpawnOptions): void {
    if (this.items.length === 0) return;
    const item = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.items.length;

    item.life = options.life;
    item.duration = Math.max(0.001, options.life);
    item.vx = options.vx ?? 0;
    item.vy = options.vy ?? 0;
    item.vz = options.vz ?? 0;
    item.gravity = options.gravity ?? 0;
    item.scaleStart = options.scaleStart;
    item.scaleEnd = options.scaleEnd;
    item.opacityStart = options.opacity;
    item.spin = options.spin ?? 0;
    item.stretchX = options.stretchX ?? 1;
    item.stretchZ = options.stretchZ ?? 1;

    item.mesh.visible = true;
    item.mesh.position.set(options.x, options.y, options.z);
    item.mesh.scale.setScalar(options.scaleStart);
    item.mesh.rotation.y = options.rotationY ?? Math.random() * TAU;
    item.material.opacity = options.opacity;
  }

  update(dt: number): void {
    for (const item of this.items) {
      if (!item.mesh.visible) continue;
      item.life -= dt;
      if (item.life <= 0) {
        item.mesh.visible = false;
        continue;
      }
      const age = clamp(1 - item.life / item.duration, 0, 1);
      item.vy -= item.gravity * dt;
      item.mesh.position.x += item.vx * dt;
      item.mesh.position.y += item.vy * dt;
      item.mesh.position.z += item.vz * dt;
      const scale = Math.max(0.001, lerp(item.scaleStart, item.scaleEnd, age));
      item.mesh.scale.set(
        scale * item.stretchX,
        scale,
        scale * item.stretchZ,
      );
      item.material.opacity = item.opacityStart * (1 - age);
      item.mesh.rotation.y += item.spin * dt;
    }
  }

  reset(): void {
    for (const item of this.items) {
      item.mesh.visible = false;
      item.material.opacity = 0;
    }
  }

  dispose(): void {
    for (const item of this.items) {
      this.scene.remove(item.mesh);
      item.material.dispose();
    }
    this.items.length = 0;
    this.geometry.dispose();
    this.texture?.dispose();
  }
}

/** All transient combat feedback: muzzle flashes, splashes, smoke and wakes. */
export class EffectsSystem {
  private readonly splash: MeshEffectPool;
  private readonly wakePool: MeshEffectPool;
  private readonly smoke: MeshEffectPool;
  private readonly spark: MeshEffectPool;
  private readonly flash: MeshEffectPool;

  constructor(scene: THREE.Scene) {
    const splashGeometry = new THREE.RingGeometry(0.5, 0.82, 18);
    splashGeometry.rotateX(-Math.PI / 2);
    const wakeGeometry = new THREE.PlaneGeometry(2, 2);
    wakeGeometry.rotateX(-Math.PI / 2);

    this.splash = new MeshEffectPool(scene, splashGeometry, 0xdff7ff, 26, false);
    this.wakePool = new MeshEffectPool(
      scene,
      wakeGeometry,
      0xffffff,
      170,
      false,
      createFoamTexture(),
    );
    this.smoke = new MeshEffectPool(
      scene,
      new THREE.SphereGeometry(0.36, 5, 4),
      0x95a7ab,
      64,
      false,
    );
    this.spark = new MeshEffectPool(
      scene,
      new THREE.SphereGeometry(0.14, 4, 3),
      0xffb85c,
      52,
      true,
    );
    this.flash = new MeshEffectPool(
      scene,
      new THREE.SphereGeometry(0.42, 6, 4),
      0xffe4a3,
      18,
      true,
    );
  }

  update(dt: number): void {
    this.splash.update(dt);
    this.wakePool.update(dt);
    this.smoke.update(dt);
    this.spark.update(dt);
    this.flash.update(dt);
  }

  cannonMuzzle(x: number, z: number, heading: number, side: 1 | -1): void {
    const rightX = Math.sin(heading) * side;
    const rightZ = Math.cos(heading) * side;
    this.flash.spawn({
      x,
      y: 1.15,
      z,
      vx: rightX * 1.8,
      vy: 0.35,
      vz: rightZ * 1.8,
      life: 0.17,
      scaleStart: 0.55,
      scaleEnd: 1.65,
      opacity: 0.95,
    });
    this.smoke.spawn({
      x: x + rightX * 0.3,
      y: 1.25,
      z: z + rightZ * 0.3,
      vx: rightX * 0.9,
      vy: 0.5,
      vz: rightZ * 0.9,
      life: 0.75,
      scaleStart: 0.4,
      scaleEnd: 1.6,
      opacity: 0.32,
      gravity: -0.3,
    });
    for (let i = 0; i < 2; i += 1) {
      this.spark.spawn({
        x,
        y: 1.2,
        z,
        vx: rightX * (2 + Math.random() * 2) + (Math.random() - 0.5),
        vy: 1 + Math.random() * 1.5,
        vz: rightZ * (2 + Math.random() * 2) + (Math.random() - 0.5),
        life: 0.2 + Math.random() * 0.15,
        scaleStart: 0.7,
        scaleEnd: 0.15,
        opacity: 0.95,
        gravity: 7,
      });
    }
  }

  cannonTrail(x: number, y: number, z: number): void {
    this.smoke.spawn({
      x,
      y,
      z,
      vy: 0.15,
      life: 0.5,
      scaleStart: 0.22,
      scaleEnd: 0.95,
      opacity: 0.2,
    });
  }

  impact(x: number, z: number): void {
    this.splash.spawn({
      x,
      y: 0.15,
      z,
      life: 0.55,
      scaleStart: 0.7,
      scaleEnd: 3.0,
      opacity: 0.6,
    });
    for (let i = 0; i < 6; i += 1) {
      const angle = Math.random() * TAU;
      const speed = 1.5 + Math.random() * 3.5;
      this.spark.spawn({
        x,
        y: 1.0,
        z,
        vx: Math.cos(angle) * speed,
        vy: 1.2 + Math.random() * 2.4,
        vz: Math.sin(angle) * speed,
        life: 0.3 + Math.random() * 0.3,
        scaleStart: 0.85,
        scaleEnd: 0.15,
        opacity: 1,
        gravity: 8,
      });
    }
    for (let i = 0; i < 3; i += 1) {
      this.smoke.spawn({
        x: x + (Math.random() - 0.5) * 1.2,
        y: 1.0 + Math.random() * 0.7,
        z: z + (Math.random() - 0.5) * 1.2,
        vx: (Math.random() - 0.5) * 1.2,
        vy: 0.7 + Math.random() * 0.7,
        vz: (Math.random() - 0.5) * 1.2,
        life: 0.9 + Math.random() * 0.5,
        scaleStart: 0.5,
        scaleEnd: 2.2,
        opacity: 0.34,
        gravity: -0.2,
      });
    }
  }

  wake(x: number, z: number, heading: number, strength: number): void {
    const rightX = Math.sin(heading);
    const rightZ = Math.cos(heading);
    for (const side of [-1, 1]) {
      this.wakePool.spawn({
        x: x + rightX * side * 0.85 + (Math.random() - 0.5) * 0.6,
        y: 0.16,
        z: z + rightZ * side * 0.85 + (Math.random() - 0.5) * 0.6,
        life: 1.15 + Math.random() * 0.55,
        scaleStart: 0.45,
        scaleEnd: 1.9 + strength * 0.9,
        opacity: 0.32 + strength * 0.2,
        stretchX: 1.8 + strength * 0.6,
        stretchZ: 0.9,
        rotationY: heading - Math.PI / 2 + (Math.random() - 0.5) * 0.6,
        spin: 0.04,
      });
    }
  }

  sinkingSmoke(x: number, z: number): void {
    this.smoke.spawn({
      x: x + (Math.random() - 0.5) * 1.6,
      y: 1.0 + Math.random() * 1.2,
      z: z + (Math.random() - 0.5) * 1.6,
      vx: (Math.random() - 0.5) * 0.7,
      vy: 0.8 + Math.random() * 0.8,
      vz: (Math.random() - 0.5) * 0.7,
      life: 1.4 + Math.random() * 0.8,
      scaleStart: 0.9,
      scaleEnd: 3.4,
      opacity: 0.32,
      gravity: -0.2,
    });
  }

  reset(): void {
    this.splash.reset();
    this.wakePool.reset();
    this.smoke.reset();
    this.spark.reset();
    this.flash.reset();
  }

  dispose(): void {
    this.splash.dispose();
    this.wakePool.dispose();
    this.smoke.dispose();
    this.spark.dispose();
    this.flash.dispose();
  }
}
