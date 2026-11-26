// Skyline Run — deterministic screenshot scenes. The harness loads the game
// with ?shot=start|play|end (and ?seed=), and these presets put the plane
// and the camera exactly where the screenshot should be, with no input.
// The same states are reachable by playing, so the screenshots are honest
// renders of the game's own code.
import { CONFIG } from './config.js';

export function applyShot(game, shot, seed) {
  if (seed) game.seed = seed;
  if (shot === 'start') {
    // On the runway, nose into the valley, title panel up, a ring visible
    // far ahead and the town and ridge on the horizon.
    game.phase = 'title';
    game.x = 0; game.y = 4; game.z = 0;
    game.heading = 0; game.pitch = 0.02; game.roll = 0;
    game.speed = 0; game.throttle = 0;
    game.score = 0; game.rings = 0; game.nextRing = 0;
    game.timeLeft = CONFIG.timeLimit;
  } else if (shot === 'play') {
    // Mid-flight: climbing out of the river bend toward ring 4 above the
    // lakeside town, throttle high, a perfect line on the next ring.
    game.phase = 'flying';
    game.x = -110; game.y = 132; game.z = 3050;
    game.heading = 0.08; game.pitch = 0.12; game.roll = -0.22;
    game.speed = 168; game.throttle = 0.82;
    game.score = 365; game.rings = 3; game.nextRing = 3;
    game.combo = 3; game.timeLeft = 142; game.time = 38;
    game.fuel = 72;
    game.ringFlash = 0.9; game.ringMessage = 'RING 3  +115';
    game.distance = 3050;
  } else if (shot === 'end') {
    // Finished flight over the lake: all 12 rings, score on the board.
    game.phase = 'done';
    game.finished = true;
    game.reason = 'Course complete — every ring flown.';
    game.x = -40; game.y = 95; game.z = 11200;
    game.heading = 0; game.pitch = 0; game.roll = 0;
    game.speed = 120; game.throttle = 0.5;
    game.score = 1480; game.rings = 12; game.nextRing = 12;
    game.perfects = 4; game.bestCombo = 7; game.combo = 7;
    game.timeLeft = 34; game.time = 146; game.distance = 11200;
  }
  return game;
}
