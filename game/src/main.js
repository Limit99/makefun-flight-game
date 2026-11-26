// Skyline Run — boot and the game loop. A fixed canvas (1280x720) scaled to
// the window, requestAnimationFrame, and a status line for screen readers.
// No network: every file the game loads lives under game/.
import { CONFIG } from './config.js';
import { newGame, stepGame } from './world.js';
import { render } from './render.js';
import { createInput, inCentrePanel } from './input.js';
import { createAudio } from './audio.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || CONFIG.seed) || CONFIG.seed;
const shot = params.get('shot') || '';

let game = newGame(seed);
if (shot) applyShot(game, shot, seed);

const audio = createAudio();
let lastStatus = '';

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = CONFIG.width * dpr;
  canvas.height = CONFIG.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

function announce() {
  const text = game.phase === 'flying'
    ? `Flying: ring ${Math.min(game.rings + 1, CONFIG.ringCount)} of ${CONFIG.ringCount}, ` +
      `score ${game.score}, altitude ${Math.round(game.y * 3.28)} feet, ` +
      `speed ${Math.round(game.speed)} knots, ${Math.ceil(game.timeLeft)} seconds left.`
    : game.phase === 'done'
      ? `Flight over. Score ${game.score}, ${game.rings} of ${CONFIG.ringCount} rings. ${game.reason}`
      : 'Skyline Run. Press Enter to take off.';
  if (text !== lastStatus) { statusEl.textContent = text; lastStatus = text; }
}

function startFlight() {
  audio.ensure();
  audio.click();
  const keepScore = game.phase === 'done' ? 0 : 0;
  void keepScore;
  game = newGame(seed);
  game.phase = 'flying';
  game.throttle = 0.55;
  game.speed = 60;
}

const input = createInput(canvas, {
  onPress(code) {
    audio.ensure();
    if (code === 'Enter') {
      if (game.phase === 'title' || game.phase === 'done') startFlight();
    } else if (code === 'KeyR') {
      if (game.phase !== 'title') startFlight();
    } else if (code === 'KeyP' || code === 'Escape') {
      if (game.phase === 'flying') { game.phase = 'paused'; }
      else if (game.phase === 'paused') { game.phase = 'flying'; }
    } else if (code === 'KeyM') {
      game.muted = !game.muted;
      audio.setMuted(game.muted);
    } else if (code === 'Space') {
      if (game.phase === 'flying') {
        game.roll = 0; game.heading *= 0.4; game.pitch *= 0.4;
      }
    }
  },
  onClick(x, y) {
    audio.ensure();
    if ((game.phase === 'title' || game.phase === 'done') && inCentrePanel(x, y)) startFlight();
  },
});

let last = performance.now();
let eventCooldown = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  eventCooldown = Math.max(0, eventCooldown - dt);

  if (game.phase === 'flying') {
    const held = input.poll();
    const ev = stepGame(game, held, dt);
    if (ev && eventCooldown <= 0) {
      eventCooldown = 0.15;
      if (ev === 'ring') audio.ring(game.ringMessage.includes('PERFECT'));
      else if (ev === 'miss') audio.miss();
      else if (ev === 'crashed' || ev === 'crashed-done') audio.crash();
      else if (ev === 'finished' || ev === 'timeout') audio.finish();
    }
  } else if (game.phase === 'crashed') {
    game.crashTimer -= dt;
    if (game.crashTimer <= 0 && game.lives > 0) game.phase = 'flying';
  }
  audio.update(game);
  render(ctx, game);
  announce();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
