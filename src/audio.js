// One AudioContext for music + island sound effects, behind a single on/off switch.
import { CONFIG } from './config.js';
import { createEngine } from './music.js';
import { createSfx, SILENT } from './sfx.js';

export function createAudio() {
  let ctx = null;
  let master = null;
  let engine = null;
  let sfx = null;
  let timer = null;
  let stopTimer = null;
  let on = false;
  let focused = false;

  function init() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);

    const musicBus = ctx.createGain();
    musicBus.gain.value = CONFIG.music.volume;
    musicBus.connect(master);
    engine = createEngine(ctx, musicBus);

    const sfxBus = ctx.createGain();
    sfxBus.gain.value = CONFIG.sfx.volume;
    sfxBus.connect(master);
    sfx = createSfx(ctx, sfxBus);
    sfx.setFocus(focused);
  }

  // Audible tabs aren't throttled, but look further ahead when hidden just in case.
  const pump = () => engine.scheduleUntil(ctx.currentTime + (document.hidden ? 1.5 : 0.4));
  const fade = CONFIG.sound.fadeSeconds;

  return {
    get on() {
      return on;
    },
    // Sound effects for the scene; silent while sound is off.
    get sfx() {
      return on && CONFIG.sfx.enabled ? sfx : SILENT;
    },
    setFocus(value) {
      focused = value;
      sfx?.setFocus(value);
    },
    enable() {
      if (on) return;
      if (!ctx) init();
      on = true;
      clearTimeout(stopTimer);
      ctx.resume();
      if (CONFIG.music.enabled) {
        pump();
        timer ??= setInterval(pump, 60);
      }
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(1, ctx.currentTime, fade / 3);
    },
    disable() {
      if (!on) return;
      on = false;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0, ctx.currentTime, fade / 4);
      stopTimer = setTimeout(() => {
        clearInterval(timer);
        timer = null;
        ctx.suspend();
      }, fade * 1000 + 200);
    },
  };
}
