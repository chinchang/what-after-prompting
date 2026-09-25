import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon, part, group, rng } from './toon.js';
import { CONFIG } from './config.js';

const DAY = CONFIG.themes.day;
const NIGHT = CONFIG.themes.night;
const { sky: SKY, grass: GRASS, clouds: CLOUDS, birds: BIRDS, pollen: POLLEN } = CONFIG;

export const shared = { uTime: { value: 0 } };

/* ---------- Sky ---------- */

export function createSky() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color(DAY.skyTop) },
      uMid: { value: new THREE.Color(DAY.skyMid) },
      uHorizon: { value: new THREE.Color(DAY.horizon) },
      uGlow: { value: new THREE.Color(DAY.glow) },
      uGlowDir: { value: new THREE.Vector3(...DAY.glowDir).normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uMid, uHorizon, uGlow, uGlowDir;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 c = mix(uHorizon, uMid, smoothstep(-0.02, 0.09, h));
        c = mix(c, uTop, smoothstep(0.09, 0.42, h));
        c = mix(uHorizon, c, smoothstep(-0.25, 0.0, h));
        float g = max(dot(d, uGlowDir), 0.0);
        c += uGlow * (pow(g, 5.0) * 0.28 + pow(g, 48.0) * 0.35);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 20), material);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  return sky;
}

/* ---------- Night sky ---------- */

export function createStars() {
  const r = rng(77);
  const n = SKY.starCount;
  const pos = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    // Upper part of the sky dome, denser toward the zenith.
    const y = 0.04 + Math.pow(r(), 0.8) * 0.96;
    const a = r() * Math.PI * 2;
    const ring = Math.sqrt(1 - y * y);
    pos.set([Math.cos(a) * ring * 520, y * 520, Math.sin(a) * ring * 520], i * 3);
    seed[i] = r();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: shared.uTime, uOpacity: { value: 0 }, uScale: { value: window.devicePixelRatio || 1 } },
    vertexShader: /* glsl */ `
      attribute float seed;
      uniform float uTime, uScale;
      varying float vTwinkle;
      void main() {
        vTwinkle = 0.55 + 0.45 * sin(uTime * (0.8 + seed * 2.2) + seed * 40.0);
        gl_PointSize = (1.2 + seed * seed * 2.6) * uScale;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying float vTwinkle;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vTwinkle * uOpacity;
        gl_FragColor = vec4(vec3(1.0, 0.97, 0.88) * a, a);
      }`,
  });
  const stars = new THREE.Points(geo, material);
  stars.frustumCulled = false;
  stars.renderOrder = -1;
  return {
    root: stars,
    setOpacity(v) {
      material.uniforms.uOpacity.value = v;
      stars.visible = v > 0.001;
    },
  };
}

export function createMoon() {
  const root = new THREE.Group();
  const dir = new THREE.Vector3(...NIGHT.glowDir).normalize();
  root.position.copy(dir.multiplyScalar(200)); // in front of the horizon clouds
  root.lookAt(0, 0, 0);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(7, 48),
    new THREE.MeshBasicMaterial({ color: 0xfff4d6, transparent: true, fog: false, depthWrite: false }),
  );
  // A few soft craters so it reads as a moon, not a lamp.
  const craterMat = new THREE.MeshBasicMaterial({ color: 0xe6dcc0, transparent: true, fog: false, depthWrite: false });
  for (const [x, y, rad] of [[-1.9, 1.6, 1.5], [2.2, -1, 1.15], [-0.6, -2.6, 0.85], [2.5, 2.5, 0.7]]) {
    const c = new THREE.Mesh(new THREE.CircleGeometry(rad, 24), craterMat);
    c.position.set(x, y, 0.05);
    disc.add(c);
  }
  const halo = document.createElement('canvas');
  halo.width = halo.height = 128;
  const ctx = halo.getContext('2d');
  const grd = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(220,230,255,0.55)');
  grd.addColorStop(0.35, 'rgba(180,200,255,0.18)');
  grd.addColorStop(1, 'rgba(180,200,255,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 128, 128);
  const haloTex = new THREE.CanvasTexture(halo);
  haloTex.colorSpace = THREE.SRGBColorSpace;
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }),
  );
  glow.scale.setScalar(60);
  root.add(glow, disc);
  const mats = [disc.material, craterMat, glow.material];
  return {
    root,
    setOpacity(v) {
      mats.forEach((m) => (m.opacity = v));
      root.visible = v > 0.001;
    },
  };
}

/* ---------- Clouds ---------- */

