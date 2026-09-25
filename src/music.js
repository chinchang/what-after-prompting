// An original, lilting 3/4 waltz synthesised live with Web Audio —
// felt piano, breathy flute, soft string pad and a music-box shimmer in a warm reverb.
import { CONFIG } from './config.js';

const M = CONFIG.music;
const freq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

const CHORDS = {
  C: { bass: 48, tones: [60, 64, 67] },
  Cmaj7: { bass: 48, tones: [59, 64, 67] },
  Am: { bass: 45, tones: [60, 64, 69] },
  F: { bass: 41, tones: [60, 65, 69] },
  Fmaj7: { bass: 41, tones: [60, 64, 69] },
  G: { bass: 43, tones: [59, 62, 67] },
  Em: { bass: 40, tones: [59, 64, 67] },
  Em7: { bass: 40, tones: [62, 67, 71] },
  Dm7: { bass: 38, tones: [60, 65, 69] },
};

// Each bar: chord per beat, then melody as [midi, beats] pairs (3 beats per bar).
const bar = (chords, melody) => ({ chords: chords.split(' '), melody });
const SECTION_A = [
  bar('C C C', [[76, 1], [79, 1], [84, 1]]),
  bar('Am Am Am', [[83, 2], [81, 1]]),
  bar('F F F', [[81, 1], [77, 1], [72, 1]]),
  bar('G G G', [[74, 3]]),
  bar('C C C', [[76, 1], [79, 1], [84, 1]]),
  bar('Em Em Em', [[83, 1], [84, 1], [86, 1]]),
  bar('F F G', [[88, 2], [86, 1]]),
  bar('C C C', [[84, 3]]),
];
const SECTION_B = [
  bar('Fmaj7 Fmaj7 Fmaj7', [[81, 1.5], [79, 0.5], [77, 1]]),
  bar('G G G', [[79, 1.5], [77, 0.5], [74, 1]]),
  bar('Em7 Em7 Em7', [[76, 1], [79, 1], [83, 1]]),
  bar('Am Am Am', [[81, 3]]),
  bar('Dm7 Dm7 Dm7', [[77, 1], [81, 1], [84, 1]]),
  bar('G G G', [[83, 1], [81, 1], [79, 1]]),
  bar('Cmaj7 Cmaj7 Cmaj7', [[76, 1.5], [74, 0.5], [76, 1]]),
  bar('C C C', [[72, 3]]),
];
const SONG = [...SECTION_A, ...SECTION_B];
const SPARKLE_NOTES = [84, 86, 88, 91, 93, 96];

// Three passes: piano carries the tune, then flute + music box, then a quiet breather.
function melodyVoice(cycle, barIndex) {
  const pass = cycle % 3;
  if (pass === 0) return 'piano';
  if (pass === 1) return 'flute';
  return barIndex < SECTION_A.length ? 'rest' : 'piano';
}

function impulse(ctx, seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  return buf;
}

