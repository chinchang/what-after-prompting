import * as THREE from 'three';
import { toon, part, group, canvasTexture } from './toon.js';
import { createTree } from './world.js';

export const DURATIONS = {
  quick: { label: 'A quick one', hint: 'under 2 min' },
  short: { label: 'A few minutes', hint: '2–5 min' },
  long: { label: 'A long run', hint: '10 min +' },
};

/* ---------- geometry helpers ---------- */

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const cyl = (rt, rb, h, s = 18) => new THREE.CylinderGeometry(rt, rb, h, s);
const sph = (r, w = 22, h = 16) => new THREE.SphereGeometry(r, w, h);
const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const UP = V(0, 1, 0);

function rod(parent, a, b, r, color) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const mesh = part(parent, cyl(r, r, dir.length(), 8), color);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  return mesh;
}

function softMat(color, opacity) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
}

// A small round-headed person, loosely in the spirit of hand-drawn anime extras.
function buddy(parent, { shirt = 0x4f7cac, pants = 0x3d4a5c, skin = 0xf3d2b3, hair = 0x3b2a20 } = {}) {
  const root = group(parent);
  const legs = [-1, 1].map((s) => {
    const p = group(root, [s * 0.1, 0.42, 0]);
    part(p, new THREE.CapsuleGeometry(0.075, 0.24, 4, 10), pants, [0, -0.2, 0]);
    part(p, sph(0.08, 12, 10), 0x5a3b2a, [0, -0.39, 0.04], null, [1, 0.6, 1.4]);
    return p;
  });
  part(root, new THREE.CapsuleGeometry(0.19, 0.28, 6, 14), shirt, [0, 0.7, 0]);
  const head = group(root, [0, 1.12, 0]);
  part(head, sph(0.23, 26, 20), skin);
  part(head, new THREE.SphereGeometry(0.245, 26, 16, 0, Math.PI * 2, 0, Math.PI * 0.52), hair, [0, 0.02, -0.02], [-0.3, 0, 0]);
  for (const s of [-1, 1]) {
    part(head, sph(0.028, 10, 8), 0x2a2420, [s * 0.08, -0.01, 0.207]);
    part(head, sph(0.045, 10, 8), 0xf2a08c, [s * 0.13, -0.07, 0.17], null, [1, 0.6, 0.5]);
  }
  const arms = [-1, 1].map((s) => {
    const p = group(root, [s * 0.24, 0.92, 0]);
    part(p, new THREE.CapsuleGeometry(0.06, 0.24, 4, 10), shirt, [0, -0.17, 0]);
    part(p, sph(0.06, 10, 8), skin, [0, -0.35, 0]);
    return p;
  });
  arms[0].rotation.z = -0.12;
  arms[1].rotation.z = 0.12;
  return { root, legs, arms, head };
}

function steamPuffs(parent, origins, color = 0xffffff) {
  const puffs = [];
  origins.forEach((o, j) => {
    for (let i = 0; i < 4; i++) {
      const m = part(parent, sph(0.07, 12, 10), softMat(color, 0.6));
      m.userData = { o, ph: i / 4 + j * 0.13 };
      puffs.push(m);
    }
  });
  return (t) => {
    for (const m of puffs) {
      const { o, ph } = m.userData;
      const k = (t * 0.35 + ph) % 1;
      m.position.set(o[0] + Math.sin(k * 6 + ph * 9) * 0.08, o[1] + k * 0.9, o[2]);
      m.scale.setScalar(0.6 + k * 1.6);
      m.material.opacity = 0.55 * (1 - k) * Math.min(1, k * 6);
    }
  };
}

// Sound timing helpers: fire once when a value crosses zero upward, or when a 0→1 cycle wraps.
function rising() {
  let prev = 0;
  return (v) => {
    const hit = prev <= 0 && v > 0;
    prev = v;
    return hit;
  };
}
function wrapped() {
  let prev = 0;
  return (k) => {
    const hit = k < prev;
    prev = k;
    return hit;
  };
}
const chance = (perSecond, dt) => Math.random() < perSecond * dt;

/* ---------- the activities ---------- */

