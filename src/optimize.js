// Merges the parts of an island that never move into one mesh per material, cutting draw calls.
// "Never moves" is detected, not declared: the island is animated at several moments and any
// mesh whose transform, visibility, material or vertices change is left alone.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const SAMPLE_TIMES = [0.37, 1.91, 3.3, 5.27, 8.6, 12.4, 17.9, 21.3, 33.7];

function snapshot(root) {
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const states = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    let visible = true;
    for (let p = o; p && p !== root; p = p.parent) visible &&= p.visible;
    const m = o.material;
    states.set(o, {
      matrix: new THREE.Matrix4().multiplyMatrices(toRoot, o.matrixWorld),
      visible,
      look: Array.isArray(m) ? 'multi' : [m.opacity, m.color?.getHex(), m.emissive?.getHex(), m.emissiveIntensity].join(),
      vertices: o.geometry.attributes.position.version,
    });
  });
  return states;
}

const sameMatrix = (a, b) => a.elements.every((v, i) => Math.abs(v - b.elements[i]) < 1e-6);

function canMerge(o) {
  const m = o.material;
  return (
    o.isMesh &&
    !o.isInstancedMesh &&
    !Array.isArray(m) &&
    !m.transparent &&
    o.children.length === 0 &&
    o.visible &&
    !o.geometry.morphAttributes.position &&
    o.matrixWorld.determinant() > 0
  );
}

/**
 * @param {THREE.Object3D} root   island root (everything below it is considered)
 * @param {(t: number) => void} animate   advances all of the island's animations to time t
 * @returns {{ before: number, after: number }} mesh counts
 */
export function mergeStaticParts(root, animate) {
  const samples = SAMPLE_TIMES.map((t) => {
    animate(t);
    return snapshot(root);
  });
  const first = samples[0];

  const groups = new Map();
  let before = 0;
  for (const [mesh, s0] of first) {
    before++;
    if (!canMerge(mesh)) continue;
    const isStatic = samples.every((snap) => {
      const s = snap.get(mesh);
      return s && s.visible === s0.visible && s.look === s0.look && s.vertices === s0.vertices && sameMatrix(s.matrix, s0.matrix);
    });
    if (!isStatic || !s0.visible) continue;
    const key = `${mesh.material.uuid}|${mesh.castShadow}|${mesh.receiveShadow}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ mesh, matrix: s0.matrix });
  }

  let removed = 0;
  let added = 0;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    // Only attributes every geometry has can be merged; mixed indexing is flattened.
    const names = Object.keys(list[0].mesh.geometry.attributes).filter((n) =>
      list.every(({ mesh }) => mesh.geometry.attributes[n]),
    );
    const allIndexed = list.every(({ mesh }) => mesh.geometry.index);
    const geometries = list.map(({ mesh, matrix }) => {
      let g = mesh.geometry.clone();
      if (!allIndexed && g.index) g = g.toNonIndexed();
      for (const n of Object.keys(g.attributes)) if (!names.includes(n)) g.deleteAttribute(n);
      g.morphAttributes = {};
      return g.applyMatrix4(matrix);
    });
    const merged = mergeGeometries(geometries, false);
    geometries.forEach((g) => g.dispose());
    if (!merged) continue;
    const { mesh: sample } = list[0];
    const mesh = new THREE.Mesh(merged, sample.material);
    mesh.castShadow = sample.castShadow;
    mesh.receiveShadow = sample.receiveShadow;
    root.add(mesh);
    added++;
    for (const { mesh: m } of list) {
      m.parent.remove(m);
      removed++;
    }
  }
  return { before, after: before - removed + added };
}