// The engine only schedules into a context, so it works live or offline.
export function createEngine(ctx, destination) {
  const bus = ctx.createGain();
  const verb = ctx.createConvolver();
  verb.buffer = impulse(ctx, M.reverbSeconds);
  const send = ctx.createGain();
  send.gain.value = M.reverb;
  bus.connect(destination);
  bus.connect(send).connect(verb).connect(destination);

  const jitter = (amount) => (Math.random() - 0.5) * amount;

  function osc(type, f, t, end, out, gain = 1, detune = 0) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.value = gain;
    o.connect(g).connect(out);
    o.start(t);
    o.stop(end);
    return o;
  }

  function piano(t, midi, dur, vel) {
    const f = freq(midi);
    const env = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(f * 7, 9000), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(f * 2, 500), t + 1.4);
    lp.connect(env).connect(bus);
    const release = t + Math.max(dur, 0.36);
    const end = release + 1.6;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(vel, t + 0.006);
    env.gain.exponentialRampToValueAtTime(vel * 0.4, t + 0.35);
    env.gain.setTargetAtTime(0.0001, release, 0.28);
    osc('triangle', f, t, end, lp, 0.55);
    osc('sine', f, t, end, lp, 0.5, 2);
    osc('sine', f * 2, t, end, lp, 0.16, -3);
  }

  function flute(t, midi, dur, vel) {
    const f = freq(midi);
    const env = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    lp.connect(env).connect(bus);
    const end = t + dur + 0.6;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(vel, t + 0.07);
    env.gain.setTargetAtTime(vel * 0.85, t + 0.07, 0.2);
    env.gain.setTargetAtTime(0.0001, t + dur, 0.09);
    const body = osc('sine', f, t, end, lp, 1);
    const air = osc('triangle', f * 2, t, end, lp, 0.07);
    // Vibrato blooms in after the attack, like a real player.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.2;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(f * 0.005, t + 0.35);
    lfo.connect(depth);
    depth.connect(body.frequency);
    depth.connect(air.frequency);
    lfo.start(t);
    lfo.stop(end);
  }

  function bell(t, midi, vel) {
    const f = freq(midi);
    const env = ctx.createGain();
    env.connect(bus);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(vel, t + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    osc('sine', f, t, t + 1.7, env, 1);
    osc('sine', f * 2.76, t, t + 0.6, env, 0.25);
    osc('sine', f * 5.4, t, t + 0.3, env, 0.08);
  }

  function bass(t, midi, dur, vel) {
    const f = freq(midi);
    const env = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    lp.connect(env).connect(bus);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(vel, t + 0.012);
    env.gain.exponentialRampToValueAtTime(vel * 0.55, t + 0.4);
    env.gain.setTargetAtTime(0.0001, t + Math.max(dur, 0.42), 0.18);
    const end = t + dur + 1;
    osc('sine', f, t, end, lp, 1);
    osc('triangle', f, t, end, lp, 0.35);
  }

  function pad(t, tones, dur, vel) {
    const env = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1100;
    lp.Q.value = 0.3;
    lp.connect(env).connect(bus);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(vel, t + dur * 0.35);
    env.gain.setTargetAtTime(0.0001, t + dur * 0.8, dur * 0.25);
    const end = t + dur * 1.8;
    for (const m of tones) {
      osc('sawtooth', freq(m), t, end, lp, 1 / tones.length, -8);
      osc('sawtooth', freq(m), t, end, lp, 1 / tones.length, 8);
    }
  }

  let barIndex = 0;
  let cycle = 0;
  let nextBar = 0;

  function scheduleBar(t) {
    const b = SONG[barIndex];
    const beat = 60 / M.tempo;

    // Left hand: oom-pah-pah — bass on the downbeat (or chord change), soft chords on 2 and 3.
    b.chords.forEach((name, i) => {
      const c = CHORDS[name];
      const bt = t + i * beat;
      if (i === 0 || name !== b.chords[i - 1]) {
        let span = 1;
        while (b.chords[i + span] === name) span++;
        bass(bt, c.bass, span * beat * 0.95, M.bass * (0.9 + Math.random() * 0.2));
      }
      if (i > 0) {
        c.tones.forEach((m) => piano(bt + jitter(0.012), m, beat * 0.55, M.accompaniment * (0.8 + Math.random() * 0.3)));
      }
    });
    pad(t, CHORDS[b.chords[0]].tones, beat * 3, M.pad);

    const voice = melodyVoice(cycle, barIndex);
    let mt = t;
    for (const [m, beats] of b.melody) {
      const dur = beats * beat;
      if (voice === 'piano') piano(mt + jitter(0.01), m, dur * 0.95, M.melody * (0.9 + Math.random() * 0.15));
      else if (voice === 'flute') {
        flute(mt, m, dur * 0.92, M.melody * 0.55);
        bell(mt, m + 12, M.sparkle);
      }
      mt += dur;
    }
    if (voice === 'rest' && Math.random() < 0.6) {
      const note = SPARKLE_NOTES[Math.floor(Math.random() * SPARKLE_NOTES.length)];
      bell(t + beat * Math.floor(Math.random() * 3), note, M.sparkle * 1.4);
    }

    barIndex = (barIndex + 1) % SONG.length;
    if (barIndex === 0) cycle++;
  }

  return {
    // Schedule every bar that starts before `until` (seconds on the context clock).
    scheduleUntil(until) {
      if (nextBar < ctx.currentTime) nextBar = ctx.currentTime + 0.08;
      while (nextBar < until) {
        scheduleBar(nextBar);
        nextBar += (3 * 60) / M.tempo;
      }
    },
  };
}
