import * as THREE from 'three';
import { GAME_CONFIG } from '../config';
import type { GridObstacle } from '../types';
import type { IslandDecorAssets } from './IslandDecor';

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Decorative tropical islands framing the sailing arena. Their shore/shelf
 * radii are shared with the sea shader via GAME_CONFIG.decorativeIslands.
 */
export class Archipelago {
  readonly obstacles: GridObstacle[] = [];
  private readonly group = new THREE.Group();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly decor: IslandDecorAssets,
  ) {
    const sandMaterial = new THREE.MeshStandardMaterial({
      color: 0xe9d6a5,
      roughness: 1,
      flatShading: true,
    });
    const wetSandMaterial = new THREE.MeshStandardMaterial({
      color: 0xd6bd8b,
      roughness: 1,
      flatShading: true,
    });
    const grassMaterial = new THREE.MeshStandardMaterial({
      color: 0x73a95e,
      roughness: 1,
      flatShading: true,
    });
    const grassDarkMaterial = new THREE.MeshStandardMaterial({
      color: 0x5f9251,
      roughness: 1,
      flatShading: true,
    });

    GAME_CONFIG.decorativeIslands.forEach((spec, index) => {
      const island = new THREE.Group();
      island.position.set(spec.x, 0, spec.z);
      island.rotation.y = index * 0.9;

      const sand = new THREE.Mesh(
        new THREE.CylinderGeometry(
          spec.shoreRadius * 0.96,
          spec.shoreRadius * 1.16,
          2.9,
          12,
        ),
        wetSandMaterial,
      );
      sand.position.y = 0.0;
      island.add(sand);

      const beach = new THREE.Mesh(
        new THREE.CylinderGeometry(
          spec.shoreRadius * 1.0,
          spec.shoreRadius * 1.02,
          0.5,
          12,
        ),
        sandMaterial,
      );
      beach.position.y = 1.5;
      island.add(beach);

      const grassRadius = spec.shoreRadius * 0.62;
      const grass = new THREE.Mesh(
        new THREE.CylinderGeometry(
          grassRadius,
          grassRadius * 1.16,
          1.65,
          10,
        ),
        grassMaterial,
      );
      grass.position.y = 2.25;
      island.add(grass);

      const innerRadius = grassRadius * 0.58;
      const innerGrass = new THREE.Mesh(
        new THREE.CylinderGeometry(
          innerRadius,
          innerRadius * 1.2,
          0.55,
          9,
        ),
        grassDarkMaterial,
      );
      innerGrass.position.y = 3.32;
      island.add(innerGrass);

      const grassTopY = 3.07;
      const innerTopY = 3.6;
      const rng = seededRandom(1000 + index * 733);
      const treeCount = 7 + Math.floor(rng() * 3);
      for (let i = 0; i < treeCount; i += 1) {
        const angle =
          (i / treeCount) * Math.PI * 2 +
          index * 0.8 +
          (rng() - 0.5) * 0.8;
        const radius = (0.24 + rng() * 0.52) * grassRadius;
        this.decor.tree(
          island,
          Math.cos(angle) * radius,
          radius < innerRadius * 1.05 ? innerTopY : grassTopY,
          Math.sin(angle) * radius,
          0.85 + rng() * 0.55,
          Math.floor(rng() * 3),
        );
      }

      const bushCount = 4;
      for (let i = 0; i < bushCount; i += 1) {
        const angle = rng() * Math.PI * 2;
        const radius = grassRadius * (0.5 + rng() * 0.42);
        this.decor.bush(
          island,
          Math.cos(angle) * radius,
          radius < innerRadius * 1.05 ? innerTopY : grassTopY - 0.05,
          Math.sin(angle) * radius,
          0.65 + rng() * 0.5,
        );
      }

      const rockCount = 5;
      for (let i = 0; i < rockCount; i += 1) {
        const angle =
          (i / rockCount) * Math.PI * 2 + index * 1.3 + (rng() - 0.5) * 0.9;
        const onBeach = i < 3;
        const radius = onBeach
          ? spec.shoreRadius * (0.88 + rng() * 0.14)
          : grassRadius * (0.62 + rng() * 0.3);
        this.decor.rock(
          island,
          Math.cos(angle) * radius,
          onBeach
            ? 1.5
            : radius < innerRadius * 1.05
              ? innerTopY
              : grassTopY - 0.1,
          Math.sin(angle) * radius,
          onBeach
            ? 1.7 + rng() * 1.5
            : 0.6 + rng() * 0.9,
          i + index,
        );
      }

      this.group.add(island);
      this.obstacles.push({
        x: spec.x,
        z: spec.z,
        radius: spec.shoreRadius * 0.94,
      });
    });

    this.scene.add(this.group);
  }

  dispose(): void {
    this.scene.remove(this.group);
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      if (Array.isArray(object.material)) {
        for (const material of object.material) materials.add(material);
      } else {
        materials.add(object.material);
      }
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    this.group.clear();
    this.obstacles.length = 0;
  }
}
