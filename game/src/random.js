// A tiny seeded random generator (mulberry32) so the world is identical on
// every load and in every screenshot: the town, the trees and the clouds are
// placed from a fixed seed, never from Math.random.

export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngRange(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

export function rngPick(rng, arr) {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}
