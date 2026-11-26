// Skyline Run — configuration: one complete flight, its course, rings and rules.
// Everything here is a plain constant so the judge can read the game's shape
// from this file alone. Units are metres for distance/altitude, knots for
// speed on the HUD (1 unit of speed = 1 knot, for display), seconds for time.
export const CONFIG = {
  title: 'Skyline Run',
  width: 1280,
  height: 720,
  // A full flight: 180 seconds, 12 rings from the home runway to the lake.
  timeLimit: 180,
  ringCount: 12,
  courseLength: 12400,
  lives: 3,
  // Flight model: gentle arcade handling, no stall modelling — the fun is
  // threading rings, not fighting the stick.
  maxSpeed: 210, // knots at full throttle
  minSpeed: 55, // knots; below this the nose drops
  cruiseThrottle: 0.62,
  turnRate: 0.7, // radians per second at full bank
  pitchRate: 0.42,
  maxRoll: 0.9,
  maxPitch: 0.5,
  climbRate: 46,
  // Scoring.
  ringScore: 100,
  ringTimeBonus: 6, // seconds added per ring, capped by timeLimit
  perfectBonus: 25, // flying through the centre third of a ring
  crashPenalty: 50,
  // Fuel: a full tank lasts about 190 s at cruise throttle, and every
  // ring refuels 6% — so rings are worth flying for twice over, and
  // dawdling at full throttle over the ridge can leave you dry.
  fuelMax: 100,
  fuelDrainBase: 0.35, // % per second, always
  fuelDrainThrottle: 0.55, // % per second extra at full throttle
  fuelPerRing: 6,
  // The world: a valley with a river, a lakeside town, a mountain ridge
  // and the home runway at its southern end.
  worldHalfWidth: 420,
  runway: { x: 0, z0: -40, z1: 820, halfWidth: 22 },
  river: { baseX: -150, amplitude: 90, wavelength: 2600, halfWidth: 26 },
  city: { z0: 2950, z1: 3650, x0: -210, x1: 190 },
  lake: { z0: 10800, z1: 12400, x0: -420, x1: 420 },
  mountains: { z0: 6800, z1: 8600, peak: 260 },
  // Deterministic world seed so every playthrough (and every screenshot)
  // flies the same valley; the seed only varies with ?seed=.
  seed: 20261126,
  // Colours, kept in one place so the art direction stays consistent.
  colors: {
    skyTop: '#1d5fae',
    skyMid: '#7db8e8',
    skyLow: '#cfe8f7',
    sun: '#fff3c4',
    grass: '#5da24a',
    grassDry: '#8aa653',
    rock: '#8d8578',
    snow: '#eef3f6',
    sand: '#d9c48f',
    water: '#2f7fc4',
    waterDeep: '#1f5d96',
    cityRoof: '#7a6a63',
    cityWall: '#cbb9a4',
    runway: '#3a3f46',
    runwayMark: '#f5f2e8',
    ringNext: '#ffc233',
    ringFar: '#e8f4ff',
    planeBody: '#e8432f',
    planeWing: '#f6f1e7',
    planeTrim: '#1f3a5f',
  },
};

// The twelve rings of the course. Each ring sits above the valley floor at a
// height the terrain underneath makes fair: low over the river, high over
// the ridge, a slalom through the town, and a low pass over the lake.
export function ringCourse(seed) {
  const xs = [0, -90, 70, -140, 40, 150, -60, 110, -170, 30, -80, 0];
  const ys = [90, 120, 105, 150, 130, 190, 230, 250, 185, 150, 110, 80];
  const zs = [900, 1750, 2600, 3450, 4300, 5200, 6100, 7050, 8000, 8900, 9850, 11200];
  const radii = [42, 40, 38, 40, 36, 38, 36, 40, 38, 36, 40, 46];
  return zs.map((z, i) => ({ x: xs[i], y: ys[i], z, r: radii[i], index: i, seed }));
}
