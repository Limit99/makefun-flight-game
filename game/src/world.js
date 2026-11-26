// Skyline Run v2 — the world definition, shared by the physics in main.js
// and the 3D scene in render.js so the ground you see is the ground you hit.
//
// The valley runs along -Z. You take off from the home runway at z ~ 0, fly
// twelve golden rings down the valley, and land on the far runway beside the
// lake at z ~ -3250. Everything is analytic or seeded: same world every load.

import { CONFIG } from './config.js';
import { makeRng, rngRange } from './random.js';

export const WORLD = {
  seed: 20261126,
  length: 3600,          // terrain extent along z (0 .. -length)
  width: 900,            // terrain extent along x (-width/2 .. width/2)
  floorY: 2,             // valley floor height
  homeRunway: { x: 0, zTop: 90, zBot: -190, halfWidth: 15 },
  farRunway: { x: 0, zTop: -3060, zBot: -3380, halfWidth: 15 },
  lake: { x: 150, z: -2950, r: 175 },
  riverAmp: 26,
  riverFreq: 0.0035,
};

export function riverX(z) {
  return WORLD.riverAmp * Math.sin(z * WORLD.riverFreq);
}

function inRunway(x, z, r) {
  return Math.abs(x - r.x) <= r.halfWidth + 6 && z <= r.zTop + 10 && z >= r.zBot - 10;
}

// Ground height at any point. Order matters: valley shape first, then the
// river and lake carve down, then the runways flatten everything back.
export function terrainHeight(x, z) {
  const ax = Math.abs(x);
  let h = WORLD.floorY;

  // Valley walls rising on both sides, steeper the further out you go.
  if (ax > 70) {
    const t = ax - 70;
    h += t * t * 0.0022;
  }
  // Rolling shoulders so the walls are not smooth cones.
  h += Math.max(0, ax - 55) * 0.05 * Math.sin(z * 0.008 + x * 0.01);
  h += 6 * Math.sin(z * 0.0016 + 1.7) * Math.cos(x * 0.0021) * Math.min(1, Math.max(0, (ax - 90) / 120));
  // Gentle undulation on the valley floor itself, kept out of the corridor.
  if (ax > 34) h += 1.6 * Math.sin(x * 0.05) * Math.cos(z * 0.021);

  // River channel carved down to water level.
  const rd = Math.abs(x - riverX(z));
  if (rd < 15) h = Math.min(h, 0.2 + rd * 0.12);

  // The lake basin at the far end.
  const ld = Math.hypot(x - WORLD.lake.x, z - WORLD.lake.z);
  if (ld < WORLD.lake.r) h = Math.min(h, 0.2);

  // Runways are dead flat.
  if (inRunway(x, z, WORLD.homeRunway) || inRunway(x, z, WORLD.farRunway)) return WORLD.floorY;
  return h;
}

export function onRunway(x, z, r) {
  return Math.abs(x - r.x) <= r.halfWidth && z <= r.zTop && z >= r.zBot;
}

// The twelve rings: weaving side to side and up and down down the valley.
export function buildRings() {
  const rings = [];
  for (let i = 0; i < CONFIG.ringCount; i++) {
    rings.push({
      index: i,
      x: 34 * Math.sin(i * 1.7),
      y: 27 + 10 * Math.sin(i * 2.3),
      z: -330 - i * 235,
      r: CONFIG.ringRadius,
    });
  }
  return rings;
}

// Two towns of seeded boxes. Buildings are solid: main.js checks collisions
// against this same list.
export function buildBuildings() {
  const rng = makeRng(WORLD.seed ^ 0x7a09);
  const out = [];
  const clusters = [
    { cx: -108, cz: -1080, n: 46, spread: 62 },
    { cx: -118, cz: -2480, n: 26, spread: 48 },
    { cx: 96, cz: -1720, n: 14, spread: 34 },
  ];
  const palette = [0xd9c9a8, 0xb8c4cc, 0xc98f6a, 0xa8b89a, 0xd6d6d6, 0xc4a4a4];
  for (const c of clusters) {
    for (let i = 0; i < c.n; i++) {
      const x = c.cx + rngRange(rng, -c.spread, c.spread);
      const z = c.cz + rngRange(rng, -c.spread, c.spread);
      if (Math.abs(x) < 46) continue; // keep the flight corridor clear
      const w = rngRange(rng, 9, 17);
      const d = rngRange(rng, 9, 17);
      const h = rngRange(rng, 9, 30) * (rng() < 0.12 ? 1.7 : 1);
      out.push({ x, z, w, d, h, color: palette[Math.floor(rng() * palette.length)] });
    }
  }
  return out;
}

// Seeded low-poly trees on the valley floor and lower slopes.
export function buildTrees() {
  const rng = makeRng(WORLD.seed ^ 0x3f51);
  const out = [];
  for (let i = 0; i < 340; i++) {
    const x = rngRange(rng, -330, 330);
    const z = rngRange(rng, 60, -3450);
    if (Math.abs(x) < 30) continue;                    // corridor + runways
    if (Math.abs(x - riverX(z)) < 17) continue;        // not in the river
    const ld = Math.hypot(x - WORLD.lake.x, z - WORLD.lake.z);
    if (ld < WORLD.lake.r + 6) continue;               // not in the lake
    const y = terrainHeight(x, z);
    if (y > 46) continue;                              // treeline
    out.push({ x, z, y, s: rngRange(rng, 0.8, 1.5) });
  }
  return out;
}

// Soft billboard-free clouds: clusters of flattened white spheres, seeded.
export function buildClouds() {
  const rng = makeRng(WORLD.seed ^ 0x99aa);
  const out = [];
  for (let i = 0; i < 26; i++) {
    out.push({
      x: rngRange(rng, -420, 420),
      y: rngRange(rng, 95, 150),
      z: rngRange(rng, 120, -3500),
      s: rngRange(rng, 22, 46),
      puffs: 3 + Math.floor(rng() * 3),
    });
  }
  return out;
}
