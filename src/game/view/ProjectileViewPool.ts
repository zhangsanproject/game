import * as THREE from 'three';
import { clamp } from '../math';
import type { Projectile } from '../entities/Projectile';
import type { EffectsSystem } from './Effects';

interface ActiveBall {
  mesh: THREE.Mesh;
  trailTimer: number;
}

/** Bounded pool of cannonball meshes synced to the pure projectile list. */
export class ProjectileViewPool {
  private readonly free: THREE.Mesh[] = [];
  private readonly active = new Map<number, ActiveBall>();
  private readonly seen = new Set<number>();
  private readonly geometry: THREE.SphereGeometry;
  private readonly material: THREE.MeshStandardMaterial;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly effects: EffectsSystem,
    capacity = 48,
  ) {
    this.geometry = new THREE.SphereGeometry(0.2, 6, 5);
    this.material = new THREE.MeshStandardMaterial({
      color: 0x171a1d,
      roughness: 0.55,
      metalness: 0.3,
    });

    for (let i = 0; i < capacity; i += 1) {
      const mesh = new THREE.Mesh(this.geometry, this.material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.free.push(mesh);
    }
  }

  sync(projectiles: readonly Projectile[], dt: number): void {
    this.seen.clear();

    for (const projectile of projectiles) {
      this.seen.add(projectile.id);
      let entry = this.active.get(projectile.id);
      if (!entry) {
        const mesh = this.free.pop();
        if (!mesh) continue;
        mesh.visible = true;
        mesh.scale.set(1, 1, 1.75);
        entry = { mesh, trailTimer: 0.01 };
        this.active.set(projectile.id, entry);
      }

      const total = Math.max(0.001, projectile.age + projectile.ttl);
      const progress = clamp(projectile.age / total, 0, 1);
      const y = 0.85 + Math.sin(progress * Math.PI) * 0.55;
      entry.mesh.position.set(projectile.x, y, projectile.z);
      entry.mesh.rotation.y = Math.atan2(projectile.vx, projectile.vz);

      if (dt > 0) {
        entry.trailTimer -= dt;
        if (entry.trailTimer <= 0) {
          this.effects.cannonTrail(projectile.x, y, projectile.z);
          entry.trailTimer = 0.075;
        }
      }
    }

    for (const [id, entry] of this.active) {
      if (this.seen.has(id)) continue;
      entry.mesh.visible = false;
      this.free.push(entry.mesh);
      this.active.delete(id);
    }
  }

  reset(): void {
    for (const entry of this.active.values()) {
      entry.mesh.visible = false;
      this.free.push(entry.mesh);
    }
    this.active.clear();
  }

  dispose(): void {
    for (const entry of this.active.values()) {
      this.scene.remove(entry.mesh);
    }
    for (const mesh of this.free) {
      this.scene.remove(mesh);
    }
    this.active.clear();
    this.free.length = 0;
    this.geometry.dispose();
    this.material.dispose();
  }
}
