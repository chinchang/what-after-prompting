// Tiny synthesised foley for the islands. Every sound is built from oscillators and
// filtered noise at the moment it plays, so there are no audio files to load.
import { CONFIG } from './config.js';

const S = CONFIG.sfx;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const rand = (a, b) => a + Math.random() * (b - a);

// Stands in for the library while sound is off, or for islands that aren't in front.
export const SILENT = new Proxy({}, { get: () => () => {} });

export function createSfx(ctx, out) {
  const focus = ctx.createGain();
  focus.gain.value = 1;
  focus.connect(out);

  const room = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * 1.2);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
  }
  room.buffer = ir;
  const send = ctx.createGain();
  send.gain.value = S.reverb;
  focus.connect(send).connect(room).connect(out);

  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  /* ---------- building blocks ---------- */

  const now = () => ctx.currentTime + 0.01;

  function panned(pan) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan * S.stereoSpread));
    p.connect(focus);
    return p;
  }

  function env(dest, t, peak, attack, decay) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(dest);
    return g;
  }

  function filter(type, f, q, dest) {
    const b = ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    b.connect(dest);
    return b;
  }

  function noise(t, dur, dest) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    s.connect(dest);
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur);
    return s;
  }

  function tone(type, f, t, dur, dest) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.connect(dest);
    o.start(t);
    o.stop(t + dur);
    return o;
  }

  /* ---------- the sounds ---------- */

  return {
    setFocus(on) {
      focus.gain.setTargetAtTime(on ? S.focusBoost : 1, ctx.currentTime, 0.4);
    },

    // Water droplet “bloop”.
    drip(pan = 0, pitch = 1, vol = 1) {
      const t = now();
      const f = 850 * pitch;
      const o = tone('sine', f * 0.6, t, 0.2, env(panned(pan), t, 0.08 * vol, 0.003, 0.13));
      o.frequency.exponentialRampToValueAtTime(f * 1.7, t + 0.07);
    },

    // Soft footstep in grass.
    step(pan = 0, vol = 1) {
      const t = now();
      const e = env(panned(pan), t, 0.22 * vol, 0.006, 0.09);
      noise(t, 0.12, filter('bandpass', rand(500, 800), 0.8, e));
      noise(t, 0.06, filter('highpass', 3000, 0.5, env(panned(pan), t, 0.03 * vol, 0.004, 0.05)));
    },

    // Airy swish: page turns, paper planes, curtains.
    swish(pan = 0, dur = 0.3, from = 1500, to = 5000, vol = 1) {
      const t = now();
      const e = env(panned(pan), t, 0.12 * vol, dur * 0.4, dur * 0.6);
      const bp = filter('bandpass', from, 1.2, e);
      bp.frequency.exponentialRampToValueAtTime(to, t + dur);
      noise(t, dur + 0.05, bp);
    },

    // Gentle gust of wind.
    gust(pan = 0, dur = 2.5, vol = 1) {
      const t = now();
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.07 * vol, t + dur * 0.45);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      g.connect(panned(pan));
      const lp = filter('lowpass', 300, 0.7, g);
      lp.frequency.linearRampToValueAtTime(900, t + dur * 0.5);
      lp.frequency.linearRampToValueAtTime(300, t + dur);
      noise(t, dur, lp);
    },

    // A breath: brightening for an inhale, darkening for an exhale.
    breath(pan = 0, dur = 4, inhale = true, vol = 1) {
      const t = now();
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.07 * vol, t + dur * 0.5);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      g.connect(panned(pan));
      const bp = filter('bandpass', inhale ? 500 : 1300, 0.6, g);
      bp.frequency.linearRampToValueAtTime(inhale ? 1300 : 450, t + dur);
      noise(t, dur, bp);
    },

    // Music-box / glass bell.
    chime(pan = 0, midi = 91, vol = 1) {
      const t = now();
      const f = mtof(midi);
      const e = env(panned(pan), t, 0.07 * vol, 0.004, 1.4);
      tone('sine', f, t, 1.5, e);
      tone('sine', f * 2.76, t, 0.5, env(e, t, 0.3, 0.003, 0.4));
    },

    // Teacup / glass clink.
    clink(pan = 0, vol = 1) {
      const t = now();
      const e = env(panned(pan), t, 0.06 * vol, 0.002, 0.35);
      const f = rand(2600, 2900);
      tone('sine', f, t, 0.4, e);
      tone('sine', f * 1.51, t, 0.25, e);
    },

    // Cat purr: low rumble pulsing ~25 times a second.
    purr(pan = 0, dur = 1.5, vol = 1) {
      const t = now();
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.3 * vol, t + dur * 0.3);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      g.connect(panned(pan));
      const am = ctx.createGain();
      am.gain.value = 0.5;
      am.connect(g);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 24;
      const depth = ctx.createGain();
      depth.gain.value = 0.5;
      lfo.connect(depth).connect(am.gain);
      lfo.start(t);
      lfo.stop(t + dur);
      noise(t, dur, filter('lowpass', 240, 1, am));
    },

    // Tiny click (freewheel ticks, cracking joints).
    click(pan = 0, f = 3000, vol = 1) {
      const t = now();
      noise(t, 0.03, filter('highpass', f, 0.7, env(panned(pan), t, 0.1 * vol, 0.001, 0.025)));
    },

    // Wooden creak (well rope, mailbox flag).
    creak(pan = 0, vol = 1) {
      const t = now();
      const e = env(panned(pan), t, 0.25 * vol, 0.05, 0.35);
      const o = tone('sawtooth', rand(120, 150), t, 0.45, filter('bandpass', 700, 5, e));
      o.frequency.linearRampToValueAtTime(rand(150, 175), t + 0.12);
      o.frequency.linearRampToValueAtTime(rand(110, 130), t + 0.25);
      o.frequency.linearRampToValueAtTime(rand(135, 155), t + 0.4);
    },

    // Little bird: a couple of quick upward chirps.
    chirp(pan = 0, vol = 1) {
      const t0 = now();
      const base = rand(2600, 3400);
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const t = t0 + i * rand(0.09, 0.13);
        const o = tone('sine', base, t, 0.08, env(panned(pan), t, 0.05 * vol, 0.005, 0.06));
        o.frequency.exponentialRampToValueAtTime(base * rand(1.3, 1.6), t + 0.06);
      }
    },

    // Bicycle bell: ring-ring.
    bell(pan = 0, vol = 1) {
      const t0 = now();
      for (const dt of [0, 0.17]) {
        const t = t0 + dt;
        const e = env(panned(pan), t, 0.06 * vol, 0.002, 0.7);
        tone('sine', 2350, t, 0.8, e);
        tone('sine', 3460, t, 0.5, env(e, t, 0.5, 0.002, 0.4));
        tone('sine', 5120, t, 0.3, env(e, t, 0.2, 0.002, 0.2));
      }
    },

    // A happy little jingle through a tiny TV speaker.
    tv(pan = 0, vol = 1) {
      const t0 = now();
      const tunes = [[72, 76, 79, 84], [79, 76, 72, 74, 76], [77, 81, 84, 81], [72, 74, 76, 79, 76]];
      const tune = tunes[Math.floor(Math.random() * tunes.length)];
      const speaker = filter('bandpass', 1400, 0.9, panned(pan));
      tune.forEach((m, i) => {
        const t = t0 + i * 0.13;
        tone('square', mtof(m), t, 0.14, env(speaker, t, 0.06 * vol, 0.005, 0.11));
      });
    },

    // Popcorn pop.
    pop(pan = 0, vol = 1) {
      const t = now();
      const e = env(panned(pan), t, 0.12 * vol, 0.001, 0.05);
      noise(t, 0.02, filter('bandpass', rand(1500, 2500), 1, e));
      const o = tone('sine', rand(500, 700), t, 0.07, env(panned(pan), t, 0.08 * vol, 0.001, 0.05));
      o.frequency.exponentialRampToValueAtTime(160, t + 0.05);
    },

    // Brush / pencil scribble.
    scribble(pan = 0, dur = 0.5, vol = 1) {
      const t = now();
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.09 * vol, t + 0.05);
      g.gain.setValueAtTime(0.09 * vol, t + dur - 0.1);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      g.connect(panned(pan));
      const am = ctx.createGain();
      am.gain.value = 0.6;
      am.connect(g);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = rand(9, 14);
      const depth = ctx.createGain();
      depth.gain.value = 0.4;
      lfo.connect(depth).connect(am.gain);
      lfo.start(t);
      lfo.stop(t + dur);
      noise(t, dur, filter('bandpass', rand(3000, 4200), 2.5, am));
    },

    // Cartoon boing.
    boing(pan = 0, vol = 1) {
      const t = now();
      const o = tone('sine', 190, t, 0.3, env(panned(pan), t, 0.1 * vol, 0.005, 0.24));
      o.frequency.exponentialRampToValueAtTime(430, t + 0.16);
    },

    // Crunchy bite.
    crunch(pan = 0, vol = 1) {
      const t0 = now();
      for (let i = 0; i < 6; i++) {
        const t = t0 + i * rand(0.025, 0.05);
        noise(t, 0.03, filter('bandpass', rand(1800, 3500), 1.2, env(panned(pan), t, rand(0.09, 0.2) * vol, 0.001, 0.03)));
      }
    },

    // Steam hiss.
    hiss(pan = 0, dur = 1, vol = 1) {
      const t = now();
      const e = env(panned(pan), t, 0.05 * vol, dur * 0.3, dur * 0.7);
      noise(t, dur + 0.05, filter('highpass', 3800, 0.5, e));
    },

    // Soft slide whistle (stretching).
    slide(pan = 0, dur = 1.5, from = 330, to = 520, vol = 1) {
      const t = now();
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05 * vol, t + dur * 0.25);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      g.connect(panned(pan));
      const o = tone('sine', from, t, dur, g);
      o.frequency.exponentialRampToValueAtTime(to, t + dur);
    },
  };
}
