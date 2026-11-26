// Skyline Run — the world: terrain height, the river, the town, the lake,
// the runway, the rings, and the flight model. No rendering here, only
// numbers, so the physics can be tested without a canvas.
import { CONFIG, ringCourse } from './config.js';
import { noise2, noise2Big, mulberry32 } from './random.js';

// River centre line: it snakes down the valley from the mountains to the lake.
export function riverX(z) {
  const r = CONFIG.river;
  return r.baseX + Math.sin(z / r.wavelength) * r.amplitude;
}

// Height of the ground (metres) at world (x, z). The valley floor sits near
// 0, the walls rise toward |x| = 420, and a mountain ridge crosses the
// course around z 6800–8600. The runway and the town are flattened.
export function groundHeight(x, z, seed = CONFIG.seed) {
  const wall = Math.pow(Math.min(1, Math.abs(x) / CONFIG.worldHalfWidth), 2.2);
  let h = 14 + wall * 120;
  h += noise2(x, z, seed) * 16 + noise2Big(x, z, seed) * 34;
  // Mountain ridge: a smooth bump that peaks mid-course.
  const m = CONFIG.mountains;
  const mt = Math.exp(-Math.pow((z - (m.z0 + m.z1) / 2) / 1100, 2));
  h += mt * (m.peak * (0.45 + 0.55 * (0.5 + 0.5 * noise2Big(x * 0.5, 0, seed))));
  // River valley: the ground dips toward the water.
  const dRiver = Math.abs(x - riverX(z));
  h -= Math.max(0, 1 - dRiver / 130) * 22;
  // Lake: flat water at the end of the course.
  const lake = CONFIG.lake;
  if (z > lake.z0 && x > lake.x0 && x < lake.x1) h = Math.min(h, 2);
  // Runway strip: flat, so take-off and the start screenshot are clean.
  const rw = CONFIG.runway;
  if (z > rw.z0 && z < rw.z1 && Math.abs(x - rw.x) < rw.halfWidth + 14) h = 2;
  // Town: flattened pads under the buildings.
  const c = CONFIG.city;
  if (z > c.z0 && z < c.z1 && x > c.x0 && x < c.x1) h = Math.min(h, 26);
  return Math.max(0, h);
}

// Town buildings: deterministic boxes on the flattened town pad.
export function townBuildings(seed = CONFIG.seed) {
  const rnd = mulberry32(seed + 99);
  const out = [];
  const c = CONFIG.city;
  for (let gx = 0; gx < 7; gx++) {
    for (let gz = 0; gz < 5; gz++) {
      if (rnd() < 0.22) continue; // streets and squares stay open
      const x = c.x0 + 30 + gx * 52 + (rnd() - 0.5) * 12;
      const z = c.z0 + 40 + gz * 130 + (rnd() - 0.5) * 20;
      const w = 22 + rnd() * 18;
      const d = 22 + rnd() * 18;
      const h = 26 + rnd() * rnd() * 70;
      out.push({ x, z, w, d, h });
    }
  }
  return out;
}

// Clouds: soft billboards floating above the valley, deterministic.
export function clouds(seed = CONFIG.seed) {
  const rnd = mulberry32(seed + 31);
  const out = [];
  for (let i = 0; i < 26; i++) {
    out.push({
      x: (rnd() - 0.5) * 900,
      y: 300 + rnd() * 220,
      z: rnd() * CONFIG.courseLength,
      s: 60 + rnd() * 120,
    });
  }
  return out;
}

export function newGame(seed = CONFIG.seed) {
  return {
    seed,
    phase: 'title', // title | flying | paused | crashed | done
    time: 0,
    timeLeft: CONFIG.timeLimit,
    score: 0,
    rings: 0,
    lives: CONFIG.lives,
    combo: 0,
    bestCombo: 0,
    fuel: CONFIG.fuelMax,
    // The plane starts on the runway, nose into the valley.
    x: 0, y: 4, z: 0,
    heading: 0, pitch: 0, roll: 0,
    speed: 0, throttle: 0,
    verticalSpeed: 0,
    ringList: ringCourse(seed),
    nextRing: 0,
    ringFlash: 0, // seconds left of the "ring passed" flash
    ringMessage: '',
    crashTimer: 0,
    distance: 0,
    perfects: 0,
    startedAt: 0,
    finished: false,
    reason: '',
    muted: false,
    buildings: townBuildings(seed),
    cloudList: clouds(seed),
    trail: [], // recent positions, for the faint contrail
  };
}

export function nextRingOf(game) {
  return game.ringList[game.nextRing] ?? null;
}