function puffCloud(r, base) {
  const parts = [];
  const n = 5 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) - 0.5;
    const size = (1 - Math.abs(t) * 1.15) * (0.85 + r() * 0.45);
    const g = base.clone();
    g.scale(size, size * 0.82, size);
    g.translate(t * 3.4 + (r() - 0.5) * 0.4, size * 0.3 + r() * 0.25, (r() - 0.5) * 1.3);
    parts.push(g);
  }
  // A few crowning puffs give the tall, towering cumulus shape.
  const tops = 1 + Math.floor(r() * 3);
  for (let i = 0; i < tops; i++) {
    const size = 0.7 + r() * 0.5;
    const g = base.clone();
    g.scale(size, size, size);
    g.translate((r() - 0.5) * 1.6, 0.9 + r() * 0.6, (r() - 0.5) * 0.6);
    parts.push(g);
  }
  return mergeGeometries(parts);
}

export function createClouds() {
  const root = new THREE.Group();
  const r = rng(42);

  // Towering cumulus on the horizon.
  const skyBase = new THREE.IcosahedronGeometry(1, 3);
  const sky = [];
  for (let i = 0; i < CLOUDS.horizonCount; i++) {
    const g = puffCloud(r, skyBase);
    const s = 9 + r() * 11;
    g.scale(s, s * (0.9 + r() * 0.5), s);
    const a = (i / CLOUDS.horizonCount) * Math.PI * 2 + r() * 0.3;
    const d = 230 + r() * 90;
    g.rotateY(-a + Math.PI / 2);
    g.translate(Math.cos(a) * d, -22 + r() * 30, Math.sin(a) * d);
    sky.push(g);
  }
  const skyMat = toon(0xffffff, { emissive: DAY.cloudEmissive, emissiveIntensity: DAY.cloudGlow, fog: false });
  const skyMesh = new THREE.Mesh(mergeGeometries(sky), skyMat);
  root.add(skyMesh);

  // A soft sea of clouds below the floating islands.
  const seaBase = new THREE.IcosahedronGeometry(1, 2);
  const sea = [];
  for (let i = 0; i < CLOUDS.seaCount; i++) {
    const g = puffCloud(r, seaBase);
    const s = 3 + r() * 5;
    g.scale(s, s * 0.7, s);
    const a = r() * Math.PI * 2;
    const d = 6 + Math.sqrt(r()) * 170;
    g.rotateY(r() * Math.PI);
    g.translate(Math.cos(a) * d, -13 - r() * 6, Math.sin(a) * d);
    sea.push(g);
  }
  const seaMat = toon(0xffffff, { emissive: DAY.seaEmissive, emissiveIntensity: DAY.seaGlow });
  const seaMesh = new THREE.Mesh(mergeGeometries(sea), seaMat);
  root.add(seaMesh);

  return {
    root,
    skyMat,
    seaMat,
    update(t) {
      skyMesh.rotation.y = t * CLOUDS.horizonDrift;
      seaMesh.rotation.y = -t * CLOUDS.seaDrift;
      seaMesh.position.y = Math.sin(t * 0.2) * 0.4;
    },
  };
}

/* ---------- Birds ---------- */

export function createBirds() {
  const root = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x3b4353, side: THREE.DoubleSide });
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.12, 0, 0, -0.12, 0.7, 0.05, -0.1], 3));
  wingGeo.computeVertexNormals();
  const birds = [];
  for (let i = 0; i < BIRDS.count; i++) {
    const b = new THREE.Group();
    const left = new THREE.Mesh(wingGeo, mat);
    const right = new THREE.Mesh(wingGeo, mat);
    right.scale.x = -1;
    b.add(left, right);
    b.userData = { left, right, phase: i * 0.7, radius: 34 + i * 3, height: 12 + (i % 3) * 2.5 };
    root.add(b);
    birds.push(b);
  }
  return {
    root,
    update(t) {
      for (const b of birds) {
        const { left, right, phase, radius, height } = b.userData;
        const a = t * BIRDS.speed + phase * 0.35;
        b.position.set(Math.cos(a) * radius, height + Math.sin(t * 0.6 + phase) * 0.8, Math.sin(a) * radius);
        b.rotation.y = -a;
        const flap = Math.sin(t * 7 + phase * 3) * 0.55;
        left.rotation.z = flap;
        right.rotation.z = -flap;
      }
    },
  };
}

/* ---------- Pollen / light motes ---------- */

