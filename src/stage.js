import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { BokehShader } from 'three/addons/shaders/BokehShader.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CONFIG } from './config.js';
import { SILENT } from './sfx.js';
import { mergeStaticParts } from './optimize.js';
import { shared, createSky, createStars, createMoon, createClouds, createBirds, createPollen, createIsland, grassBrightness } from './world.js';

const TAU = Math.PI * 2;
const { depthOfField: DOF, render: RENDER, sky: SKY, lighting: LIGHT, camera: CAM, ring: RING } = CONFIG;
const R = RING.radius;
const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOutQuart = (x) => 1 - Math.pow(1 - x, 4);
const wrap = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

// Bokeh depth of field that reads the depth the main render already produced,
// instead of drawing the whole scene a second time just to get depth.
class DepthOfFieldPass extends ShaderPass {
  constructor(camera) {
    super(BokehShader, 'tColor');
    this.material.defines.DEPTH_PACKING = 0;
    this.camera = camera;
  }
  render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
    const u = this.uniforms;
    u.tDepth.value = readBuffer.depthTexture;
    u.nearClip.value = this.camera.near;
    u.farClip.value = this.camera.far;
    u.aspect.value = this.camera.aspect;
    super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
  }
}

export function createStage(canvas, activities) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, RENDER.maxPixelRatio));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color();
  scene.fog = new THREE.Fog(0xffffff, SKY.fogNear, SKY.fogFar);

  const camera = new THREE.PerspectiveCamera(CAM.fov, 1, 0.1, 1400);

  // Soft depth of field: the front island stays crisp, neighbours and the far archipelago melt a little.
  // The composer's MSAA target keeps edges smooth now that the canvas's own antialiasing is bypassed,
  // and its depth texture feeds the blur.
  const composer = new EffectComposer(
    renderer,
    new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: RENDER.msaaSamples,
      depthTexture: new THREE.DepthTexture(1, 1),
    }),
  );
  composer.addPass(new RenderPass(scene, camera));
  const bokeh = new DepthOfFieldPass(camera);
  bokeh.uniforms.aperture.value = DOF.aperture;
  bokeh.uniforms.maxblur.value = DOF.maxBlur;
  bokeh.enabled = DOF.enabled;
  composer.addPass(bokeh);
  composer.addPass(new OutputPass());

  // Sun (or moon) from the front-right, sky fill for soft coloured shadows. Colours come from the theme.
  const sun = new THREE.DirectionalLight();
  sun.position.set(LIGHT.sunOffset[0], LIGHT.sunOffset[1], R + LIGHT.sunOffset[2]);
  sun.target.position.set(0, 0, R);
  sun.castShadow = true;
  sun.shadow.mapSize.set(RENDER.shadowMapSize, RENDER.shadowMapSize);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 12, bottom: -12, near: 1, far: 70 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = LIGHT.shadowSoftness;
  scene.add(sun, sun.target);
  const fill = new THREE.HemisphereLight();
  scene.add(fill);

  const sky = createSky();
  const stars = createStars();
  const moon = createMoon();
  const clouds = createClouds();
  const birds = createBirds();
  const pollen = createPollen(new THREE.Vector3(0, 1, R));
  scene.add(sky, stars.root, moon.root, clouds.root, birds.root, pollen.root);

  /* ---------- day ↔ night ---------- */

  const DAY = CONFIG.themes.day;
  const NIGHT = CONFIG.themes.night;
  const COLOR_KEYS = ['skyTop', 'skyMid', 'horizon', 'glow', 'lightColor', 'skyFill', 'groundFill', 'cloudEmissive', 'seaEmissive', 'motesColor'];
  const dayCol = {};
  const nightCol = {};
  for (const key of COLOR_KEYS) {
    dayCol[key] = new THREE.Color(DAY[key]);
    nightCol[key] = new THREE.Color(NIGHT[key]);
  }
  const dayGlow = new THREE.Vector3(...DAY.glowDir).normalize();
  const nightGlow = new THREE.Vector3(...NIGHT.glowDir).normalize();
  const skyU = sky.material.uniforms;

  function applyTheme(k) {
    const col = (target, key) => target.copy(dayCol[key]).lerp(nightCol[key], k);
    const num = (key) => DAY[key] + (NIGHT[key] - DAY[key]) * k;
    col(skyU.uTop.value, 'skyTop');
    col(skyU.uMid.value, 'skyMid');
    col(skyU.uHorizon.value, 'horizon');
    col(skyU.uGlow.value, 'glow');
    skyU.uGlowDir.value.copy(dayGlow).lerp(nightGlow, k).normalize();
    col(scene.fog.color, 'horizon');
    col(scene.background, 'horizon');
    col(sun.color, 'lightColor');
    sun.intensity = num('lightIntensity');
    col(fill.color, 'skyFill');
    col(fill.groundColor, 'groundFill');
    fill.intensity = num('fillIntensity');
    col(clouds.skyMat.emissive, 'cloudEmissive');
    clouds.skyMat.emissiveIntensity = num('cloudGlow');
    col(clouds.seaMat.emissive, 'seaEmissive');
    clouds.seaMat.emissiveIntensity = num('seaGlow');
    col(pollen.material.color, 'motesColor');
    pollen.material.size = num('motesSize');
    pollen.material.userData.base = num('motesOpacity');
    stars.setOpacity(num('stars'));
    moon.setOpacity(num('moon'));
    birds.root.visible = num('birds') > 0.5;
    grassBrightness.value = num('grassBrightness');
  }
  let night = 0;
  let nightTarget = 0;
  applyTheme(0);

  const N = activities.length;
  const STEP = TAU / N;
  const ring = new THREE.Group();
  scene.add(ring);

  const holders = activities.map((activity, i) => {
    const angle = i * STEP;
    const holder = new THREE.Group();
    holder.position.set(Math.sin(angle) * R, 0, Math.cos(angle) * R);
    holder.rotation.y = angle;
    const island = createIsland({ seed: i * 7 + 3, clear: activity.clear ?? 0.8 });
    holder.add(island.root);
    const props = new THREE.Group();
    island.root.add(props);
    const update = activity.build(props) || null;
    if (RENDER.mergeStaticParts) {
      mergeStaticParts(island.root, (t) => {
        island.update(t);
        update?.(t, 1 / 60);
      });
    }
    holder.userData = { index: i, island, update, sound: props.userData.sound, phase: i * 1.7, targetScale: 1, targetDrop: 0, drop: 0 };
    ring.add(holder);
    return holder;
  });

  /* ---------- navigation ---------- */

  let getSfx = () => SILENT;

  let theta = 0;
  let tween = null;
  let targetIndex = 0;
  let frontIndex = -1;
  let frontListener = () => {};
  let settleListener = () => {};

  function animateTo(index, { spins = 0 } = {}) {
    let d = wrap(-index * STEP - theta);
    if (spins) {
      if (d > -0.01) d -= TAU;
      d -= RING.spinLaps * TAU;
    }
    targetIndex = index;
    tween = {
      from: theta,
      to: theta + d,
      start: performance.now(),
      dur: spins ? RING.spinDuration : RING.stepDuration + Math.abs(d) * 260,
      ease: spins ? easeOutQuart : easeInOutCubic,
    };
  }

  function jumpTo(index) {
    theta = -index * STEP;
    targetIndex = index;
    tween = null;
  }

  function setDimmed(isDimmed) {
    holders.forEach((h, i) => {
      const dim = isDimmed(i);
      h.userData.targetScale = dim ? RING.dimmedScale : 1;
      h.userData.targetDrop = dim ? RING.dimmedDrop : 0;
    });
  }

  /* ---------- camera framing ---------- */

  let focus = false;
  const camGoal = new THREE.Vector3();
  const lookGoal = new THREE.Vector3();
  const look = new THREE.Vector3(0, 1, R);
  const pointer = new THREE.Vector2();
  const pointerSmooth = new THREE.Vector2();

  function frameGoal() {
    const aspect = camera.aspect;
    const portrait = aspect < 0.9;
    let dist = Math.max(CAM.minDistance, (portrait ? CAM.portraitFit : CAM.landscapeFit) / aspect) / CAM.zoom;
    if (focus) dist *= CAM.focusZoom;
    // On wide screens slide the view so the island sits right of the card.
    const shift = aspect > 1.2 ? -Math.min(2.2, (aspect - 1.2) * 4) : 0;
    camGoal.set(shift + pointerSmooth.x * CAM.parallax[0], 3 + dist * 0.13 + pointerSmooth.y * CAM.parallax[1], R + dist);
    lookGoal.set(shift, portrait ? 1.4 - dist * 0.12 : 1.3, R);
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    frameGoal();
  }
  window.addEventListener('resize', resize);
  resize();
  camera.position.copy(camGoal).add(new THREE.Vector3(0, 6, 8));
  camera.lookAt(look);

  /* ---------- picking ---------- */

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let pickListener = () => {};
  let hoverDirty = false;

  function islandAt(x, y) {
    ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(holders, true)[0];
    let o = hit?.object;
    while (o && o.userData.index === undefined) o = o.parent;
    return o ? o.userData.index : null;
  }

  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => {
    downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt) return;
    const dx = e.clientX - downAt.x;
    const dy = e.clientY - downAt.y;
    const quick = performance.now() - downAt.t < 600;
    downAt = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) && quick) {
      pickListener({ swipe: dx < 0 ? 1 : -1 });
    } else if (Math.hypot(dx, dy) < 8) {
      const i = islandAt(e.clientX, e.clientY);
      if (i !== null) pickListener({ index: i });
    }
  });
  let lastMove = { x: 0, y: 0 };
  window.addEventListener('pointermove', (e) => {
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    lastMove = { x: e.clientX, y: e.clientY };
    hoverDirty = e.target === canvas && e.pointerType === 'mouse';
  });

  /* ---------- loop ---------- */

  const clock = new THREE.Clock();
  let rendered = false;
  let firstFrame = () => {};

  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    shared.uTime.value = t;

    if (tween) {
      const k = Math.min(1, (performance.now() - tween.start) / tween.dur);
      theta = tween.from + (tween.to - tween.from) * tween.ease(k);
      if (k >= 1) {
        tween = null;
        settleListener(targetIndex);
      }
    }
    ring.rotation.y = theta;

    const front = ((Math.round(-theta / STEP) % N) + N) % N;
    if (front !== frontIndex) {
      frontIndex = front;
      frontListener(front, !!tween);
    }

    // Only the island in front is heard; the rest still run so their timing stays in step.
    // Only islands near the front animate — the far side is small and blurred anyway.
    const sfx = getSfx();
    const frontFloat = -theta / STEP;
    holders.forEach((h, i) => {
      const u = h.userData;
      const near = Math.abs(wrap((i - frontFloat) * STEP)) / STEP <= RING.animateRange + 0.5;
      u.sound?.(t, dt, !tween && i === targetIndex ? sfx : SILENT);
      const s = THREE.MathUtils.damp(h.scale.x, u.targetScale, 4, dt);
      h.scale.setScalar(s);
      u.drop = THREE.MathUtils.damp(u.drop, u.targetDrop, 4, dt);
      h.position.y = u.drop + Math.sin(t * RING.bobSpeed + u.phase) * RING.bobHeight;
      h.children[0].rotation.z = Math.sin(t * 0.4 + u.phase) * 0.015;
      if (near) {
        u.island.update(t);
        u.update?.(t, dt);
      }
    });

    if (night !== nightTarget) {
      const step = dt / CONFIG.timeOfDay.transitionSeconds;
      night = nightTarget > night ? Math.min(nightTarget, night + step) : Math.max(nightTarget, night - step);
      applyTheme(night * night * (3 - 2 * night));
    }

    clouds.update(t);
    birds.update(t);
    pollen.update(t);

    pointerSmooth.lerp(pointer, 1 - Math.exp(-dt * 2));
    frameGoal();
    camera.position.lerp(camGoal, 1 - Math.exp(-dt * CAM.followSpeed));
    look.lerp(lookGoal, 1 - Math.exp(-dt * 3));
    camera.lookAt(look);

    if (hoverDirty) {
      hoverDirty = false;
      const i = islandAt(lastMove.x, lastMove.y);
      canvas.style.cursor = i !== null && i !== targetIndex ? 'pointer' : '';
    }

    bokeh.uniforms.focus.value = camera.position.distanceTo(look);
    composer.render(dt);
    if (!rendered) {
      rendered = true;
      firstFrame();
    }
  }
  renderer.setAnimationLoop(tick);

  return {
    count: N,
    get targetIndex() {
      return targetIndex;
    },
    get busy() {
      return !!tween;
    },
    animateTo,
    jumpTo,
    setDimmed,
    setFocus(on) {
      focus = on;
    },
    // Switch to night (true) or day (false); `instant` skips the crossfade.
    setNight(on, instant = false) {
      nightTarget = on ? 1 : 0;
      if (instant) {
        night = nightTarget;
        applyTheme(night);
      }
    },
    setSfx(fn) {
      getSfx = fn;
    },
    onFront(fn) {
      frontListener = fn;
    },
    onSettle(fn) {
      settleListener = fn;
    },
    onPick(fn) {
      pickListener = fn;
    },
    onFirstFrame(fn) {
      firstFrame = fn;
    },
  };
}
