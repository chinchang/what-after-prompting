import './style.css';
import { ACTIVITIES } from './activities.js';
import { createStage } from './stage.js';
import { CONFIG } from './config.js';
import { createAudio } from './audio.js';

const $ = (sel) => document.querySelector(sel);
const N = ACTIVITIES.length;
const BASE_TITLE = document.title;

const stage = createStage($('#scene'), ACTIVITIES);

let filter = 'all';
let mode = 'browse';
let shown = -1;

const matches = (i) => filter === 'all' || ACTIVITIES[i].duration === filter;

function stepFrom(from, dir) {
  for (let k = 1; k <= N; k++) {
    const i = (((from + dir * k) % N) + N) % N;
    if (matches(i)) return i;
  }
  return from;
}

/* ---------- card ---------- */

const card = $('#card');

function render(i, quick = false) {
  if (i === shown) return;
  shown = i;
  const a = ACTIVITIES[i];
  $('#count').textContent = `${String(i + 1).padStart(2, '0')} / ${N}`;
  $('#duration').textContent = a.time;
  $('#duration').dataset.kind = a.duration;
  $('#title').textContent = a.title;
  $('#blurb').textContent = a.blurb;
  card.classList.remove('swap', 'swap-quick');
  void card.offsetWidth;
  card.classList.add(quick ? 'swap-quick' : 'swap');
}

stage.onFront((i, moving) => render(i, moving));
stage.onSettle((i) => {
  render(i);
  card.classList.remove('spinning');
});

function go(i, opts) {
  if (mode !== 'browse') return;
  stage.animateTo(i, opts);
}

const next = () => go(stepFrom(stage.targetIndex, 1));
const prev = () => go(stepFrom(stage.targetIndex, -1));

function spin() {
  if (mode !== 'browse') return;
  const pool = ACTIVITIES.map((_, i) => i).filter((i) => matches(i) && i !== stage.targetIndex);
  if (!pool.length) return;
  const i = pool[Math.floor(Math.random() * pool.length)];
  card.classList.add('spinning');
  go(i, { spins: 1 });
}

$('#next').addEventListener('click', next);
$('#prev').addEventListener('click', prev);
$('#spin').addEventListener('click', spin);

stage.onPick(({ index, swipe }) => {
  if (swipe) return swipe > 0 ? next() : prev();
  if (index === stage.targetIndex) return;
  if (!matches(index)) setFilter('all');
  go(index);
});

/* ---------- filters ---------- */

function setFilter(f) {
  filter = f;
  document.querySelectorAll('#filters button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === f)));
  stage.setDimmed((i) => !matches(i));
  if (!matches(stage.targetIndex)) {
    const forward = stepFrom(stage.targetIndex, 1);
    const back = stepFrom(stage.targetIndex, -1);
    const dist = (j) => Math.min((j - stage.targetIndex + N) % N, (stage.targetIndex - j + N) % N);
    go(dist(forward) <= dist(back) ? forward : back);
  }
}
$('#filters').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-filter]');
  if (b) setFilter(b.dataset.filter);
});

/* ---------- doing mode ---------- */

let awayStart = 0;
const fmt = (ms) => {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

function commit() {
  if (mode !== 'browse' || stage.busy) return;
  const a = ACTIVITIES[stage.targetIndex];
  mode = 'doing';
  awayStart = Date.now();
  $('#doing-title').textContent = a.title;
  $('#doing-tip').textContent = a.tip;
  $('#away').textContent = '0:00';
  card.dataset.mode = 'doing';
  document.title = `${a.title} · ${BASE_TITLE}`;
  stage.setFocus(true);
  audio.setFocus(true);
  $('#back').focus({ preventScroll: true });
}

function release() {
  if (mode !== 'doing') return;
  mode = 'browse';
  card.dataset.mode = 'browse';
  document.title = BASE_TITLE;
  stage.setFocus(false);
  audio.setFocus(false);
  $('#go').focus({ preventScroll: true });
}

$('#go').addEventListener('click', commit);
$('#back').addEventListener('click', release);
$('#other').addEventListener('click', () => {
  release();
  spin();
});

setInterval(() => {
  if (mode === 'doing') $('#away').textContent = fmt(Date.now() - awayStart);
}, 250);

/* ---------- music ---------- */

const audio = createAudio();
stage.setSfx(() => audio.sfx);
const musicButton = $('#music');
const MUSIC_KEY = 'wap-sound';
const readPref = () => {
  try {
    return localStorage.getItem(MUSIC_KEY);
  } catch {
    return null;
  }
};
const savePref = (on) => {
  try {
    localStorage.setItem(MUSIC_KEY, on ? 'on' : 'off');
  } catch {}
};
const wantsMusic = (readPref() ?? (CONFIG.sound.onByDefault ? 'on' : 'off')) === 'on';

function setMusic(on) {
  if (on) audio.enable();
  else audio.disable();
  musicButton.setAttribute('aria-pressed', String(on));
}
function toggleMusic() {
  const on = !audio.on;
  setMusic(on);
  savePref(on);
}
musicButton.addEventListener('click', toggleMusic);

// Browsers block sound until the visitor interacts, so start on their first click or key press.
if (wantsMusic) {
  const kick = (e) => {
    if (e.target.closest?.('#music') || e.key === 'm' || e.key === 'M') return;
    window.removeEventListener('pointerdown', kick, true);
    window.removeEventListener('keydown', kick, true);
    setMusic(true);
  };
  window.addEventListener('pointerdown', kick, true);
  window.addEventListener('keydown', kick, true);
}

/* ---------- keyboard ---------- */

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const onButton = e.target instanceof HTMLButtonElement;
  if (e.key === 'm' || e.key === 'M') return toggleMusic();
  if (mode === 'doing') {
    if (e.key === 'Escape') release();
    return;
  }
  if (e.key === 'ArrowRight') next();
  else if (e.key === 'ArrowLeft') prev();
  else if (e.key === ' ' && !onButton) {
    e.preventDefault();
    spin();
  } else if (e.key === 'Enter' && !onButton) commit();
});

/* ---------- day / night ---------- */

// ?time=day or ?time=night overrides the clock (handy for previewing).
const TIME = CONFIG.timeOfDay;
const forced = new URLSearchParams(location.search).get('time') || (TIME.mode !== 'auto' ? TIME.mode : null);
function isNight() {
  if (forced === 'night' || forced === 'day') return forced === 'night';
  const now = new Date();
  const h = now.getHours() + now.getMinutes() / 60;
  return h >= TIME.nightStartsAt || h < TIME.dayStartsAt;
}
function syncTime(instant = false) {
  const night = isNight();
  stage.setNight(night, instant);
  document.body.dataset.time = night ? 'night' : 'day';
  document.querySelector('meta[name="theme-color"]').content = night ? '#182850' : '#8ec5e8';
}
syncTime(true);
setInterval(syncTime, 60 * 1000);

/* ---------- start ---------- */

const start = Math.floor(Math.random() * N);
stage.jumpTo(start);
render(start);

let ready = false;
function reveal() {
  if (ready) return;
  ready = true;
  requestAnimationFrame(() => document.body.classList.add('ready'));
  setTimeout(() => $('#intro').remove(), 2600);
}
stage.onFirstFrame(reveal);
setTimeout(reveal, CONFIG.ui.introFallbackMs);

// Keeps the mobile filter bar sitting just above the card.
new ResizeObserver(() => document.documentElement.style.setProperty('--card-h', `${card.offsetHeight}px`)).observe(card);
