// Skyline Run v2 — tuning constants (three.js edition).
// One place for every number that shapes how the game feels, so the physics
// in main.js and the course in world.js stay consistent with each other.

export const CONFIG = {
  // Course
  ringCount: 12,
  ringRadius: 14,          // torus radius; pass detection uses this
  ringTube: 1.1,
  timeLimit: 180,          // seconds on the clock at take-off
  ringTimeBonus: 6,        // seconds added per ring
  lives: 3,

  // Scoring
  ringScore: 100,
  ringCentreBonus: 25,     // passing within 40% of the radius
  comboStep: 10,           // extra points per consecutive ring without a miss
  crashPenalty: 50,
  landingSmoothBonus: 300, // touchdown with gentle sink and low speed
  landingFirmBonus: 150,   // acceptable touchdown
  finishTimeBonusPerSec: 5,

  // Fuel — the resource decision: rings pay fuel back, cruising flat-out burns it
  fuelStart: 100,
  fuelDrainBase: 0.35,     // % per second, engine idling along
  fuelDrainThrottle: 0.55, // extra % per second at full throttle
  fuelPerRing: 6,          // % handed back per ring
  fuelLowWarn: 20,
  fuelRespawnFloor: 25,    // after a crash the tank is topped up to at least this

  // Flight model (arcade, units are metres-ish)
  minSpeed: 26,
  maxSpeed: 92,
  accelResponse: 0.55,     // how fast speed chases the throttle target, per second
  turnRate: 0.85,          // rad/s at full bank
  maxBank: 1.05,           // rad
  pitchRate: 1.15,         // rad/s at full stick
  maxPitch: 0.62,          // rad
  baseSink: 2.2,           // gentle descent at cruise when level
  windMax: 7,              // crosswind gust strength, m/s
  gravityPull: 9,          // extra sink when slow / nose high

  // Landing judgement on the far runway
  landMaxSpeed: 46,
  landMaxSink: 7.5,        // m/s downward at touchdown for a smooth rating
  landMaxSinkHard: 12,     // beyond this it is a crash, not a landing
};
