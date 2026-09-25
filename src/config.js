// Every tunable number for the scene lives here. Tweak, save, and Vite hot-reloads.

export const CONFIG = {
  /* Depth of field — the front island stays sharp; everything else softens with distance. */
  depthOfField: {
    enabled: true,
    aperture: 0.00022, // how fast blur grows with distance from the focus plane
    maxBlur: 0.0055, // cap on blur (fraction of screen width)
  },

  render: {
    maxPixelRatio: 2,
    msaaSamples: 4, // antialiasing samples for the post-processing target
    shadowMapSize: 2048,
  },

  /* Day or night follows the visitor's local clock. */
  timeOfDay: {
    mode: 'auto', // 'auto', or force 'day' / 'night' (also try ?time=night in the URL)
    dayStartsAt: 6, // hour, 24h clock
    nightStartsAt: 19,
    transitionSeconds: 5, // crossfade when the hour ticks over while the page is open
  },

  /* The two looks. Every value here is blended during the day ↔ night crossfade. */
  themes: {
    day: {
      skyTop: 0x3f86d0,
      skyMid: 0x92c8ea,
      horizon: 0xdcebe8, // also the fog colour
      glow: 0xffd7a0, // warm haze near the horizon
      glowDir: [-0.45, 0.1, -1],
      lightColor: 0xfff0d6, // the sun
      lightIntensity: 2.6,
      skyFill: 0xcfe6ff,
      groundFill: 0x8aa86a,
      fillIntensity: 1.5,
      cloudEmissive: 0x9fb2dc,
      cloudGlow: 0.45,
      seaEmissive: 0x8a9cc8,
      seaGlow: 0.35,
      motesColor: 0xfff1c8, // drifting pollen by day…
      motesSize: 0.22,
      motesOpacity: 0.75,
      stars: 0,
      moon: 0,
      birds: 1,
      grassBrightness: 1,
    },
    night: {
      skyTop: 0x0b1433,
      skyMid: 0x182850,
      horizon: 0x2a3a68,
      glow: 0x8fa8e6, // moon haze
      glowDir: [0.32, 0.035, -1], // also where the moon sits,
      lightColor: 0xa9c0ff, // moonlight
      lightIntensity: 1.25,
      skyFill: 0x4a62a8,
      groundFill: 0x1c2638,
      fillIntensity: 1.0,
      cloudEmissive: 0x1e2a58,
      cloudGlow: 0.4,
      seaEmissive: 0x1a2450,
      seaGlow: 0.42,
      motesColor: 0xe4ff8a, // …fireflies by night
      motesSize: 0.34,
      motesOpacity: 1,
      stars: 1,
      moon: 1,
      birds: 0,
      grassBrightness: 0.42,
    },
  },

  sky: {
    fogNear: 30,
    fogFar: 115,
    starCount: 900,
  },

  lighting: {
    sunOffset: [12, 20, 14], // sun / moon position relative to the front island
    shadowSoftness: 3,
    toonBands: [95, 165, 220, 255], // brightness steps of the cel shading (0–255)
  },

  camera: {
    fov: 38,
    zoom: 1.15, // >1 moves closer to the island in front, <1 pulls back
    minDistance: 14,
    landscapeFit: 15, // distance = landscapeFit / aspect on narrow landscape screens
    portraitFit: 11.5, // same, for portrait screens
    focusZoom: 0.7, // distance multiplier in “I'll do this” mode
    parallax: [0.9, 0.35], // mouse-follow sway, x / y
    followSpeed: 2.2, // higher = snappier camera
  },

  /* The ring of islands and how it moves. */
  ring: {
    radius: 22,
    stepDuration: 800, // ms for moving to a neighbour (plus a bit per extra step)
    spinDuration: 3600, // ms for “Spin for me”
    spinLaps: 1, // full extra laps before landing
    dimmedScale: 0.55, // islands hidden by the filter shrink to this…
    dimmedDrop: -1.6, // …and sink by this much
    bobHeight: 0.18,
    bobSpeed: 0.6,
  },

  grass: {
    enabled: false, // grass tufts on the islands
    tuftsPerIsland: 300,
    bladesPerTuft: [6, 10], // min, max
    tuftRadius: 0.18, // how widely a clump fans out
    bladeHeight: 0.28,
    bladeWidth: 0.09,
    bladeCurl: 0.45, // forward curve of each blade (0 = straight)
    rootColor: 0x86b653, // matches the island top so tufts grow out of the ground
    deepColor: 0x6ea347, // shaded patches
    lushColor: 0xa6d066,
    sunnyColor: 0xd6e38c, // sun-bleached tips
    patchScale: 0.9, // size of the light/dark meadow patches (higher = smaller)
    windStrength: 0.09,
    windSpeed: 1.5,
  },

  clouds: {
    horizonCount: 18,
    seaCount: 90, // the cloud sea below the islands
    horizonDrift: 0.0035, // rotation speed
    seaDrift: 0.006,
  },

  birds: {
    count: 5,
    speed: 0.05,
  },

  pollen: {
    count: 260, // colour, size and brightness live in themes (pollen by day, fireflies by night)
  },

  /* One switch for music + effects. Browsers only allow sound after the first click or key press. */
  sound: {
    onByDefault: true, // starts on the visitor's first interaction unless they've muted it before
    fadeSeconds: 1.2, // fade in/out when toggled
  },

  /* Background music (generated live). */
  music: {
    enabled: true,
    volume: 0.6,
    tempo: 100, // beats per minute (3/4 waltz)
    reverb: 0.32, // how much of the sound goes into the room reverb
    reverbSeconds: 2.8, // length of the reverb tail
    melody: 0.2,
    accompaniment: 0.055, // the soft chords on beats 2 and 3
    bass: 0.16,
    pad: 0.03, // sustained strings
    sparkle: 0.05, // music-box bell
  },

  /* Little sound effects for whatever is happening on the island in front. */
  sfx: {
    enabled: true,
    volume: 0.9,
    focusBoost: 1.5, // louder while you're in “I'll do this” mode
    stereoSpread: 0.8, // how far left/right sounds pan with the prop's position
    reverb: 0.22, // small room reverb so effects sit with the music
  },

  ui: {
    introFallbackMs: 4000, // reveal the page even if the first frame is slow
  },
};
