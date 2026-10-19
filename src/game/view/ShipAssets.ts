import * as THREE from 'three';

export interface ShipPalette {
  hull: THREE.MeshStandardMaterial;
  deck: THREE.MeshStandardMaterial;
  sail: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  lamp: THREE.MeshBasicMaterial;
}

export interface ShipGeometries {
  hull: THREE.ExtrudeGeometry;
  deck: THREE.BoxGeometry;
  cabin: THREE.BoxGeometry;
  cabinRoof: THREE.BoxGeometry;
  mast: THREE.CylinderGeometry;
  yard: THREE.CylinderGeometry;
  sailMain: THREE.PlaneGeometry;
  sailTop: THREE.PlaneGeometry;
  sailBow: THREE.PlaneGeometry;
  stripe: THREE.PlaneGeometry;
  cannon: THREE.CylinderGeometry;
  rail: THREE.CylinderGeometry;
  bowsprit: THREE.CylinderGeometry;
  flagPole: THREE.CylinderGeometry;
  flag: THREE.PlaneGeometry;
  lantern: THREE.OctahedronGeometry;
}

function billowedSail(
  width: number,
  height: number,
  segmentsX: number,
  segmentsY: number,
): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(width, height, segmentsX, segmentsY);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const u = x / width + 0.5;
    const v = y / height + 0.5;
    const billow =
      Math.sin(u * Math.PI) * (0.13 + Math.sin(v * Math.PI) * 0.06);
    positions.setZ(i, billow);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function createHullGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(2.35, 0);
  shape.quadraticCurveTo(1.55, 0.8, 0.35, 0.82);
  shape.lineTo(-1.7, 0.62);
  shape.quadraticCurveTo(-2.05, 0.45, -2.05, 0);
  shape.quadraticCurveTo(-2.05, -0.45, -1.7, -0.62);
  shape.lineTo(0.35, -0.82);
  shape.quadraticCurveTo(1.55, -0.8, 2.35, 0);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.9,
    steps: 1,
    curveSegments: 3,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.09,
    bevelThickness: 0.09,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -0.3, 0);
  geometry.computeVertexNormals();
  return geometry;
}

/** Shared geometries and materials for every ship, created once per game. */
export class ShipAssets {
  readonly geometries: ShipGeometries;
  readonly player: ShipPalette;
  readonly enemy: ShipPalette;

  private readonly materials: THREE.Material[] = [];
  private readonly geometriesToDispose: THREE.BufferGeometry[] = [];

  constructor() {
    const yard = new THREE.CylinderGeometry(0.05, 0.05, 2.5, 6);
    yard.rotateX(Math.PI / 2);
    const cannon = new THREE.CylinderGeometry(0.1, 0.14, 0.62, 6);
    cannon.rotateX(Math.PI / 2);
    const bowsprit = new THREE.CylinderGeometry(0.05, 0.08, 1.8, 5);
    bowsprit.rotateZ(-Math.PI / 2);

    this.geometries = {
      hull: createHullGeometry(),
      deck: new THREE.BoxGeometry(3.9, 0.14, 1.15),
      cabin: new THREE.BoxGeometry(1.1, 0.6, 0.95),
      cabinRoof: new THREE.BoxGeometry(1.28, 0.12, 1.1),
      mast: new THREE.CylinderGeometry(0.06, 0.085, 3.6, 6),
      yard,
      sailMain: billowedSail(2.2, 2.0, 4, 4),
      sailTop: billowedSail(1.55, 0.85, 3, 2),
      sailBow: billowedSail(1.05, 1.15, 2, 2),
      stripe: new THREE.PlaneGeometry(2.05, 0.22),
      cannon,
      rail: new THREE.CylinderGeometry(0.035, 0.035, 0.5, 4),
      bowsprit,
      flagPole: new THREE.CylinderGeometry(0.035, 0.035, 1.6, 5),
      flag: new THREE.PlaneGeometry(0.78, 0.4),
      lantern: new THREE.OctahedronGeometry(0.17, 0),
    };
    this.geometriesToDispose.push(...Object.values(this.geometries));

    this.player = this.createPalette({
      hull: 0x8a5b35,
      deck: 0xd4b077,
      sail: 0xf5ead1,
      accent: 0x2f9fae,
      dark: 0x3b2b20,
      metal: 0x45443f,
      lamp: 0xffd987,
    });
    this.enemy = this.createPalette({
      hull: 0x3a2a28,
      deck: 0x6c4b32,
      sail: 0x2f2d33,
      accent: 0xb8432e,
      dark: 0x181617,
      metal: 0x353b3d,
      lamp: 0xff9b6e,
    });
  }

  dispose(): void {
    for (const material of this.materials) material.dispose();
    for (const geometry of this.geometriesToDispose) geometry.dispose();
    this.materials.length = 0;
    this.geometriesToDispose.length = 0;
  }

  private createPalette(colors: {
    hull: number;
    deck: number;
    sail: number;
    accent: number;
    dark: number;
    metal: number;
    lamp: number;
  }): ShipPalette {
    const lamp = new THREE.MeshBasicMaterial({ color: colors.lamp });
    this.materials.push(lamp);
    return {
      hull: this.standard(colors.hull, { flatShading: true, roughness: 0.8 }),
      deck: this.standard(colors.deck, { roughness: 0.95 }),
      sail: this.standard(colors.sail, {
        side: THREE.DoubleSide,
        roughness: 0.94,
      }),
      accent: this.standard(colors.accent, {
        side: THREE.DoubleSide,
        roughness: 0.88,
      }),
      dark: this.standard(colors.dark, { flatShading: true, roughness: 0.86 }),
      metal: this.standard(colors.metal, { metalness: 0.45, roughness: 0.5 }),
      lamp,
    };
  }

  private standard(
    color: number,
    options: THREE.MeshStandardMaterialParameters,
  ): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({
      color,
      metalness: 0,
      roughness: 0.9,
      ...options,
    });
    this.materials.push(material);
    return material;
  }
}