export const ACTIVITIES = [
  {
    id: 'sip',
    title: 'Take a sip of water',
    blurb: 'The tokens are streaming. So should the water. One slow sip — maybe two.',
    tip: "Sip, don't chug. You have time.",
    duration: 'quick',
    time: '~30 sec',
    build(g) {
      createTree(g, [-1.7, 0, -1.3], 0.95, 1);
      part(g, cyl(0.72, 0.88, 0.85, 16), 0x9c6b43, [0.2, 0.425, 0.2]);
      part(g, cyl(0.73, 0.73, 0.05, 24), 0xe0bb85, [0.2, 0.87, 0.2]);
      part(g, new THREE.TorusGeometry(0.4, 0.015, 6, 28), 0xb8905e, [0.2, 0.895, 0.2], [Math.PI / 2, 0, 0]);
      part(g, cyl(0.19, 0.16, 0.36, 22), 0x5bb8e6, [0.2, 1.08, 0.2]);
      part(g, cyl(0.215, 0.18, 0.56, 22, 1), toon(0xdff4ff, { transparent: true, opacity: 0.4 }), [0.2, 1.18, 0.2]);
      part(g, cyl(0.12, 0.12, 0.025, 18), 0xf5d84a, [0.33, 1.42, 0.2], [0, 0, 1.2]);
      // A friendly droplet hovering above the glass.
      const drop = group(g, [0.2, 2.05, 0.2]);
      const dropMat = toon(0x74cbf2, { emissive: 0x2a6f99, emissiveIntensity: 0.25 });
      part(drop, sph(0.2), dropMat);
      part(drop, new THREE.ConeGeometry(0.175, 0.3, 22), dropMat, [0, 0.22, 0]);
      for (const s of [-1, 1]) part(drop, sph(0.025, 8, 6), 0x1d3140, [s * 0.07, 0.02, 0.18]);
      const bob = rising();
      g.userData.sound = (t, dt, sfx) => {
        if (bob(Math.sin(t * 2))) sfx.drip(0.07, 1.25, 0.7);
        if (chance(0.06, dt)) sfx.clink(0.07, 0.8);
        if (chance(0.08, dt)) sfx.chirp(-0.6, 0.7);
      };
      return (t) => {
        drop.position.y = 2.05 + Math.sin(t * 2) * 0.12;
        drop.rotation.y = Math.sin(t * 0.7) * 0.5;
        drop.rotation.z = Math.sin(t * 1.3) * 0.1;
      };
    },
  },
  {
    id: 'refill',
    title: 'Refill your water bottle',
    blurb: 'Walk it to the tap, fill it to the brim, and walk back a slightly more hydrated person.',
    tip: 'Fill it all the way. Future you is thirsty.',
    duration: 'short',
    time: '~2 min',
    build(g) {
      const well = group(g, [-0.3, 0, -0.2]);
      part(well, cyl(0.85, 0.92, 0.8, 16), toon(0xaaa39a, { flatShading: true }), [0, 0.4, 0]);
      part(well, new THREE.TorusGeometry(0.8, 0.1, 8, 20), toon(0xc4beb4, { flatShading: true }), [0, 0.8, 0], [Math.PI / 2, 0, 0]);
      part(well, cyl(0.72, 0.72, 0.02, 20), toon(0x3d86a8, { emissive: 0x16445a, emissiveIntensity: 0.4 }), [0, 0.79, 0]);
      for (const s of [-1, 1]) part(well, box(0.12, 1.5, 0.12), 0x7b573b, [s * 0.82, 1.4, 0]);
      part(well, cyl(0.05, 0.05, 1.8, 8), 0x7b573b, [0, 1.95, 0], [0, 0, Math.PI / 2]);
      part(well, new THREE.ConeGeometry(1.25, 0.7, 4), toon(0xc9573a, { flatShading: true }), [0, 2.45, 0], [0, Math.PI / 4, 0]);
      const swing = group(well, [0, 1.95, 0]);
      part(swing, cyl(0.012, 0.012, 0.55, 5), 0xd9c9a3, [0, -0.28, 0]);
      part(swing, cyl(0.17, 0.13, 0.22, 14), 0x9c6b43, [0, -0.64, 0]);
      part(swing, new THREE.TorusGeometry(0.17, 0.02, 6, 16), 0x555555, [0, -0.56, 0], [Math.PI / 2, 0, 0]);
      const bottle = group(g, [1.35, 0, 0.75]);
      part(bottle, new THREE.CapsuleGeometry(0.17, 0.42, 6, 18), 0x4a8fd1, [0, 0.4, 0]);
      part(bottle, cyl(0.176, 0.176, 0.14, 18), 0xf3e7cc, [0, 0.38, 0]);
      part(bottle, cyl(0.1, 0.11, 0.1, 14), 0x2f5d4a, [0, 0.83, 0]);
      part(bottle, new THREE.TorusGeometry(0.06, 0.018, 6, 12), 0x2f5d4a, [0, 0.92, 0]);
      const swingL = rising();
      const swingR = rising();
      const hopA = rising();
      const hopB = rising();
      g.userData.sound = (t, dt, sfx) => {
        const c = Math.cos(t * 1.3);
        if ((swingL(c) || swingR(-c)) && Math.random() < 0.7) sfx.creak(-0.1, 0.8);
        if (chance(0.35, dt)) sfx.drip(-0.1, 0.8 + Math.random() * 0.6, 0.6);
        const h = Math.sin(t * 2.2);
        if (hopA(h) || hopB(-h)) sfx.click(0.45, 900, 0.6);
      };
      return (t) => {
        swing.rotation.z = Math.sin(t * 1.3) * 0.12;
        swing.rotation.x = Math.sin(t * 0.9) * 0.06;
        bottle.position.y = Math.abs(Math.sin(t * 2.2)) * 0.08;
        bottle.rotation.z = Math.sin(t * 2.2) * 0.06;
      };
    },
  },
  {
    id: 'stretch',
    title: 'Stand up and stretch',
    blurb: 'Reach for the ceiling, roll your shoulders, un-shrimp your spine. Your chair will wait.',
    tip: 'Arms up, deep breath in, slow fold forward.',
    duration: 'quick',
    time: '~1 min',
    clear: 1.4,
    build(g) {
      part(g, box(1.0, 0.04, 1.9), 0x5fb3a3, [0, 0.02, 0.2]);
      part(g, cyl(0.13, 0.13, 1.0, 18), 0x4e9d8e, [0, 0.13, -0.83], [0, 0, Math.PI / 2]);
      createTree(g, [1.9, 0, -1.2], 0.85, 3);
      for (const [x, z, h] of [[-1.6, -0.4, 1.1], [-1.9, 0.5, 0.9]]) {
        const f = group(g, [x, 0, z]);
        part(f, cyl(0.025, 0.035, h, 6), 0x5d8f41, [0, h / 2, 0]);
        part(f, cyl(0.2, 0.2, 0.04, 16), 0xf2c43d, [0, h, 0.02], [Math.PI / 2 - 0.3, 0, 0]);
        part(f, cyl(0.1, 0.1, 0.05, 12), 0x6b4424, [0, h, 0.04], [Math.PI / 2 - 0.3, 0, 0]);
      }
      const b = buddy(g, { shirt: 0xe07b54 });
      b.root.position.set(0, 0.04, 0.35);
      const up = rising();
      const down = rising();
      g.userData.sound = (t, dt, sfx) => {
        const c = Math.cos(t * 1.4);
        if (up(c)) sfx.slide(0, 2, 300, 540, 1);
        if (down(-c)) sfx.slide(0, 2, 520, 320, 0.6);
        if (chance(0.05, dt)) sfx.click(0.05, 1800, 0.8);
      };
      return (t) => {
        const k = (Math.sin(t * 1.4) + 1) / 2;
        const e = k * k * (3 - 2 * k);
        b.arms[0].rotation.z = -(0.15 + e * 2.75);
        b.arms[1].rotation.z = 0.15 + e * 2.75;
        b.root.scale.y = 1 + e * 0.05;
        b.root.rotation.z = Math.sin(t * 0.7) * 0.08 * e;
        b.head.rotation.x = -e * 0.25;
      };
    },
  },
  {
    id: 'watch',
    title: 'Watch one from Watch Later',
    blurb: 'That video you saved three weeks ago? Its moment has come. Just the one.',
    tip: 'One video. The model will be done before the outro.',
    duration: 'long',
    time: '~10 min',
    clear: 1.5,
    build(g) {
      const tv = group(g, [0, 0, -0.55]);
      part(tv, box(1.7, 0.5, 0.75), 0x8a5a3b, [0, 0.25, 0]);
      part(tv, box(1.5, 1.05, 0.95), 0xe9dcc0, [0, 1.03, 0]);
      part(tv, box(1.04, 0.8, 0.02), 0x5e5446, [-0.17, 1.03, 0.475]);
      let progress = 0.1;
      const draw = (ctx, w, h) => {
        const grd = ctx.createLinearGradient(0, 0, 0, h);
        grd.addColorStop(0, '#9fd6f2');
        grd.addColorStop(1, '#f7d0b0');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#7fb65a';
        ctx.beginPath();
        ctx.ellipse(70, h, 130, 60, 0, 0, Math.PI * 2);
        ctx.ellipse(210, h + 10, 120, 55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e8553f';
        ctx.beginPath();
        ctx.roundRect(w / 2 - 36, h / 2 - 30, 72, 52, 14);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(w / 2 - 9, h / 2 - 16);
        ctx.lineTo(w / 2 + 15, h / 2 - 4);
        ctx.lineTo(w / 2 - 9, h / 2 + 8);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect(18, h - 18, w - 36, 6);
        ctx.fillStyle = '#e8553f';
        ctx.fillRect(18, h - 18, (w - 36) * progress, 6);
      };
      const tex = canvasTexture(256, 192, draw);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.72), new THREE.MeshBasicMaterial({ map: tex }));
      screen.position.set(-0.17, 1.03, 0.49);
      tv.add(screen);
      for (const y of [1.25, 0.95]) part(tv, cyl(0.07, 0.07, 0.06, 14), 0x8a5a3b, [0.56, y, 0.49], [Math.PI / 2, 0, 0]);
      for (const s of [-1, 1]) {
        rod(tv, V(0, 1.55, 0), V(s * 0.45, 2.25, -0.1), 0.015, 0x6b6b6b);
        part(tv, sph(0.045, 10, 8), 0xe8553f, [s * 0.45, 2.25, -0.1]);
      }
      part(g, sph(0.62, 24, 16), 0xe3b34c, [0, 0.26, 1.1], null, [1, 0.45, 0.9]);
      const bowl = group(g, [0.95, 0, 0.8]);
      part(bowl, cyl(0.28, 0.18, 0.2, 18), 0xd2573d, [0, 0.1, 0]);
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4;
        part(bowl, new THREE.IcosahedronGeometry(0.06, 0), 0xfff6dc, [Math.cos(a) * 0.14 * (i % 3 ? 1 : 0.3), 0.22 + (i % 2) * 0.05, Math.sin(a) * 0.14]);
      }
      let last = 0;
      const jingle = rising();
      g.userData.sound = (t, dt, sfx) => {
        if (jingle(Math.sin(t * 0.9))) sfx.tv(-0.05, 1);
        if (chance(0.45, dt)) sfx.pop(0.4, 0.5 + Math.random() * 0.5);
      };
      return (t) => {
        screen.material.color.setScalar(0.92 + Math.sin(t * 13) * 0.03 + Math.sin(t * 3.1) * 0.05);
        if (t - last > 0.25) {
          last = t;
          progress = (t * 0.02) % 1;
          tex.redraw(draw);
        }
      };
    },
  },
  {
    id: 'walk',
    title: 'Take a short walk',
    blurb: 'Big refactor? Long agent run? Go around the block. The best ideas tend to show up on walks.',
    tip: 'Leave the phone. Notice three things you never noticed.',
    duration: 'long',
    time: '10–15 min',
    build(g) {
      const curve = new THREE.CatmullRomCurve3([V(-2.5, 0, 1.3), V(-1, 0, 1.5), V(0.3, 0, 0.5), V(1.2, 0, -0.6), V(2.4, 0, -1.3)]);
      for (let i = 0; i <= 10; i++) {
        const p = curve.getPointAt(i / 10);
        part(g, cyl(0.26, 0.28, 0.06, 10), toon(0xdcd2bb, { flatShading: true }), [p.x, 0.03, p.z], [0, i, 0], [1, 1, 0.8]);
      }
      createTree(g, [1.7, 0, 1.2], 0.9, 5);
      createTree(g, [-1.6, 0, -1.3], 1.05, 6);
      const sign = group(g, [-0.5, 0, -0.35]);
      part(sign, cyl(0.05, 0.06, 1.4, 8), 0x7b573b, [0, 0.7, 0]);
      part(sign, box(0.8, 0.2, 0.05), 0xe9c98a, [0.28, 1.2, 0], [0, 0.3, 0.05]);
      part(sign, box(0.7, 0.18, 0.05), 0xe9c98a, [-0.22, 0.92, 0.02], [0, -0.4, -0.06]);
      const b = buddy(g, { shirt: 0x6d9a4a, hair: 0x5a3a22 });
      b.root.scale.setScalar(0.8);
      const hat = group(b.head, [0, 0.17, 0]);
      part(hat, cyl(0.34, 0.34, 0.03, 20), 0xe6cf8f);
      part(hat, cyl(0.17, 0.2, 0.14, 16), 0xe6cf8f, [0, 0.07, 0]);
      part(hat, cyl(0.205, 0.205, 0.04, 16), 0xc9573a, [0, 0.03, 0]);
      const stepA = rising();
      const stepB = rising();
      g.userData.sound = (t, dt, sfx) => {
        const s = Math.sin(t * 7);
        const pan = b.root.position.x / 3;
        if (stepA(s)) sfx.step(pan, 0.9);
        if (stepB(-s)) sfx.step(pan, 0.7);
        if (chance(0.15, dt)) sfx.chirp(Math.random() < 0.5 ? -0.7 : 0.6, 0.8);
      };
      return (t) => {
        const u = (Math.sin(t * 0.22) + 1) / 2;
        const dir = Math.cos(t * 0.22) >= 0 ? 1 : -1;
        const p = curve.getPointAt(u);
        const tan = curve.getTangentAt(u).multiplyScalar(dir);
        b.root.position.set(p.x, 0.06 + Math.abs(Math.sin(t * 7)) * 0.04, p.z);
        b.root.rotation.y = Math.atan2(tan.x, tan.z);
        const sw = Math.sin(t * 7) * 0.6;
        b.legs[0].rotation.x = sw;
        b.legs[1].rotation.x = -sw;
        b.arms[0].rotation.x = -sw * 0.7;
        b.arms[1].rotation.x = sw * 0.7;
      };
    },
  },
  {
    id: 'plants',
    title: 'Water your plants',
    blurb: "They've been quietly photosynthesising this whole time. Return the favour.",
    tip: 'Check the soil first — a finger deep.',
    duration: 'short',
    time: '~2 min',
    build(g) {
      const pot = (x, z, r, h) => {
        const p = group(g, [x, 0, z]);
        part(p, cyl(r, r * 0.75, h, 18), 0xc66b3d, [0, h / 2, 0]);
        part(p, new THREE.TorusGeometry(r, 0.05, 8, 20), 0xd98150, [0, h, 0], [Math.PI / 2, 0, 0]);
        part(p, cyl(r * 0.92, r * 0.92, 0.02, 16), 0x5a3f2c, [0, h - 0.03, 0]);
        return p;
      };
      const a = pot(-1.15, 0.2, 0.36, 0.55);
      part(a, new THREE.IcosahedronGeometry(0.38, 2), 0x5f9e4a, [0, 0.8, 0]);
      part(a, new THREE.IcosahedronGeometry(0.28, 2), 0x78b556, [0.2, 0.95, 0.12]);
      part(a, new THREE.IcosahedronGeometry(0.25, 2), 0x6aa84f, [-0.2, 0.98, -0.05]);
      const b = pot(0.05, -0.6, 0.42, 0.7);
      part(b, cyl(0.03, 0.04, 0.9, 6), 0x4d7f3a, [0, 1.1, 0]);
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const leaf = group(b, [0, 1.0 + (i % 3) * 0.18, 0], [0, ang, 0]);
        part(leaf, sph(0.3, 16, 10), 0x3f8a4a, [0.32, 0.05, 0], [0, 0, 0.35], [1, 0.08, 0.55]);
      }
      const c = pot(1.1, 0.35, 0.3, 0.45);
      part(c, new THREE.CapsuleGeometry(0.17, 0.45, 6, 14), 0x6fa45b, [0, 0.78, 0]);
      part(c, new THREE.CapsuleGeometry(0.08, 0.18, 4, 10), 0x6fa45b, [0.2, 0.85, 0], [0, 0, -0.9]);
      part(c, sph(0.08, 12, 10), 0xf2a7c3, [0, 1.13, 0]);
      // A floating watering can, as if held by an invisible helper.
      const can = group(g, [-0.35, 1.75, 0.2], [0, 0, 0.5]);
      part(can, cyl(0.28, 0.3, 0.45, 20), 0x6b9bc3);
      part(can, cyl(0.29, 0.29, 0.05, 20), 0x5584ad, [0, 0.2, 0]);
      const spout = group(can, [-0.25, 0.05, 0], [0, 0, 1.0]);
      part(spout, cyl(0.035, 0.06, 0.6, 10), 0x6b9bc3, [0, 0.3, 0]);
      part(spout, cyl(0.09, 0.05, 0.08, 12), 0x5584ad, [0, 0.62, 0]);
      const tip = new THREE.Object3D();
      tip.position.set(0, 0.66, 0);
      spout.add(tip);
      part(can, new THREE.TorusGeometry(0.2, 0.035, 8, 18, Math.PI), 0x5584ad, [0.08, 0.22, 0]);
      const drops = [];
      const dropMat = toon(0x8fd4f5, { emissive: 0x3a86b0, emissiveIntensity: 0.3 });
      for (let i = 0; i < 9; i++) {
        const d = part(g, sph(0.035, 8, 6), dropMat, null, null, [1, 1.6, 1]);
        d.userData.ph = i / 9;
        drops.push(d);
      }
      const tipPos = new THREE.Vector3();
      g.userData.sound = (t, dt, sfx) => {
        if (can.rotation.z > 0.42 && chance(4, dt)) sfx.drip(tipPos.x / 3, 1.3 + Math.random() * 0.6, 0.35);
      };
      return (t) => {
        can.rotation.z = 0.5 + Math.sin(t * 1.2) * 0.12;
        can.position.y = 1.75 + Math.sin(t * 0.9) * 0.06;
        g.updateMatrixWorld();
        tip.getWorldPosition(tipPos);
        g.worldToLocal(tipPos);
        for (const d of drops) {
          const k = (t * 1.4 + d.userData.ph) % 1;
          d.position.set(tipPos.x + Math.sin(d.userData.ph * 40) * 0.05, tipPos.y - k * k * (tipPos.y - 0.7), tipPos.z + Math.cos(d.userData.ph * 30) * 0.05);
          d.visible = can.rotation.z > 0.42;
        }
      };
    },
  },
  {
    id: 'tea',
    title: 'Brew a cup of tea',
    blurb: 'Kettle on, leaves in, three minutes of steep. Almost exactly one agentic loop.',
    tip: "Watch the leaves unfurl. That's the whole job.",
    duration: 'short',
    time: '~5 min',
    clear: 1.4,
    build(g) {
      part(g, cyl(1.0, 1.0, 0.1, 28), 0x8a5a3b, [0, 0.5, 0]);
      part(g, new THREE.TorusGeometry(1.0, 0.05, 8, 32), 0x7a4d31, [0, 0.5, 0], [Math.PI / 2, 0, 0]);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        part(g, box(0.1, 0.45, 0.1), 0x7a4d31, [Math.cos(a) * 0.65, 0.225, Math.sin(a) * 0.65]);
      }
      part(g, box(0.85, 0.12, 0.85), 0xb84a3a, [0, 0.06, 1.35], [0, 0.1, 0]);
      part(g, box(0.8, 0.12, 0.8), 0x46618f, [-1.45, 0.06, 0.2], [0, 0.4, 0]);
      const pot = group(g, [-0.05, 0.55, -0.15]);
      part(pot, sph(0.32, 26, 20), 0x5e7f73, [0, 0.26, 0], null, [1, 0.8, 1]);
      part(pot, cyl(0.16, 0.18, 0.06, 18), 0x4c6a5f, [0, 0.52, 0]);
      part(pot, sph(0.05, 10, 8), 0x3a3a3a, [0, 0.58, 0]);
      part(pot, cyl(0.035, 0.07, 0.38, 10), 0x5e7f73, [0.37, 0.36, 0], [0, 0, -0.9]);
      part(pot, new THREE.TorusGeometry(0.24, 0.022, 8, 20, Math.PI), 0xc9a86a, [0, 0.5, 0], [0, 0.35, 0]);
      const cups = [[0.55, 0.3], [-0.5, 0.4]];
      for (const [x, z] of cups) {
        part(g, cyl(0.11, 0.08, 0.14, 16), 0xf2ead6, [x, 0.62, z]);
        part(g, cyl(0.1, 0.1, 0.01, 16), 0x9a8a3a, [x, 0.685, z]);
      }
      createTree(g, [1.8, 0, -1.3], 0.8, 8);
      const lantern = group(g, [-1.7, 0, -1.0]);
      part(lantern, cyl(0.04, 0.05, 1.1, 8), 0x3e3a36, [0, 0.55, 0]);
      part(lantern, cyl(0.2, 0.2, 0.34, 14), toon(0xfff0c8, { emissive: 0xffc56b, emissiveIntensity: 0.7 }), [0, 1.3, 0]);
      part(lantern, new THREE.ConeGeometry(0.28, 0.16, 14), 0x3e3a36, [0, 1.55, 0]);
      const steam = steamPuffs(g, [[0.35, 1.05, -0.15], [0.55, 0.72, 0.3], [-0.5, 0.72, 0.4]]);
      const puff = wrapped();
      g.userData.sound = (t, dt, sfx) => {
        if (puff((t * 0.35) % 1)) sfx.hiss(0.1, 1.4, 1);
        if (chance(0.06, dt)) sfx.clink(Math.random() < 0.5 ? 0.25 : -0.2, 1);
      };
      return (t) => {
        steam(t);
        pot.rotation.y = Math.sin(t * 0.4) * 0.1;
      };
    },
  },
  {
    id: 'eyes',
    title: 'Rest your eyes',
    blurb: 'Look at something twenty feet away for twenty seconds. Your eyes read a lot of diffs today.',
    tip: 'Find the farthest thing you can see. Hold it there.',
    duration: 'quick',
    time: '~20 sec',
    build(g) {
      const win = group(g, [0, 0, -0.2]);
      const wood = 0xf2e6cc;
      const W = 1.7, H = 1.9, y0 = 0.35;
      part(win, box(W + 0.2, 0.14, 0.2), wood, [0, y0 + H + 0.07, 0]);
      part(win, box(W + 0.35, 0.1, 0.35), wood, [0, y0 - 0.02, 0.05]);
      for (const s of [-1, 1]) part(win, box(0.14, H, 0.2), wood, [s * (W / 2 + 0.03), y0 + H / 2, 0]);
      part(win, box(0.06, H, 0.08), wood, [0, y0 + H / 2, 0]);
      part(win, box(W, 0.06, 0.08), wood, [0, y0 + H * 0.55, 0]);
      for (const s of [-1, 1]) part(win, box(0.12, y0, 0.3), 0x8a6242, [s * 0.7, y0 / 2 - 0.02, 0]);
      const curtains = [];
      for (const s of [-1, 1]) {
        const geo = new THREE.PlaneGeometry(0.5, 1.75, 10, 1);
        geo.translate(0, -0.875, 0);
        const c = part(win, geo, toon(0xf4c2bc, { side: THREE.DoubleSide }), [s * 0.62, y0 + H - 0.05, 0.16]);
        c.userData.base = geo.attributes.position.array.slice();
        c.userData.s = s;
        curtains.push(c);
      }
      part(win, cyl(0.03, 0.03, W + 0.4, 8), 0x8a6242, [0, y0 + H - 0.04, 0.16], [0, 0, Math.PI / 2]);
      // Tiny mountains to gaze at through the frame.
      for (const [x, z, h] of [[-0.4, -2.2, 1.4], [0.6, -2.4, 1.9], [1.4, -2.0, 1.1]]) {
        part(g, new THREE.ConeGeometry(h * 0.55, h, 7), toon(0x7c8fb0, { flatShading: true }), [x, h / 2, z]);
        part(g, new THREE.ConeGeometry(h * 0.2, h * 0.36, 7), 0xfafafa, [x, h * 0.82 + 0.005, z]);
      }
      const glass = group(g, [1.45, 0, 0.9]);
      part(glass, cyl(0.28, 0.28, 0.06, 14), 0x8a5a3b, [0, 0.03, 0]);
      part(glass, cyl(0.28, 0.28, 0.06, 14), 0x8a5a3b, [0, 0.83, 0]);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        part(glass, cyl(0.025, 0.025, 0.8, 6), 0x8a5a3b, [Math.cos(a) * 0.22, 0.43, Math.sin(a) * 0.22]);
      }
      const sandMat = toon(0xe8c77a);
      part(glass, new THREE.ConeGeometry(0.17, 0.35, 16), toon(0xe6f4ff, { transparent: true, opacity: 0.45 }), [0, 0.62, 0], [Math.PI, 0, 0]);
      part(glass, new THREE.ConeGeometry(0.17, 0.35, 16), toon(0xe6f4ff, { transparent: true, opacity: 0.45 }), [0, 0.24, 0]);
      const sandTop = part(glass, new THREE.ConeGeometry(0.12, 0.2, 16), sandMat, [0, 0.62, 0], [Math.PI, 0, 0]);
      const sandBot = part(glass, new THREE.ConeGeometry(0.14, 0.14, 16), sandMat, [0, 0.14, 0]);
      const flipGlass = wrapped();
      const breeze = rising();
      g.userData.sound = (t, dt, sfx) => {
        if (flipGlass((t / 20) % 1)) {
          sfx.chime(0.5, 88, 1);
          setTimeout(() => sfx.chime(0.5, 95, 0.7), 220);
        }
        if (breeze(Math.sin(t * 0.8))) sfx.gust(0, 3, 1);
      };
      return (t) => {
        for (const c of curtains) {
          const arr = c.geometry.attributes.position.array;
          const base = c.userData.base;
          for (let i = 0; i < arr.length; i += 3) {
            const drop = -base[i + 1] / 1.75;
            arr[i + 2] = Math.sin(base[i] * 14 + t * 2 + c.userData.s) * 0.05 * (0.3 + drop) + drop * drop * 0.12 * (1 + Math.sin(t * 0.8));
          }
          c.geometry.attributes.position.needsUpdate = true;
          c.geometry.computeVertexNormals();
        }
        const k = (t / 20) % 1;
        sandTop.scale.setScalar(Math.max(0.05, 1 - k));
        sandBot.scale.setScalar(0.3 + k * 0.9);
      };
    },
  },
  {
    id: 'cat',
    title: 'Pet the cat',
    blurb: "Or the dog. Or a houseplant, gently. Something alive that isn't a terminal.",
    tip: 'Slow blinks work on cats. Try one.',
    duration: 'quick',
    time: '~1 min',
    clear: 1.2,
    build(g) {
      createTree(g, [-1.6, 0, -1.2], 1.1, 11);
      part(g, cyl(0.85, 0.9, 0.2, 28), 0x3f5a8a, [0, 0.1, 0.1]);
      part(g, new THREE.TorusGeometry(0.87, 0.06, 8, 28), 0x344b75, [0, 0.2, 0.1], [Math.PI / 2, 0, 0]);
      const cat = group(g, [0, 0.2, 0.1]);
      const fur = 0xe79a52;
      const body = part(cat, sph(0.45, 26, 20), fur, [0, 0.25, -0.05], null, [1.25, 0.65, 1]);
      for (const x of [-0.2, 0, 0.2]) part(body, sph(0.18, 12, 8), 0xc97a3a, [x, 0.36, -0.12], null, [0.35, 0.3, 1]);
      const head = group(cat, [0.42, 0.33, 0.3]);
      part(head, sph(0.27, 24, 18), fur, null, null, [1.05, 0.92, 1]);
      part(head, sph(0.12, 14, 10), 0xfff4e6, [0, -0.08, 0.2], null, [1.3, 0.8, 0.8]);
      part(head, sph(0.03, 8, 6), 0xd46f7a, [0, -0.03, 0.27]);
      for (const s of [-1, 1]) {
        part(head, new THREE.ConeGeometry(0.1, 0.18, 4), fur, [s * 0.15, 0.24, -0.02], [0, 0, -s * 0.3]);
        part(head, box(0.08, 0.014, 0.01), 0x3a2a22, [s * 0.1, 0.03, 0.255], [0, s * 0.3, s * 0.15]);
      }
      const tailCurve = new THREE.CatmullRomCurve3([V(-0.5, 0.15, -0.1), V(-0.55, 0.12, 0.3), V(-0.2, 0.1, 0.52), V(0.15, 0.1, 0.5)]);
      const tail = part(cat, new THREE.TubeGeometry(tailCurve, 24, 0.07, 8), fur);
      part(g, sph(0.2, 18, 14), 0xef8fa8, [1.0, 0.2, 0.9]);
      part(g, new THREE.TorusGeometry(0.2, 0.012, 6, 24), 0xd2728e, [1.0, 0.2, 0.9], [0.4, 0.8, 0]);
      part(g, new THREE.TorusGeometry(0.2, 0.012, 6, 24), 0xd2728e, [1.0, 0.2, 0.9], [1.3, 0.2, 0.4]);
      const zTex = canvasTexture(64, 64, (ctx) => {
        ctx.fillStyle = '#5c6a8a';
        ctx.font = 'bold 50px "Shippori Mincho B1", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('z', 32, 34);
      });
      const zs = [0, 1, 2].map((i) => {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTex, transparent: true, depthWrite: false }));
        s.userData.ph = i / 3;
        g.add(s);
        return s;
      });
      const breath = rising();
      g.userData.sound = (t, dt, sfx) => {
        if (breath(Math.sin(t * 1.8))) sfx.purr(0.1, 1.6, 1);
        if (chance(0.05, dt)) sfx.chirp(-0.6, 0.6);
      };
      return (t) => {
        const br = Math.sin(t * 1.8);
        body.scale.set(1.25 + br * 0.02, 0.65 + br * 0.03, 1);
        head.position.y = 0.33 + br * 0.012;
        tail.rotation.y = Math.sin(t * 0.9) * 0.08;
        for (const s of zs) {
          const k = (t * 0.25 + s.userData.ph) % 1;
          s.position.set(0.6 + k * 0.5, 0.9 + k * 1.1, 0.4);
          s.scale.setScalar(0.15 + k * 0.25);
          s.material.opacity = Math.sin(k * Math.PI);
        }
      };
    },
  },
  {
    id: 'read',
    title: 'Read a few pages',
    blurb: 'The book on your desk has been a coaster for too long. Even two pages count.',
    tip: 'Pick up wherever the bookmark left you.',
    duration: 'short',
    time: '~5 min',
    build(g) {
      createTree(g, [0.3, 0, -1.3], 1.35, 13);
      const colors = [0x3f5a8a, 0xc9573a, 0xe3b34c, 0x5f8f4a];
      colors.forEach((c, i) => {
        const w = 0.75 - i * 0.05;
        part(g, box(w, 0.13, 0.5), c, [-1.2, 0.065 + i * 0.13, 0.35], [0, (i % 2 ? 0.2 : -0.1), 0]);
        part(g, box(w - 0.04, 0.1, 0.46), 0xfaf3e2, [-1.18, 0.065 + i * 0.13, 0.35], [0, (i % 2 ? 0.2 : -0.1), 0]);
      });
      part(g, cyl(0.09, 0.08, 0.16, 14), 0xf2ead6, [-1.15, 0.6, 0.35]);
      const book = group(g, [0.45, 0.02, 0.75], [0, -0.25, 0]);
      for (const s of [-1, 1]) {
        part(book, box(0.5, 0.03, 0.66), 0x2f6f73, [s * 0.26, 0.015, 0], [0, 0, s * 0.08]);
        part(book, box(0.46, 0.06, 0.6), 0xfdf7e8, [s * 0.24, 0.05, 0], [0, 0, s * 0.08]);
      }
      part(book, box(0.03, 0.002, 0.5), 0xc9573a, [0.05, 0.085, 0.3], [0.3, 0, 0]);
      const flip = group(book, [0, 0.085, 0]);
      const pageGeo = new THREE.PlaneGeometry(0.44, 0.58);
      pageGeo.rotateX(-Math.PI / 2);
      pageGeo.translate(0.22, 0, 0);
      part(flip, pageGeo, toon(0xfffcf2, { side: THREE.DoubleSide }));
      part(g, sph(0.42, 20, 14), 0x8fae6a, [-0.2, 0.15, 1.35], null, [1.2, 0.35, 0.9]);
      const turn = rising();
      g.userData.sound = (t, dt, sfx) => {
        if (turn(((t * 0.22) % 1) - 0.6)) sfx.swish(0.15, 0.45, 1800, 5200, 1);
        if (chance(0.12, dt)) sfx.chirp(Math.random() < 0.5 ? 0.1 : -0.4, 0.8);
      };
      return (t) => {
        const k = (t * 0.22) % 1;
        const e = k < 0.6 ? 0 : (k - 0.6) / 0.4;
        flip.rotation.z = e * e * (3 - 2 * e) * Math.PI * 0.94;
      };
    },
  },
  {
    id: 'doodle',
    title: 'Doodle something',
    blurb: 'A cloud, a cat, a very bad horse. Hands like making things too.',
    tip: "No undo. That's the fun part.",
    duration: 'short',
    time: '~3 min',
    build(g) {
      const easel = group(g, [-0.2, 0, -0.3], [0, 0.15, 0]);
      rod(easel, V(-0.55, 0, 0.3), V(-0.1, 2.1, 0), 0.035, 0x9c6b43);
      rod(easel, V(0.55, 0, 0.3), V(0.1, 2.1, 0), 0.035, 0x9c6b43);
      rod(easel, V(0, 0, -0.6), V(0, 2.0, -0.05), 0.035, 0x9c6b43);
      part(easel, box(1.3, 0.06, 0.18), 0x9c6b43, [0, 0.78, 0.2], [-0.15, 0, 0]);
      const tex = canvasTexture(256, 200, (ctx, w, h) => {
        ctx.fillStyle = '#fbf4e2';
        ctx.fillRect(0, 0, w, h);
        ctx.lineCap = ctx.lineJoin = 'round';
        ctx.fillStyle = '#9ccdef';
        ctx.fillRect(10, 10, w - 20, h * 0.55);
        ctx.fillStyle = '#f6d05a';
        ctx.beginPath();
        ctx.arc(200, 50, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        for (const [x, y, r] of [[60, 55, 18], [85, 48, 24], [110, 58, 16]]) {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#7fb65a';
        ctx.beginPath();
        ctx.moveTo(10, 130);
        ctx.quadraticCurveTo(80, 80, 150, 125);
        ctx.quadraticCurveTo(200, 95, 246, 120);
        ctx.lineTo(246, h - 10);
        ctx.lineTo(10, h - 10);
        ctx.fill();
        ctx.strokeStyle = '#3b3a2e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(120, 150, 16, 0, Math.PI * 2);
        ctx.moveTo(108, 139); ctx.lineTo(106, 125); ctx.lineTo(116, 135);
        ctx.moveTo(132, 139); ctx.lineTo(134, 125); ctx.lineTo(124, 135);
        ctx.moveTo(114, 150); ctx.lineTo(114, 152);
        ctx.moveTo(126, 150); ctx.lineTo(126, 152);
        ctx.stroke();
      });
      const canvasMats = Array(6).fill(toon(0xf3ead6));
      canvasMats[4] = toon(0xffffff, { map: tex });
      const canvas = new THREE.Mesh(box(1.15, 0.9, 0.05), canvasMats);
      canvas.castShadow = canvas.receiveShadow = true;
      canvas.position.set(0, 1.3, 0.13);
      canvas.rotation.x = -0.14;
      easel.add(canvas);
      const stool = group(g, [1.3, 0, 0.6]);
      part(stool, cyl(0.3, 0.3, 0.07, 16), 0x9c6b43, [0, 0.5, 0]);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        rod(stool, V(Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22), V(Math.cos(a) * 0.15, 0.5, Math.sin(a) * 0.15), 0.025, 0x7b573b);
      }
      part(stool, sph(0.3, 18, 12), 0xe0bb85, [0, 0.56, 0], null, [1, 0.12, 0.75]);
      [0xe8553f, 0xf2c43d, 0x4a8fd1, 0x6fae4f, 0xffffff].forEach((c, i) => {
        const a = i * 1.1 - 2;
        part(stool, sph(0.045, 10, 8), c, [Math.cos(a) * 0.18, 0.6, Math.sin(a) * 0.12], null, [1, 0.5, 1]);
      });
      const jar = group(g, [-1.4, 0, 0.7]);
      part(jar, cyl(0.16, 0.14, 0.32, 16), toon(0xcfe6f0, { transparent: true, opacity: 0.55 }), [0, 0.16, 0]);
      [0xe8553f, 0x4a8fd1, 0xf2c43d].forEach((c, i) => {
        const b = group(jar, [0, 0.1, 0], [(i - 1) * 0.25, 0, (i - 1) * 0.2]);
        part(b, cyl(0.02, 0.02, 0.6, 6), 0x9c6b43, [0, 0.3, 0]);
        part(b, new THREE.ConeGeometry(0.03, 0.08, 8), c, [0, 0.62, 0]);
      });
      const brush = group(easel, [0, 1.3, 0.5]);
      part(brush, cyl(0.022, 0.022, 0.5, 6), 0x9c6b43, [0, 0.2, 0]);
      part(brush, new THREE.ConeGeometry(0.035, 0.1, 8), 0xe8553f, [0, -0.08, 0], [Math.PI, 0, 0]);
      const strokeA = rising();
      const strokeB = rising();
      g.userData.sound = (t, dt, sfx) => {
        const s = Math.sin(t * 1.7);
        if (strokeA(s) || strokeB(-s)) sfx.scribble(-0.1 + Math.cos(t * 1.7) * 0.1, 0.6, 1);
      };
      return (t) => {
        brush.position.set(Math.cos(t * 1.7) * 0.25, 1.35 + Math.sin(t * 2.3) * 0.18, 0.4);
        brush.rotation.z = Math.sin(t * 1.7) * 0.4 - 0.5;
        brush.rotation.x = 0.4;
      };
    },
  },
  {
    id: 'snack',
    title: 'Grab a small snack',
    blurb: 'A fruit, a rice ball, a handful of nuts. Brains run on more than tokens.',
    tip: 'Eat it away from the keyboard. Crumbs are forever.',
    duration: 'quick',
    time: '~2 min',
    clear: 1.6,
    build(g) {
      createTree(g, [1.8, 0, -1.2], 1.0, 17);
      const gingham = canvasTexture(128, 128, (ctx, w) => {
        ctx.fillStyle = '#fbf3e3';
        ctx.fillRect(0, 0, w, w);
        ctx.fillStyle = 'rgba(210,70,60,0.55)';
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(i * 32, 0, 16, w);
          ctx.fillRect(0, i * 32, w, 16);
        }
      });
      gingham.wrapS = gingham.wrapT = THREE.RepeatWrapping;
      gingham.repeat.set(3, 2.5);
      part(g, box(2.3, 0.03, 1.8), toon(0xffffff, { map: gingham }), [-0.1, 0.015, 0.25], [0, 0.12, 0]);
      const basket = group(g, [-0.75, 0.03, -0.15]);
      part(basket, cyl(0.42, 0.34, 0.38, 18), 0xc8a064, [0, 0.19, 0]);
      part(basket, new THREE.TorusGeometry(0.42, 0.04, 8, 22), 0xa98450, [0, 0.38, 0], [Math.PI / 2, 0, 0]);
      part(basket, new THREE.TorusGeometry(0.38, 0.03, 8, 20, Math.PI), 0xa98450, [0, 0.38, 0]);
      for (const [x, z] of [[-0.12, 0.08], [0.14, -0.05], [0.02, 0.18]]) {
        part(basket, sph(0.14, 16, 12), 0xd6443a, [x, 0.42, z]);
        part(basket, cyl(0.01, 0.01, 0.07, 4), 0x5a3b2a, [x, 0.57, z]);
      }
      const shape = new THREE.Shape();
      const pts = [[0, 0.3], [-0.28, -0.17], [0.28, -0.17]];
      const rr = 0.4;
      for (let i = 0; i < 3; i++) {
        const [x, y] = pts[i];
        const [px, py] = pts[(i + 2) % 3];
        const [nx, ny] = pts[(i + 1) % 3];
        const a = [x + (px - x) * rr * 0.5, y + (py - y) * rr * 0.5];
        const b = [x + (nx - x) * rr * 0.5, y + (ny - y) * rr * 0.5];
        if (i === 0) shape.moveTo(...a);
        else shape.lineTo(...a);
        shape.quadraticCurveTo(x, y, ...b);
      }
      shape.closePath();
      const riceGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 4, curveSegments: 10 });
      riceGeo.center();
      const onigiri = [[0.35, 0.55, -0.2], [0.85, 0.35, 0.3]].map(([x, z, ry]) => {
        const o = group(g, [x, 0.27, z], [0, ry, 0]);
        part(o, riceGeo, 0xfbfaf4);
        part(o, box(0.22, 0.2, 0.26), 0x1f3a2a, [0, -0.1, 0]);
        return o;
      });
      part(g, sph(0.13, 16, 12), 0xf2c43d, [0.15, 0.13, 1.0], null, [1.8, 0.7, 0.8]);
      const jump = rising();
      g.userData.sound = (t, dt, sfx) => {
        if (jump(Math.sin(t * 3)) && Math.random() < 0.75) sfx.boing(0.3, 0.9);
        if (chance(0.1, dt)) sfx.crunch(-0.25, 1);
      };
      return (t) => {
        const hop = Math.max(0, Math.sin(t * 3));
        onigiri[1].position.y = 0.27 + hop * hop * 0.15;
        onigiri[1].rotation.z = Math.sin(t * 3) * 0.05;
      };
    },
  },
  {
    id: 'breathe',
    title: 'Take five slow breaths',
    blurb: "In for four, hold for four, out for six. The loader spins; you don't have to.",
    tip: 'In for four… hold for four… out for six.',
    duration: 'quick',
    time: '~1 min',
    build(g) {
      const stones = [[0.55, 0.16], [0.45, 0.14], [0.34, 0.12], [0.24, 0.1]];
      let y = 0;
      stones.forEach(([r, h], i) => {
        y += h;
        part(g, sph(r, 20, 14), toon([0x9d9a94, 0xb2aea6, 0x8f8b86, 0xa9a49c][i], { flatShading: true }), [0, y, 0], [0, i, 0], [1, h / r, 0.85]);
        y += h * 0.9;
      });
      const orb = part(g, sph(0.28, 28, 20), new THREE.MeshBasicMaterial({ color: 0xfff1c0 }), [0, 1.9, 0]);
      const halo = part(g, sph(0.5, 28, 20), new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending }), [0, 1.9, 0]);
      const seeds = [];
      const rr = (i) => ((Math.sin(i * 91.7) + 1) / 2);
      for (let i = 0; i < 9; i++) {
        const a = rr(i) * Math.PI * 2;
        const d = 1.2 + rr(i + 20) * 1.2;
        const h = 0.45 + rr(i + 40) * 0.4;
        const f = group(g, [Math.cos(a) * d, 0, Math.sin(a) * d]);
        part(f, cyl(0.012, 0.018, h, 5), 0x5d8f41, [0, h / 2, 0]);
        part(f, new THREE.IcosahedronGeometry(0.11, 1), toon(0xffffff, { transparent: true, opacity: 0.85 }), [0, h, 0]);
      }
      const seedMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
      for (let i = 0; i < 14; i++) {
        const s = part(g, sph(0.025, 6, 4), seedMat);
        s.userData.ph = i / 14;
        seeds.push(s);
      }
      const inhale = wrapped();
      const hold = rising();
      const exhale = rising();
      g.userData.sound = (t, dt, sfx) => {
        const c = t % 14;
        if (inhale(c / 14)) sfx.breath(0, 4, true, 1);
        if (hold(c - 4)) sfx.chime(0, 91, 0.6);
        if (exhale(c - 8)) sfx.breath(0, 6, false, 1);
      };
      return (t) => {
        const c = t % 14;
        let k;
        if (c < 4) k = c / 4;
        else if (c < 8) k = 1;
        else k = 1 - (c - 8) / 6;
        k = k * k * (3 - 2 * k);
        orb.scale.setScalar(0.75 + k * 0.6);
        halo.scale.setScalar(0.8 + k * 1.1);
        halo.material.opacity = 0.12 + k * 0.2;
        orb.position.y = halo.position.y = 1.8 + k * 0.25;
        for (const s of seeds) {
          const p = (t * 0.08 + s.userData.ph) % 1;
          const a = s.userData.ph * 20;
          s.position.set(Math.cos(a) * (1.2 + p * 2.5) + Math.sin(t + a) * 0.2, 0.6 + p * 3, Math.sin(a) * (1.2 + p * 2.5));
          s.visible = p < 0.95;
        }
      };
    },
  },
  {
    id: 'bike',
    title: 'Go for a bike ride',
    blurb: "Kicked off a huge migration? You've earned some wind in your hair. Bring a snack.",
    tip: "Pick a direction you haven't been.",
    duration: 'long',
    time: '20 min +',
    build(g) {
      createTree(g, [0, 0, -0.1], 0.85, 19);
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2;
        part(g, cyl(0.12, 0.13, 0.03, 8), toon(0xdcd2bb, { flatShading: true }), [Math.cos(a) * 1.75, 0.015, Math.sin(a) * 1.75]);
      }
      const bike = group(g);
      const frame = 0x3f8f7a;
      const wheels = [-0.5, 0.5].map((x) => {
        const w = group(bike, [x, 0.34, 0]);
        part(w, new THREE.TorusGeometry(0.31, 0.035, 8, 28), 0x2f2f33);
        for (let i = 0; i < 4; i++) part(w, cyl(0.008, 0.008, 0.6, 4), 0xbfbfbf, null, [0, 0, (i / 4) * Math.PI]);
        part(w, cyl(0.04, 0.04, 0.08, 10), 0x777777, null, [Math.PI / 2, 0, 0]);
        return w;
      });
      const RH = V(-0.5, 0.34, 0), FH = V(0.5, 0.34, 0), BB = V(-0.05, 0.3, 0), SEAT = V(-0.2, 0.82, 0), HEAD = V(0.36, 0.86, 0);
      rod(bike, RH, BB, 0.025, frame);
      rod(bike, BB, SEAT, 0.03, frame);
      rod(bike, RH, SEAT, 0.022, frame);
      rod(bike, BB, HEAD, 0.03, frame);
      rod(bike, SEAT, HEAD, 0.028, frame);
      rod(bike, HEAD, FH, 0.025, frame);
      rod(bike, HEAD, V(0.33, 1.0, 0), 0.025, frame);
      part(bike, cyl(0.02, 0.02, 0.5, 8), 0x333333, [0.33, 1.0, 0], [Math.PI / 2, 0, 0]);
      part(bike, box(0.24, 0.06, 0.12), 0x5a3b2a, [-0.22, 0.86, 0]);
      const basket = group(bike, [0.58, 0.9, 0]);
      part(basket, box(0.26, 0.18, 0.3), 0xc8a064);
      [0xf2a7c3, 0xf6d75a, 0xffffff, 0xb9a6e8].forEach((c, i) => part(basket, sph(0.06, 10, 8), c, [(i % 2) * 0.1 - 0.05, 0.12, (i > 1 ? 0.07 : -0.07)]));
      const rider = buddy(bike, { shirt: 0xf2f0e6, pants: 0x3f5a8a, hair: 0x2a1f1a });
      rider.root.position.set(-0.2, 0.44, 0);
      rider.root.rotation.y = Math.PI / 2;
      rider.root.scale.setScalar(0.9);
      rider.arms.forEach((a) => (a.rotation.x = -1.15));
      rider.root.rotation.x = 0.12;
      g.userData.sound = (t, dt, sfx) => {
        const pan = bike.position.x / 3;
        if (chance(7, dt)) sfx.click(pan, 4200, 0.35);
        if (chance(0.09, dt)) sfx.bell(pan, 1);
      };
      return (t) => {
        const phi = t * 0.45;
        bike.position.set(Math.cos(phi) * 1.75, 0.03, Math.sin(phi) * 1.75);
        bike.rotation.y = -phi - Math.PI / 2;
        bike.rotation.x = -0.12;
        const roll = -(t * 0.45 * 1.75) / 0.31;
        wheels.forEach((w) => (w.rotation.z = roll));
        rider.legs[0].rotation.x = -1.0 + Math.sin(t * 5) * 0.45;
        rider.legs[1].rotation.x = -1.0 - Math.sin(t * 5) * 0.45;
      };
    },
  },
  {
    id: 'message',
    title: 'Message a friend',
    blurb: "Not a coworker, not about work. Just a 'thought of you' — it lands better than you'd think.",
    tip: "Send something that isn't a link.",
    duration: 'quick',
    time: '~2 min',
    build(g) {
      createTree(g, [-1.7, 0, -1.1], 1.0, 23);
      const mb = group(g, [0.1, 0, 0]);
      part(mb, box(0.12, 1.0, 0.12), 0x7b573b, [0, 0.5, 0]);
      part(mb, box(0.48, 0.34, 0.72), 0xd24b3b, [0, 1.17, 0]);
      part(mb, new THREE.CylinderGeometry(0.24, 0.24, 0.72, 20, 1, false, 0, Math.PI), 0xd24b3b, [0, 1.34, 0], [Math.PI / 2, Math.PI / 2, 0]);
      part(mb, box(0.44, 0.44, 0.02), 0xb23c2f, [0, 1.25, 0.365]);
      const flag = group(mb, [0.26, 1.2, -0.15]);
      part(flag, box(0.03, 0.4, 0.05), 0xf2c43d, [0, 0.2, 0]);
      part(flag, box(0.03, 0.14, 0.2), 0xf2c43d, [0, 0.35, 0.1]);
      const env = group(g, [0.9, 0.02, 0.9], [0, -0.4, 0]);
      part(env, box(0.5, 0.03, 0.34), 0xfaf3e2);
      part(env, sph(0.05, 10, 6), 0xd24b3b, [0, 0.02, 0], null, [1, 0.3, 1]);
      const planeGeo = new THREE.BufferGeometry();
      planeGeo.setAttribute('position', new THREE.Float32BufferAttribute([
        0, 0, 0.32, -0.2, 0.02, -0.2, 0, 0, -0.2,
        0, 0, 0.32, 0, 0, -0.2, 0.2, 0.02, -0.2,
        0, 0, 0.32, 0, 0, -0.2, 0, -0.08, -0.2,
      ], 3));
      planeGeo.computeVertexNormals();
      const planeMat = toon(0xffffff, { side: THREE.DoubleSide });
      const planes = [0, 1, 2].map((i) => {
        const p = part(g, planeGeo, planeMat);
        p.rotation.order = 'YXZ';
        p.userData = { r: 1.1 + i * 0.45, h: 1.5 + i * 0.35, speed: 0.6 - i * 0.1, ph: i * 2.1 };
        return p;
      });
      const passes = planes.map(() => rising());
      g.userData.sound = (t, dt, sfx) => {
        planes.forEach((p, i) => {
          const { speed, ph } = p.userData;
          if (passes[i](-Math.cos(t * speed + ph))) sfx.swish(0.1, 0.6, 600, 2400, 0.8);
        });
        if (chance(0.05, dt)) sfx.creak(0.25, 0.6);
      };
      return (t) => {
        for (const p of planes) {
          const { r, h, speed, ph } = p.userData;
          const phi = t * speed + ph;
          p.position.set(Math.cos(phi) * r + 0.1, h + Math.sin(phi * 2) * 0.2, Math.sin(phi) * r);
          p.rotation.y = -phi;
          p.rotation.z = -0.4;
          p.rotation.x = -Math.cos(phi * 2) * 0.15;
        }
        flag.rotation.x = Math.sin(t * 2) * 0.1;
      };
    },
  },
];
