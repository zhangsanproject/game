import * as THREE from 'three';
import { GAME_CONFIG } from '../config';

const skyVertexShader = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyFragmentShader = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uSunColor;
  uniform vec3 uSunDirection;
  varying vec3 vDirection;

  void main() {
    vec3 direction = normalize(vDirection);
    float height = clamp(direction.y, 0.0, 1.0);
    vec3 color = mix(uHorizon, uZenith, pow(height, 0.62));
    float sunDot = max(dot(direction, normalize(uSunDirection)), 0.0);
    color += uSunColor * pow(sunDot, 220.0) * 1.1;
    color += uSunColor * pow(sunDot, 9.0) * 0.07;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

interface CloudSpec {
  x: number;
  y: number;
  z: number;
  scale: number;
  speed: number;
}

/**
 * Sky dome, fog, lights and frozen low-poly clouds. No shadow maps: gameplay
 * readability and stable frame time are more important for this MVP.
 */
export class Environment {
  readonly group = new THREE.Group();
  private readonly sky: THREE.Mesh;
  private readonly skyMaterial: THREE.ShaderMaterial;
  private readonly skyGeometry: THREE.SphereGeometry;
  private readonly clouds: THREE.Group[] = [];
  private readonly cloudSpecs: CloudSpec[] = [
    { x: -170, y: 88, z: -190, scale: 1.35, speed: 0.45 },
    { x: 120, y: 104, z: -260, scale: 1.7, speed: 0.3 },
    { x: 230, y: 82, z: 70, scale: 1.1, speed: 0.55 },
    { x: -240, y: 96, z: 140, scale: 1.5, speed: 0.35 },
    { x: 30, y: 118, z: 230, scale: 1.25, speed: 0.4 },
    { x: -60, y: 90, z: -80, scale: 0.9, speed: 0.6 },
  ];
  private readonly cloudGeometry = new THREE.IcosahedronGeometry(8, 1);
  private readonly cloudMaterial = new THREE.MeshStandardMaterial({
    color: 0xf4f8f8,
    roughness: 1,
    metalness: 0,
    flatShading: true,
  });

  constructor(private readonly scene: THREE.Scene) {
    scene.fog = new THREE.FogExp2(
      GAME_CONFIG.world.fogColor,
      GAME_CONFIG.world.fogDensity,
    );
    scene.background = new THREE.Color(GAME_CONFIG.world.fogColor);

    const sun = GAME_CONFIG.world.sunDirection;
    const sunDirection = new THREE.Vector3(sun.x, sun.y, sun.z).normalize();

    this.skyGeometry = new THREE.SphereGeometry(620, 32, 18);
    this.skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uZenith: { value: new THREE.Color(0x3f9bb8) },
        uHorizon: { value: new THREE.Color(0xcdeff2) },
        uSunColor: { value: new THREE.Color(0xffefc4) },
        uSunDirection: { value: sunDirection.clone() },
      },
      vertexShader: skyVertexShader,
      fragmentShader: skyFragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.sky = new THREE.Mesh(this.skyGeometry, this.skyMaterial);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    this.group.add(this.sky);

    const hemisphere = new THREE.HemisphereLight(0xdff6fa, 0x174d57, 1.4);
    this.group.add(hemisphere);

    const ambient = new THREE.AmbientLight(0x9cc6ce, 0.45);
    this.group.add(ambient);

    const sunLight = new THREE.DirectionalLight(0xfff0cd, 2.5);
    sunLight.position.copy(sunDirection).multiplyScalar(180);
    this.group.add(sunLight);
    this.group.add(sunLight.target);

    this.buildClouds();
    scene.add(this.group);
  }

  private buildClouds(): void {
    for (const spec of this.cloudSpecs) {
      const cloud = new THREE.Group();
      const blobs = [
        { x: 0, y: 0, z: 0, s: 1 },
        { x: 1.1, y: -0.15, z: 0.25, s: 0.72 },
        { x: -1.0, y: -0.2, z: -0.2, s: 0.6 },
        { x: 0.15, y: 0.38, z: -0.25, s: 0.55 },
      ];
      for (const blob of blobs) {
        const mesh = new THREE.Mesh(this.cloudGeometry, this.cloudMaterial);
        mesh.position.set(blob.x * 8 * spec.scale, blob.y * 8 * spec.scale, blob.z * 8 * spec.scale);
        mesh.scale.setScalar(blob.s * spec.scale);
        cloud.add(mesh);
      }
      cloud.position.set(spec.x, spec.y, spec.z);
      this.clouds.push(cloud);
      this.group.add(cloud);
    }
  }

  update(dt: number, camera: THREE.Camera): void {
    this.sky.position.copy(camera.position);
    for (let i = 0; i < this.clouds.length; i += 1) {
      const cloud = this.clouds[i];
      const spec = this.cloudSpecs[i];
      cloud.position.x += spec.speed * dt;
      if (cloud.position.x > 300) cloud.position.x = -300;
    }
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.skyGeometry.dispose();
    this.skyMaterial.dispose();
    this.cloudGeometry.dispose();
    this.cloudMaterial.dispose();
    this.group.clear();
    this.scene.fog = null;
  }
}