export function createPollen(center) {
  const count = POLLEN.count;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const r = rng(9);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = center.x + (r() - 0.5) * 40;
    positions[i * 3 + 1] = center.y - 3 + r() * 14;
    positions[i * 3 + 2] = center.z + (r() - 0.5) * 24;
    seeds[i] = r() * 100;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 64;
  const ctx = sprite.getContext('2d');
  const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,250,225,1)');
  grd.addColorStop(0.35, 'rgba(255,240,200,0.6)');
  grd.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(sprite);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.PointsMaterial({
    size: DAY.motesSize,
    map: tex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    color: DAY.motesColor,
  });
  mat.userData.base = DAY.motesOpacity;
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const base = positions.slice();
  return {
    material: mat,
    root: points,
    update(t) {
      for (let i = 0; i < count; i++) {
        const s = seeds[i];
        positions[i * 3] = base[i * 3] + Math.sin(t * 0.3 + s) * 1.2 + ((t * 0.4 + s) % 10) - 5;
        positions[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.5 + s * 1.3) * 0.8;
        positions[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.25 + s) * 1.0;
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = mat.userData.base * (0.8 + Math.sin(t * 0.8) * 0.2);
    },
  };
}

/* ---------- Trees ---------- */

export function createTree(parent, pos, s = 1, seed = 1) {
  const r = rng(seed * 31 + 7);
  const g = group(parent, pos);
  g.scale.setScalar(s);
  g.rotation.y = r() * Math.PI * 2;
  part(g, new THREE.CylinderGeometry(0.11, 0.2, 1.5, 8), 0x7b573b, [0, 0.75, 0]);
  part(g, new THREE.CylinderGeometry(0.04, 0.07, 0.6, 6), 0x7b573b, [0.2, 1.3, 0], [0, 0, -0.8]);
  const greens = [0x5b9a44, 0x70b24e, 0x4c8a3c, 0x82bf58, 0x629f47];
  const blobs = [
    [0, 1.85, 0, 0.78],
    [0.5, 1.55, 0.15, 0.52],
    [-0.48, 1.6, -0.1, 0.58],
    [0.1, 2.35, -0.1, 0.52],
    [-0.15, 1.5, 0.42, 0.46],
  ];
  blobs.forEach(([x, y, z, rad], i) =>
    part(g, new THREE.IcosahedronGeometry(rad * (0.9 + r() * 0.25), 2), greens[i], [x, y, z]),
  );
  return g;
}

/* ---------- Grass ---------- */

// Sun direction on the ground plane, for the warm rim on blades that lean toward the light.
const SUN_XZ = new THREE.Vector2(CONFIG.lighting.sunOffset[0], CONFIG.lighting.sunOffset[2]).normalize();

const grassMaterial = new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  uniforms: {
    uTime: shared.uTime,
    uWind: { value: GRASS.windStrength },
    uWindSpeed: { value: GRASS.windSpeed },
    uSun: { value: SUN_XZ },
    uRoot: { value: new THREE.Color(GRASS.rootColor) },
    uDeep: { value: new THREE.Color(GRASS.deepColor) },
    uLush: { value: new THREE.Color(GRASS.lushColor) },
    uSunny: { value: new THREE.Color(GRASS.sunnyColor) },
    uPatch: { value: GRASS.patchScale },
    uBrightness: { value: 1 },
  },
  vertexShader: /* glsl */ `
    uniform float uTime, uWind, uWindSpeed;
    uniform vec2 uSun;
    varying float vH;
    varying float vSeed;
    varying float vLit;
    varying vec2 vWorld;
    void main() {
      mat4 m = modelMatrix * instanceMatrix;
      vec4 base = m * vec4(0.0, 0.0, 0.0, 1.0);
      vec4 wp = m * vec4(position, 1.0);
      float h = uv.y;
      float wind = sin(uTime * uWindSpeed + base.x * 0.35 + base.z * 0.22) * 0.6
                 + sin(uTime * uWindSpeed * 1.93 + base.x * 1.1 + base.z * 0.7) * 0.25;
      wp.x += wind * uWind * h * h;
      wp.z += wind * uWind * 0.45 * h * h;
      // Which way does this blade curl? Blades curling toward the sun catch light.
      vec2 lean = normalize((m * vec4(0.0, 0.0, 1.0, 0.0)).xz + 1e-5);
      vLit = dot(lean, uSun) * 0.5 + 0.5;
      vH = h;
      vSeed = fract(sin(dot(base.xz, vec2(12.9898, 78.233))) * 43758.5453);
      vWorld = base.xz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uRoot, uDeep, uLush, uSunny;
    uniform float uPatch, uBrightness;
    varying float vH;
    varying float vSeed;
    varying float vLit;
    varying vec2 vWorld;
    void main() {
      // Broad, soft patches of deeper and lighter green, like a painted meadow.
      vec2 q = vWorld * uPatch;
      float patchy = sin(q.x * 1.7 + sin(q.y * 1.3)) * sin(q.y * 1.9 - q.x * 0.6) * 0.5 + 0.5;
      vec3 tip = mix(uDeep, uLush, smoothstep(0.15, 0.85, patchy));
      tip = mix(tip, uSunny, vSeed * vSeed * 0.7);
      tip *= 0.94 + vSeed * 0.1;
      vec3 c = mix(uRoot, tip, smoothstep(0.0, 0.85, vH));
      // Warm rim light on the upper part of sun-facing blades.
      c += vec3(0.07, 0.06, 0.0) * smoothstep(0.45, 1.0, vH) * smoothstep(0.5, 1.0, vLit);
      gl_FragColor = vec4(c * uBrightness, 1.0);
      #include <colorspace_fragment>
    }`,
});
export const grassBrightness = grassMaterial.uniforms.uBrightness;

