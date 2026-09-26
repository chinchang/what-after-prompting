import * as THREE from 'three';
import { CONFIG } from './config.js';

// Four-step ramp: gives the flat, cel-painted light bands of hand-drawn anime backgrounds.
let gradient;
function gradientMap() {
  if (!gradient) {
    const tones = new Uint8Array(CONFIG.lighting.toonBands);
    gradient = new THREE.DataTexture(tones, tones.length, 1, THREE.RedFormat);
    gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
    gradient.generateMipmaps = false;
    gradient.needsUpdate = true;
  }
  return gradient;
}

const cache = new Map();

export function toon(color, extra) {
  if (extra) {
    // Identical simple settings share one material (lets static parts merge); textures stay unique.
    const shareable = Object.values(extra).every((v) => typeof v !== 'object');
    const key = shareable ? `${color}|${JSON.stringify(extra)}` : null;
    if (key && cache.has(key)) return cache.get(key);
    // Toon materials have no flatShading switch; `part` fakes it by splitting faces.
    const { flatShading, ...rest } = extra;
    const mat = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(), ...rest });
    mat.userData.faceted = !!flatShading;
    if (key) cache.set(key, mat);
    return mat;
  }
  let mat = cache.get(color);
  if (!mat) {
    mat = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap() });
    cache.set(color, mat);
  }
  return mat;
}

export function part(parent, geometry, material, pos, rot, scale) {
  const mat = material && material.isMaterial ? material : toon(material);
  if (mat.userData?.faceted && geometry.index) {
    geometry = geometry.toNonIndexed();
    geometry.computeVertexNormals();
  }
  const mesh = new THREE.Mesh(geometry, mat);
  if (pos) mesh.position.set(...pos);
  if (rot) mesh.rotation.set(...rot);
  if (scale !== undefined && scale !== null) {
    if (typeof scale === 'number') mesh.scale.setScalar(scale);
    else mesh.scale.set(...scale);
  }
  mesh.castShadow = !mat.transparent;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function group(parent, pos, rot) {
  const g = new THREE.Group();
  if (pos) g.position.set(...pos);
  if (rot) g.rotation.set(...rot);
  parent.add(g);
  return g;
}

export function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.redraw = (fn) => {
    fn(ctx, width, height);
    texture.needsUpdate = true;
  };
  return texture;
}

// mulberry32 — deterministic randomness so every island looks the same on each visit.
export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
