import * as THREE from 'three';

/**
 * Shared vegetation/rock geometries and materials used by the harbor and the
 * decorative tropical islands. Round canopies + low-poly rocks match the bright
 * diorama look of the visual reference.
 */
export class IslandDecorAssets {
  private readonly trunkGeometry = new THREE.CylinderGeometry(0.16, 0.28, 1.6, 5);
  private readonly canopyGeometry = new THREE.IcosahedronGeometry(1, 1);
  private readonly rockGeometry = new THREE.DodecahedronGeometry(1, 0);
  private readonly bushGeometry = new THREE.IcosahedronGeometry(0.7, 0);
  private readonly trunkMaterial = new THREE.MeshStandardMaterial({
    color: 0x7b5838,
    roughness: 1,
    flatShading: true,
  });
  private readonly canopyMaterials = [
    new THREE.MeshStandardMaterial({ color: 0x4d8e48, roughness: 1, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x6cac58, roughness: 1, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x3e7b45, roughness: 1, flatShading: true }),
  ];
  private readonly rockMaterials = [
    new THREE.MeshStandardMaterial({ color: 0x7b8782, roughness: 1, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x929d97, roughness: 1, flatShading: true }),
  ];
  private readonly bushMaterial = new THREE.MeshStandardMaterial({
    color: 0x68a352,
    roughness: 1,
    flatShading: true,
  });

  tree(
    parent: THREE.Object3D,
    x: number,
    groundY: number,
    z: number,
    scale: number,
    variant: number,
  ): void {
    const tree = new THREE.Group();
    tree.position.set(x, groundY, z);
    tree.rotation.y = (variant * 1.73) % (Math.PI * 2);

    const trunk = new THREE.Mesh(this.trunkGeometry, this.trunkMaterial);
    trunk.position.y = 0.8 * scale;
    trunk.scale.set(scale * 0.9, scale, scale * 0.9);
    tree.add(trunk);

    const canopies = [
      { x: 0, y: 2.05, z: 0, s: 1.35, m: 0 },
      { x: 0.62, y: 1.82, z: 0.18, s: 0.95, m: 1 },
      { x: -0.55, y: 1.78, z: -0.25, s: 0.82, m: 2 },
    ];
    for (const canopy of canopies) {
      const mesh = new THREE.Mesh(
        this.canopyGeometry,
        this.canopyMaterials[(variant + canopy.m) % this.canopyMaterials.length],
      );
      mesh.position.set(canopy.x * scale, canopy.y * scale, canopy.z * scale);
      mesh.scale.set(
        canopy.s * scale,
        canopy.s * 0.82 * scale,
        canopy.s * scale,
      );
      tree.add(mesh);
    }

    parent.add(tree);
  }

  rock(
    parent: THREE.Object3D,
    x: number,
    groundY: number,
    z: number,
    scale: number,
    variant: number,
  ): void {
    const mesh = new THREE.Mesh(
      this.rockGeometry,
      this.rockMaterials[variant % this.rockMaterials.length],
    );
    mesh.position.set(x, groundY + 0.42 * scale, z);
    mesh.scale.set(scale * 1.15, scale * 0.72, scale);
    mesh.rotation.set(
      variant * 0.31,
      variant * 1.17,
      variant * 0.13,
    );
    parent.add(mesh);
  }

  bush(
    parent: THREE.Object3D,
    x: number,
    groundY: number,
    z: number,
    scale: number,
  ): void {
    const mesh = new THREE.Mesh(this.bushGeometry, this.bushMaterial);
    mesh.position.set(x, groundY + 0.3 * scale, z);
    mesh.scale.set(scale, scale * 0.75, scale);
    mesh.rotation.y = x * 0.7 + z * 0.3;
    parent.add(mesh);
  }

  dispose(): void {
    this.trunkGeometry.dispose();
    this.canopyGeometry.dispose();
    this.rockGeometry.dispose();
    this.bushGeometry.dispose();
    this.trunkMaterial.dispose();
    for (const material of this.canopyMaterials) material.dispose();
    for (const material of this.rockMaterials) material.dispose();
    this.bushMaterial.dispose();
  }
}
