import * as THREE from 'three';
import { GAME_CONFIG } from '../config';
import type { IslandDecorAssets } from './IslandDecor';

/**
 * Bright tropical harbor island: broad sand beach, grassy interior, round
 * canopy trees, rocks, wooden pier, lighthouse and the docking ring. The wide
 * turquoise shelf and shore foam are drawn by the sea shader from config radii.
 */
export class Harbor {
  readonly group = new THREE.Group();
  private readonly markerGroup = new THREE.Group();
  private readonly lampMaterial: THREE.MeshStandardMaterial;
  private readonly flagMaterial: THREE.MeshStandardMaterial;
  private flag: THREE.Mesh | null = null;
  private time = 0;

  constructor(
    private readonly scene: THREE.Scene,
    decor: IslandDecorAssets,
  ) {
    const center = GAME_CONFIG.harbor.center;
    const shore = GAME_CONFIG.harbor.shoreRadius;
    this.group.position.set(center.x, 0, center.z);
    this.group.name = 'harbor';

    const wetSand = this.material(0xd8bf8d, true);
    const sand = this.material(0xe9d6a5, true);
    const grass = this.material(0x73a95e, true);
    const grassDark = this.material(0x5f9251, true);
    const wood = this.material(0x7a5533);
    const darkWood = this.material(0x4a3321);
    const stone = this.material(0x9aa39a, true);
    const white = this.material(0xece6d8);
    const red = this.material(0xb24a3c);
    const roof = this.material(0x31545c);
    const windowMaterial = this.material(0x1d3640);
    this.lampMaterial = this.material(0xffd77a);
    this.lampMaterial.emissive.setHex(0xffb347);
    this.lampMaterial.emissiveIntensity = 1.1;

    // Island layers: submerged sand, wide beach, grass plateau, inner mound.
    this.add(
      new THREE.CylinderGeometry(shore * 0.97, shore * 1.16, 2.9, 14),
      wetSand,
      0,
      0,
      0,
    );
    this.add(
      new THREE.CylinderGeometry(shore, shore * 1.02, 0.5, 14),
      sand,
      0,
      1.5,
      0,
    );

    const grassRadius = shore * 0.62;
    const innerRadius = grassRadius * 0.58;
    this.add(
      new THREE.CylinderGeometry(grassRadius, grassRadius * 1.16, 1.65, 12),
      grass,
      0,
      2.25,
      0,
    );
    this.add(
      new THREE.CylinderGeometry(innerRadius, innerRadius * 1.2, 0.55, 10),
      grassDark,
      0,
      3.32,
      0,
    );
    const baseY = 3.08;
    const innerY = 3.6;

    // Wooden pier that runs from the beach out over the water.
    this.add(new THREE.BoxGeometry(3.6, 0.32, 26), wood, 0, 1.55, -23);
    this.add(new THREE.BoxGeometry(8.2, 0.32, 3.4), wood, 0, 1.55, -35);
    const postGeometry = new THREE.CylinderGeometry(0.22, 0.27, 2.7, 6);
    for (const z of [-12, -18, -24, -30, -34]) {
      this.add(postGeometry, darkWood, 1.72, 0.15, z);
      this.add(postGeometry, darkWood, -1.72, 0.15, z);
    }

    // Crates and barrels on the pier.
    const crate = new THREE.BoxGeometry(1.0, 0.95, 1.0);
    this.add(crate, darkWood, 1.0, 2.19, -21.5);
    this.add(crate, wood, 1.05, 2.19, -22.8);
    this.add(crate, darkWood, -0.9, 2.19, -27.2);
    this.add(
      new THREE.CylinderGeometry(0.42, 0.48, 1.0, 8),
      wood,
      -1.05,
      2.2,
      -29.0,
    );

    const lampPost = new THREE.CylinderGeometry(0.07, 0.09, 2.5, 5);
    const lampGlobe = new THREE.SphereGeometry(0.18, 7, 5);
    for (const z of [-19.5, -31.5]) {
      this.add(lampPost, darkWood, 1.55, 2.85, z);
      this.add(lampGlobe, this.lampMaterial, 1.55, 4.15, z);
    }

    // Lighthouse.
    const lighthouse = new THREE.Group();
    lighthouse.position.set(-8.4, baseY, 0.8);
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(1.35, 1.6, 6.6, 10),
      white,
    );
    tower.position.y = 3.3;
    lighthouse.add(tower);
    for (const y of [2.0, 4.2]) {
      const stripe = new THREE.Mesh(
        new THREE.CylinderGeometry(1.39, 1.6, 0.95, 10),
        red,
      );
      stripe.position.y = y;
      lighthouse.add(stripe);
    }
    const gallery = new THREE.Mesh(
      new THREE.CylinderGeometry(2.0, 2.0, 0.28, 12),
      darkWood,
    );
    gallery.position.y = 6.65;
    lighthouse.add(gallery);
    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.86, 0.94, 1.1, 8),
      this.lampMaterial,
    );
    lamp.position.y = 7.3;
    lighthouse.add(lamp);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.55, 1.5, 8), red);
    cap.position.y = 8.55;
    lighthouse.add(cap);
    this.group.add(lighthouse);

    // Stone watchtower.
    this.add(
      new THREE.CylinderGeometry(2.15, 2.45, 4.4, 9),
      stone,
      8.1,
      baseY + 2.2,
      -2.8,
    );
    this.add(
      new THREE.CylinderGeometry(2.55, 2.55, 0.3, 9),
      darkWood,
      8.1,
      baseY + 4.48,
      -2.8,
    );
    this.add(
      new THREE.ConeGeometry(2.8, 2.1, 9),
      roof,
      8.1,
      baseY + 5.68,
      -2.8,
    );
    this.add(
      new THREE.BoxGeometry(0.62, 1.0, 0.1),
      windowMaterial,
      8.1,
      baseY + 2.4,
      -0.68,
    );

    // Village houses.
    this.buildHouse(-4.0, -7.6, 0.25, white, roof, darkWood, windowMaterial, baseY);
    this.buildHouse(6.4, -7.2, -0.35, white, roof, darkWood, windowMaterial, baseY);
    this.buildHouse(4.7, 8.6, 0.7, wood, roof, darkWood, windowMaterial, baseY);

    // Tropical vegetation and shoreline rocks, shared with the other islands.
    const treeSpots: Array<[number, number, number, number]> = [
      [-11.5, 5.5, 1.15, 0],
      [-10.0, -5.0, 1.0, 1],
      [11.0, -2.0, 1.2, 2],
      [2.0, -11.0, 1.05, 0],
      [9.0, 9.0, 1.1, 1],
      [-3.0, 3.0, 0.9, 2],
    ];
    for (const [x, z, scale, variant] of treeSpots) {
      const radius = Math.hypot(x, z);
      decor.tree(
        this.group,
        x,
        radius < innerRadius * 1.02 ? innerY : baseY,
        z,
        scale,
        variant,
      );
    }
    const bushSpots: Array<[number, number, number]> = [
      [-6.0, 6.5, 0.9],
      [5.5, -4.5, 0.8],
      [12.0, 3.0, 0.85],
      [0.5, 10.5, 0.75],
      [-9.0, -10.0, 0.8],
    ];
    for (const [x, z, scale] of bushSpots) {
      const radius = Math.hypot(x, z);
      decor.bush(
        this.group,
        x,
        radius < innerRadius * 1.02 ? innerY : baseY - 0.05,
        z,
        scale,
      );
    }

    decor.rock(this.group, -20.5, 1.5, 11.0, 2.8, 0);
    decor.rock(this.group, 19.5, 1.5, -7.0, 2.0, 1);
    decor.rock(this.group, 15.0, 1.5, 15.0, 1.6, 2);
    decor.rock(this.group, -16.0, 1.5, -15.5, 1.6, 3);
    decor.rock(this.group, 5.5, baseY - 0.05, -10.5, 1.1, 4);
    decor.rock(this.group, -12.0, baseY - 0.05, 1.0, 0.9, 5);

    // Flag at the end of the pier.
    this.add(
      new THREE.CylinderGeometry(0.06, 0.08, 4.8, 5),
      darkWood,
      2.45,
      4.1,
      -35.2,
    );
    this.flagMaterial = new THREE.MeshStandardMaterial({
      color: 0x2e8fa3,
      side: THREE.DoubleSide,
      roughness: 0.9,
    });
    this.flagMaterial.emissive.setHex(0x0d3a44);
    this.flagMaterial.emissiveIntensity = 0.35;
    this.flag = new THREE.Mesh(
      new THREE.PlaneGeometry(1.25, 0.7),
      this.flagMaterial,
    );
    this.flag.position.set(2.45, 6.15, -35.2);
    this.group.add(this.flag);

    // Mooring rings in the water just off the pier.
    const ringGeometry = new THREE.RingGeometry(7.4, 8.2, 48);
    ringGeometry.rotateX(-Math.PI / 2);
    const innerRingGeometry = new THREE.RingGeometry(2.9, 3.3, 40);
    innerRingGeometry.rotateX(-Math.PI / 2);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xffc352,
      transparent: true,
      opacity: 0.62,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const innerMaterial = new THREE.MeshBasicMaterial({
      color: 0xffe7a4,
      transparent: true,
      opacity: 0.36,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.markerGroup.position.set(
      0,
      0.22,
      GAME_CONFIG.harbor.dockPoint.z - center.z,
    );
    this.markerGroup.add(
      new THREE.Mesh(ringGeometry, ringMaterial),
      new THREE.Mesh(innerRingGeometry, innerMaterial),
    );
    this.group.add(this.markerGroup);

    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = false;
        object.receiveShadow = false;
      }
    });

    this.scene.add(this.group);
  }

  update(dt: number): void {
    this.time += dt;
    this.markerGroup.rotation.y += dt * 0.17;
    this.lampMaterial.emissiveIntensity = 1.0 + Math.sin(this.time * 2.2) * 0.25;
    if (this.flag) {
      this.flag.rotation.y = Math.sin(this.time * 2.3) * 0.2;
      this.flag.scale.x = 0.94 + Math.sin(this.time * 3.1) * 0.06;
    }
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
    this.flagMaterial.dispose();
    this.group.clear();
  }

  private material(color: number, flatShading = false): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.94,
      metalness: 0,
      flatShading,
    });
  }

  private add(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    this.group.add(mesh);
    return mesh;
  }

  private buildHouse(
    x: number,
    z: number,
    rotation: number,
    wall: THREE.Material,
    roof: THREE.Material,
    dark: THREE.Material,
    windowMaterial: THREE.Material,
    baseY: number,
  ): void {
    const house = new THREE.Group();
    house.position.set(x, baseY, z);
    house.rotation.y = rotation;

    const body = new THREE.Mesh(new THREE.BoxGeometry(3.7, 2.1, 2.9), wall);
    body.position.y = 1.05;
    house.add(body);

    const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(2.85, 1.75, 4), roof);
    roofMesh.position.y = 2.95;
    roofMesh.rotation.y = Math.PI / 4;
    house.add(roofMesh);

    const door = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.1, 0.1), dark);
    door.position.set(0, 0.58, 1.48);
    house.add(door);

    const windowA = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.55, 0.08),
      windowMaterial,
    );
    windowA.position.set(-1.05, 1.35, 1.48);
    house.add(windowA);
    const windowB = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.55, 0.08),
      windowMaterial,
    );
    windowB.position.set(1.05, 1.35, 1.48);
    house.add(windowB);

    this.group.add(house);
  }
}
