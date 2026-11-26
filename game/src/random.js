// Seeded randomness for Skyline Run. A tiny mulberry32 plus a smooth 2D
// value-noise field: the terrain, the town and the clouds are all functions
// of the seed, so a screenshot with ?seed=1 always shows the same valley.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 974634211) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) / 4294967296) * 2 - 1;
}

function smooth(t) { return t * t * (3 - 2 * t); }

// Smooth noise in [-1, 1] at world scale: x and z are in metres.
export function noise2(x, z, seed) {
  const s = 0.004;
  const fx = x * s, fz = z * s;
  const ix = Math.floor(fx), iz = Math.floor(fz);
  const tx = smooth(fx - ix), tz = smooth(fz - iz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  const ab = a + (b - a) * tx, cd = c + (d - c) * tx;
  return ab + (cd - ab) * tz;
}

// A second, coarser octave for the big shapes (the ridge, the valley walls).
export function noise2Big(x, z, seed) {
  const s = 0.0011;
  const fx = x * s, fz = z * s;
  const ix = Math.floor(fx), iz = Math.floor(fz);
  const tx = smooth(fx - ix), tz = smooth(fz - iz);
  const a = hash2(ix, iz, seed + 7), b = hash2(ix + 1, iz, seed + 7);
  const c = hash2(ix, iz + 1, seed + 7), d = hash2(ix + 1, iz + 1, seed + 7);
  const ab = a + (b - a) * tx, cd = c + (d - c) * tx;
  return ab + (cd - ab) * tz;
}
