import * as THREE from 'three';
import { GAME_CONFIG } from '../config';

const vertexShader = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying float vWaveHeight;

  float waveHeight(vec2 p) {
    float t = uTime;
    float h = sin(p.x * 0.062 + t * 0.72) * 0.55;
    h += sin(p.y * 0.095 - t * 0.55) * 0.32;
    h += sin((p.x + p.y) * 0.037 + t * 0.33) * 0.72;
    h += sin((p.x - p.y) * 0.16 + t * 1.15) * 0.09;
    return h;
  }

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    float h = waveHeight(world.xz);
    float hx = waveHeight(world.xz + vec2(1.0, 0.0));
    float hz = waveHeight(world.xz + vec2(0.0, 1.0));
    world.y += h;
    vWaveHeight = h;
    vWorldPosition = world.xyz;
    vWorldNormal = normalize(vec3(h - hx, 1.0, h - hz));
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uHorizon;
  uniform vec3 uSunColor;
  uniform vec3 uSunDirection;
  uniform vec4 uIslands[4];
  uniform float uTime;

  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying float vWaveHeight;

  void main() {
    vec2 worldXZ = vWorldPosition.xz;
    vec3 normal = normalize(vWorldNormal);
    vec3 detailNormal = vec3(
      sin(worldXZ.x * 0.91 + uTime * 1.4) +
        sin(worldXZ.y * 1.27 - uTime * 1.1),
      0.0,
      cos(worldXZ.y * 0.85 + uTime * 1.2) +
        cos(worldXZ.x * 1.13 - uTime * 0.8)
    );
    normal = normalize(normal + detailNormal * 0.022);
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);

    float waveMix = clamp(vWaveHeight * 0.55 + 0.46, 0.0, 1.0);
    vec3 color = mix(uDeep, uShallow, waveMix);

    float crest = smoothstep(0.3, 1.15, vWaveHeight);
    color = mix(color, uShallow * 1.2, crest * 0.28);

    float diffuse = max(dot(normal, uSunDirection), 0.0);
    color *= 0.72 + diffuse * 0.45;

    vec3 halfway = normalize(uSunDirection + viewDir);
    float specular = pow(max(dot(normal, halfway), 0.0), 120.0);
    color += uSunColor * specular * 0.55;

    // Turquoise shelves, animated surf line and soft island shadow.
    float shelfMask = 0.0;
    float surf = 0.0;
    float shadowMask = 0.0;
    for (int i = 0; i < 4; i++) {
      vec4 island = uIslands[i];
      float d = distance(worldXZ, island.xy);
      float shelf = 1.0 - smoothstep(island.z * 0.9, island.w, d);
      shelfMask = max(shelfMask, shelf);

      float wobble = sin(uTime * 1.35 + island.x * 0.13 + island.z * 0.07) * 0.55;
      float band = abs(d - island.z - 0.35 - wobble);
      float foamBand = 1.0 - smoothstep(0.05, 1.35, band);
      surf = max(surf, foamBand);

      vec2 shadowCenter = island.xy - uSunDirection.xz * island.z * 1.25;
      float shadowDist = distance(worldXZ, shadowCenter);
      float shadow = 1.0 - smoothstep(island.z * 0.35, island.z * 1.95, shadowDist);
      shadowMask = max(shadowMask, shadow);
    }

    vec3 shelfColor = vec3(0.24, 0.72, 0.69);
    color = mix(color, shelfColor, shelfMask * 0.68);

    float caustic =
      sin(worldXZ.x * 0.5 + uTime * 0.85) *
      sin(worldXZ.y * 0.56 - uTime * 0.7);
    color += vec3(0.035, 0.065, 0.06) * shelfMask * max(caustic, 0.0) * 0.35;

    color *= 1.0 - shadowMask * 0.1;

    float streakNoise = sin(
      worldXZ.x * 1.05 +
      sin(worldXZ.y * 0.6 + uTime * 0.35) * 1.5 +
      uTime * 0.7
    );
    float streaks =
      smoothstep(0.93, 0.999, streakNoise) *
      smoothstep(0.35, 1.1, vWaveHeight) * 0.055;
    color = mix(color, vec3(0.88, 0.98, 0.97), streaks);

    float capNoise =
      sin(worldXZ.x * 1.6 + worldXZ.y * 1.1 + uTime * 1.2) * 0.5 + 0.5;
    float foam =
      smoothstep(1.1, 1.5, vWaveHeight) *
      smoothstep(0.35, 0.85, capNoise) * 0.14;
    color = mix(color, vec3(0.86, 0.97, 0.96), foam);
    color = mix(color, vec3(0.95, 1.0, 0.99), surf * 0.72);

    float distanceToCamera = length(worldXZ - cameraPosition.xz);
    color = mix(color, uHorizon, smoothstep(120.0, 380.0, distanceToCamera));

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Animated stylised tropical ocean with shallow shelves around every island. */
export class Sea {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly geometry: THREE.PlaneGeometry;
  private time = 0;

  constructor(scene: THREE.Scene) {
    const size = GAME_CONFIG.world.seaSize;
    this.geometry = new THREE.PlaneGeometry(size, size, 120, 120);
    this.geometry.rotateX(-Math.PI / 2);
    this.geometry.computeVertexNormals();

    const sun = GAME_CONFIG.world.sunDirection;
    const islands = this.buildIslandUniforms();

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDeep: { value: new THREE.Color(0x0b5468) },
        uShallow: { value: new THREE.Color(0x2fb3bd) },
        uHorizon: { value: new THREE.Color(GAME_CONFIG.world.fogColor) },
        uSunColor: { value: new THREE.Color(0xfff4d6) },
        uSunDirection: {
          value: new THREE.Vector3(sun.x, sun.y, sun.z).normalize(),
        },
        uIslands: { value: islands },
      },
      vertexShader,
      fragmentShader,
      side: THREE.FrontSide,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = 'sea';
    this.mesh.position.y = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  update(dt: number): void {
    this.time += dt;
    this.material.uniforms.uTime.value = this.time;
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }

  private buildIslandUniforms(): THREE.Vector4[] {
    const data: THREE.Vector4[] = [
      new THREE.Vector4(
        GAME_CONFIG.harbor.center.x,
        GAME_CONFIG.harbor.center.z,
        GAME_CONFIG.harbor.shoreRadius,
        GAME_CONFIG.harbor.shelfRadius,
      ),
    ];
    for (const island of GAME_CONFIG.decorativeIslands) {
      data.push(
        new THREE.Vector4(
          island.x,
          island.z,
          island.shoreRadius,
          island.shelfRadius,
        ),
      );
    }
    // The shader has exactly four island slots.
    while (data.length < 4) {
      data.push(new THREE.Vector4(10000, 10000, 1, 1.1));
    }
    return data.slice(0, 4);
  }
}