// One physics step. `input` carries steer (-1..1), pitch (-1..1),
// throttleDelta (-1..1) and dt in seconds. Returns an event string or ''.
export function stepGame(game, input, dt) {
  if (game.phase !== 'flying') return '';
  dt = Math.min(dt, 0.05);
  game.time += dt;
  game.timeLeft = Math.max(0, CONFIG.timeLimit - game.time + game.rings * 0);
  // Fuel: it drains with the throttle, and an empty tank means the engine
  // is out — the plane glides, sinks, and the ground ends the flight.
  game.fuel = Math.max(0, game.fuel - (CONFIG.fuelDrainBase + CONFIG.fuelDrainThrottle * game.throttle) * dt);
  if (game.fuel <= 0) game.throttle = 0;
  // Time bonus is banked directly into timeLeft when a ring is passed.
  game.throttle = Math.max(0, Math.min(1, game.throttle + input.throttleDelta * dt * 0.7));
  const targetSpeed = game.throttle * CONFIG.maxSpeed;
  game.speed += (targetSpeed - game.speed) * Math.min(1, dt * 0.55);
  if (game.speed < CONFIG.minSpeed && game.y > 8) game.pitch -= 0.12 * dt;

  // Steering: bank into the turn, heading follows the bank.
  const targetRoll = input.steer * CONFIG.maxRoll;
  game.roll += (targetRoll - game.roll) * Math.min(1, dt * 5);
  game.heading += -game.roll * CONFIG.turnRate * dt * (0.35 + game.speed / CONFIG.maxSpeed);
  game.heading = Math.max(-0.85, Math.min(0.85, game.heading));
  // Pitch: pull up to climb, push down to dive; with no input the plane
  // trims slightly nose-up, so it lifts off the runway instead of
  // lawn-darting into the field past the threshold.
  const targetPitch = input.pitch === 0 ? 0.08 : input.pitch * CONFIG.maxPitch;
  game.pitch += (targetPitch - game.pitch) * Math.min(1, dt * 4);
  const climb = Math.sin(game.pitch) * CONFIG.climbRate * (0.4 + game.speed / CONFIG.maxSpeed);
  game.verticalSpeed = climb;
  game.y = Math.max(0, game.y + climb * dt);
  game.y = Math.min(620, game.y);
  const forward = Math.max(0, game.speed);
  game.z += Math.cos(game.heading) * forward * dt * 0.9;
  game.x += -Math.sin(game.heading) * forward * dt * 0.9;
  game.x = Math.max(-CONFIG.worldHalfWidth, Math.min(CONFIG.worldHalfWidth, game.x));
  game.distance += forward * dt * 0.9;
  game.trail.push({ x: game.x, y: game.y, z: game.z });
  if (game.trail.length > 40) game.trail.shift();
  if (game.ringFlash > 0) game.ringFlash -= dt;

  // Rings: crossing a ring's plane inside its circle scores.
  const ring = nextRingOf(game);
  if (ring) {
    const prevZ = game.z - Math.cos(game.heading) * forward * dt * 0.9;
    if (prevZ < ring.z && game.z >= ring.z) {
      const dx = game.x - ring.x, dy = game.y - ring.y;
      const d = Math.hypot(dx, dy);
      if (d < ring.r) {
        const perfect = d < ring.r * 0.34;
        game.rings++;
        game.combo++;
        game.bestCombo = Math.max(game.bestCombo, game.combo);
        if (perfect) game.perfects++;
        const gained = CONFIG.ringScore + (perfect ? CONFIG.perfectBonus : 0) + game.combo * 5;
        game.score += gained;
        // Bank the time bonus straight into the remaining time, and
        // refuel: rings are the only fuel on the course.
        game.timeLeft = Math.min(CONFIG.timeLimit, game.timeLeft + CONFIG.ringTimeBonus);
        game.time -= CONFIG.ringTimeBonus;
        game.fuel = Math.min(CONFIG.fuelMax, game.fuel + CONFIG.fuelPerRing);
        game.nextRing++;
        game.ringFlash = 1.4;
        game.ringMessage = perfect ? `PERFECT +${gained}` : `RING ${game.rings}  +${gained}`;
        if (game.nextRing >= game.ringList.length) {
          game.phase = 'done';
          game.finished = true;
          game.reason = 'Course complete — every ring flown.';
          return 'finished';
        }
        return 'ring';
      }
      // Crossed the plane outside the ring: the ring is missed, combo resets.
      game.combo = 0;
      game.nextRing++;
      game.ringFlash = 1.0;
      game.ringMessage = 'RING MISSED';
      if (game.nextRing >= game.ringList.length) {
        game.phase = 'done';
        game.finished = true;
        game.reason = 'Course complete — every ring flown.';
        return 'finished';
      }
      return 'miss';
    }
  }

  // Terrain: flying into the ground (or a mountain) is a crash. The plane
  // starts on the runway at y=4 over ground 2, so the check needs a tight
  // margin and must ignore the runway strip itself, or take-off would
  // crash on the first frame.
  const ground = groundHeight(game.x, game.z, game.seed);
  const onRunway = game.z > CONFIG.runway.z0 && game.z < CONFIG.runway.z1
    && Math.abs(game.x - CONFIG.runway.x) < CONFIG.runway.halfWidth + 14;
  if (game.y <= ground + 1.5 && game.speed > 20 && !onRunway) {
    game.lives--;
    game.score = Math.max(0, game.score - CONFIG.crashPenalty);
    game.combo = 0;
    if (game.lives <= 0) {
      game.phase = 'done';
      game.finished = true;
      game.reason = 'Crashed into the terrain — out of airframes.';
      return 'crashed-done';
    }
    // Respawn just behind the next ring, level and slow, and keep flying.
    // The spare airframe comes with a quarter tank from the ground crew.
    const target = nextRingOf(game) ?? { x: 0, y: 150, z: game.z + 400 };
    game.x = target.x; game.y = target.y + 30; game.z = Math.max(0, target.z - 500);
    game.heading = 0; game.pitch = 0; game.roll = 0; game.speed = 90;
    game.throttle = 0.55;
    game.fuel = Math.max(game.fuel, 25);
    game.phase = 'crashed';
    game.crashTimer = 1.6;
    return 'crashed';
  }

  // Out of time ends the flight; the lake at the end of the course is the
  // natural finish line, so reaching it also ends it cleanly.
  if (game.timeLeft <= 0) {
    game.phase = 'done';
    game.finished = true;
    game.reason = 'Time up — the flight window closed.';
    return 'timeout';
  }
  if (game.z >= CONFIG.courseLength) {
    game.phase = 'done';
    game.finished = true;
    game.reason = 'Landed the course — across the lake.';
    return 'finished';
  }
  return '';
}

// Heading in degrees, 360 = due north up the valley.
export function headingDegrees(game) {
  return Math.round(((360 - (game.heading * 180) / Math.PI) % 360 + 360) % 360);
}