// A short, broad blade that curls forward (+z) and tapers to a soft point.
function bladeGeometry() {
  const { bladeWidth: w, bladeHeight: h, bladeCurl: curl } = GRASS;
  const g = new THREE.PlaneGeometry(w, h, 1, 5);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp((pos.getY(i) + h / 2) / h, 0, 1);
    const width = Math.pow(1 - t, 0.75) * (1 + 0.25 * Math.sin(t * Math.PI));
    pos.setXYZ(i, pos.getX(i) * width, t * h * (1 - curl * 0.35 * t), curl * h * t * t);
  }
  g.computeVertexNormals();
  return g;
}
const BLADE = bladeGeometry();

/* ---------- Floating island ---------- */

function hash3(x, y, z) {
  const v = Math.sin(Math.round(x * 1000) * 12.9898 + Math.round(y * 1000) * 78.233 + Math.round(z * 1000) * 37.719) * 43758.5453;
  return v - Math.floor(v);
}

const ISLAND_R = 3.2;
const FLOWER_COLORS = [0xfffaf0, 0xf6d75a, 0xf2a7c3, 0xb9a6e8, 0xffffff];

export function createIsland({ seed = 1, clear = 0.8 } = {}) {
  const r = rng(seed);
  const root = new THREE.Group();

  // Grassy top with a soft, rounded rim (listed bottom→top so normals face outward).
  const profile = [
    [3.05, -0.5], [3.2, -0.34], [3.2, -0.2], [3.05, -0.06], [2.7, 0], [0, 0],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const top = part(root, new THREE.LatheGeometry(profile, 48), 0x8cbc58);
  top.castShadow = false;

  part(root, new THREE.CylinderGeometry(3.08, 2.95, 0.45, 40), 0x8a6242, [0, -0.66, 0]).castShadow = false;

  // Rocky underside, jittered with a position hash so the seams stay closed.
  const coneH = 3.6;
  const cone = new THREE.ConeGeometry(2.95, coneH, 14, 5);
  const pos = cone.attributes.position;
  const colors = [];
  const top_ = new THREE.Color(0x9b6d48);
  const bottom = new THREE.Color(0x8f8794);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = (y + coneH / 2) / coneH; // 0 at base (top of island) → 1 at tip
    if (k > 0.01) {
      const n = hash3(x, y + seed, z) - 0.5;
      const m = hash3(z + seed, x, y) - 0.5;
      pos.setXYZ(i, x + n * 0.55 * (1 - k * 0.6), y + m * 0.35, z + m * 0.55 * (1 - k * 0.6));
    }
    c.copy(top_).lerp(bottom, Math.min(1, k * 1.4));
    colors.push(c.r, c.g, c.b);
  }
  cone.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const under = part(root, cone, toon(0xffffff, { vertexColors: true, flatShading: true }), [0, -0.85 - coneH / 2, 0], [Math.PI, 0, 0]);
  under.castShadow = false;

  // Hanging vines.
  const vines = 3 + Math.floor(r() * 3);
  for (let i = 0; i < vines; i++) {
    const a = r() * Math.PI * 2;
    const len = 1 + r() * 1.6;
    const x = Math.cos(a) * 3.1, z = Math.sin(a) * 3.1;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, -0.3, z),
      new THREE.Vector3(x * 1.02, -0.3 - len * 0.4, z * 1.02),
      new THREE.Vector3(x * 0.99 + (r() - 0.5) * 0.2, -0.3 - len * 0.75, z * 0.99),
      new THREE.Vector3(x * 0.96, -0.3 - len, z * 0.96),
    ]);
    part(root, new THREE.TubeGeometry(curve, 12, 0.035, 5), 0x5d8f41).castShadow = false;
  }

  // Grass grows in tufts: blades fan out from each clump, taller in the middle.
  const [minBlades, maxBlades] = GRASS.bladesPerTuft;
  const grass = new THREE.InstancedMesh(BLADE, grassMaterial, GRASS.enabled ? GRASS.tuftsPerIsland * maxBlades : 0);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  let placed = 0;
  for (let tuft = 0; GRASS.enabled && tuft < GRASS.tuftsPerIsland; tuft++) {
    const rad = Math.sqrt(r()) * 2.95;
    if (rad < clear && r() < 0.95) continue;
    const ca = r() * Math.PI * 2;
    const cx = Math.cos(ca) * rad;
    const cz = Math.sin(ca) * rad;
    const tuftScale = 0.75 + r() * 0.55;
    const n = minBlades + Math.floor(r() * (maxBlades - minBlades + 1));
    for (let b = 0; b < n; b++) {
      const a = r() * Math.PI * 2;
      const d = Math.pow(r(), 0.7) * GRASS.tuftRadius;
      const outer = d / GRASS.tuftRadius;
      p.set(cx + Math.cos(a) * d, 0, cz + Math.sin(a) * d);
      if (p.x * p.x + p.z * p.z > 3.0 * 3.0) continue;
      // Face the curl away from the tuft's centre, leaning outer blades further out.
      e.set(0.12 + outer * 0.35, Math.atan2(Math.cos(a), Math.sin(a)) + (r() - 0.5) * 0.5, 0, 'YXZ');
      q.setFromEuler(e);
      const k = tuftScale * (1.15 - outer * 0.45) * (0.85 + r() * 0.3);
      s.set(k * (0.9 + r() * 0.3), k, k);
      grass.setMatrixAt(placed++, m.compose(p, q, s));
    }
  }
  grass.count = placed;
  if (GRASS.enabled) root.add(grass);

  // Flowers (instanced: one draw call for stems, one for heads).
  const nFlowers = 16;
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.012, 0.24, 4), toon(0x5d8f41), nFlowers);
  const heads = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.06, 1), toon(0xffffff), nFlowers);
  for (let i = 0; i < nFlowers; i++) {
    const a = r() * Math.PI * 2;
    const rad = 2.1 + r() * 0.85;
    const h = 0.18 + r() * 0.12;
    p.set(Math.cos(a) * rad, h / 2, Math.sin(a) * rad);
    stems.setMatrixAt(i, m.compose(p, q.identity(), s.set(1, h / 0.24, 1)));
    p.y = h;
    heads.setMatrixAt(i, m.compose(p, q, s.set(1, 0.7, 1)));
    heads.setColorAt(i, new THREE.Color(FLOWER_COLORS[Math.floor(r() * FLOWER_COLORS.length)]));
  }
  root.add(stems, heads);

  // A couple of mossy rocks near the edge.
  for (let i = 0; i < 3; i++) {
    const a = r() * Math.PI * 2;
    const rad = 2.4 + r() * 0.5;
    const size = 0.15 + r() * 0.2;
    part(root, new THREE.DodecahedronGeometry(size, 0), toon(0xa9a49c, { flatShading: true }),
      [Math.cos(a) * rad, size * 0.4, Math.sin(a) * rad], [r(), r(), r()], [1, 0.7, 1]);
  }

  // Tiny floating rocks orbiting the island.
  const floaters = [];
  for (let i = 0; i < 3; i++) {
    const size = 0.18 + r() * 0.25;
    const rock = part(root, new THREE.DodecahedronGeometry(size, 0), toon(0x9d8a7d, { flatShading: true }));
    part(rock, new THREE.CylinderGeometry(size * 0.9, size * 0.9, size * 0.3, 7), 0x8cbc58, [0, size * 0.7, 0]);
    rock.userData = { a: r() * Math.PI * 2, rad: 3.9 + r() * 0.8, y: -1.2 + r() * 1.6, ph: r() * 6 };
    floaters.push(rock);
  }

  return {
    root,
    radius: ISLAND_R,
    update(t) {
      for (const f of floaters) {
        const { a, rad, y, ph } = f.userData;
        const aa = a + t * 0.05;
        f.position.set(Math.cos(aa) * rad, y + Math.sin(t * 0.8 + ph) * 0.2, Math.sin(aa) * rad);
        f.rotation.y = t * 0.2 + ph;
      }
    },
  };
}
