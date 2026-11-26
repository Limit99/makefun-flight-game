// Skyline Run — rendering: a chase view over a projected 3D valley.
// The scene is drawn in layers: sky and sun, distant peaks, the terrain
// mesh (near-to-far strips so nearer ground covers farther ground), the
// river, the town, the runway, the rings, the clouds, then the plane itself
// and the cockpit instruments. All art is drawn code — no images, no fonts
// from the network.
import { CONFIG } from './config.js';
import { groundHeight, riverX, nextRingOf, headingDegrees } from './world.js';
import { noise2Big } from './random.js';

const W = CONFIG.width, H = CONFIG.height;
const CX = W / 2;
const FOCAL = 620; // perspective focal length in pixels

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }

// Project a world point into screen space. Returns null behind the camera.
function project(game, wx, wy, wz) {
  const dz = wz - game.z;
  if (dz < 8) return null;
  const dx = wx - game.x;
  const dy = wy - game.y;
  const s = FOCAL / dz;
  // Roll the whole view around the centre, pitch moves the horizon.
  const horizon = H * 0.42 - game.pitch * 260;
  const sx = CX + dx * s;
  const sy = horizon - dy * s;
  return { x: sx, y: sy, s, dz };
}

function shade(base, f) {
  // base is [r,g,b]; f in [-0.25, 0.25] darkens/lightens.
  const c = base.map(v => Math.round(clamp(v + v * f, 0, 255)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function groundColor(x, z, h, seed) {
  const c = CONFIG.colors;
  const lake = CONFIG.lake;
  if (z > lake.z0 && x > lake.x0 && x < lake.x1) return c.waterDeep;
  if (Math.abs(x - riverX(z)) < CONFIG.river.halfWidth) return c.water;
  if (Math.abs(x - riverX(z)) < CONFIG.river.halfWidth + 14) return c.sand;
  const city = CONFIG.city;
  if (z > city.z0 && z < city.z1 && x > city.x0 && x < city.x1) return '#9a938a';
  if (h > 210) return c.snow;
  if (h > 150) return c.rock;
  if (h > 90) return shade([141, 133, 120], noise2Big(x, z, seed) * 0.12);
  const dry = noise2Big(x * 0.7, z * 0.7, seed + 3) > 0.25;
  return dry ? c.grassDry : c.grass;
}

function drawSky(ctx, game) {
  const c = CONFIG.colors;
  const altT = clamp(game.y / 500, 0, 1);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, c.skyTop);
  g.addColorStop(0.45, c.skyMid);
  g.addColorStop(0.72, c.skyLow);
  g.addColorStop(1, '#e8f2e4');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Sun, upper right, with a soft halo.
  const sx = W * 0.78, sy = 92 - game.pitch * 120;
  const halo = ctx.createRadialGradient(sx, sy, 8, sx, sy, 120);
  halo.addColorStop(0, 'rgba(255,243,196,0.95)');
  halo.addColorStop(0.25, 'rgba(255,243,196,0.45)');
  halo.addColorStop(1, 'rgba(255,243,196,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(sx - 130, sy - 130, 260, 260);
  ctx.fillStyle = c.sun;
  ctx.beginPath(); ctx.arc(sx, sy, 34, 0, Math.PI * 2); ctx.fill();
  // Distant peaks along the horizon, tilted by the roll.
  ctx.save();
  ctx.translate(CX, H * 0.42 - game.pitch * 260);
  ctx.rotate(-game.roll * 0.55);
  ctx.translate(-CX, -(H * 0.42 - game.pitch * 260));
  for (let i = 0; i < 9; i++) {
    const bx = (i / 8) * W * 1.2 - W * 0.1 + noise2Big(i * 91, 7, game.seed) * 60;
    const bh = 60 + Math.abs(noise2Big(i * 53, 11, game.seed)) * 150;
    const by = H * 0.42 - game.pitch * 260;
    ctx.fillStyle = i % 2 ? '#7d9cc4' : '#6b8db8';
    ctx.beginPath();
    ctx.moveTo(bx - 130, by); ctx.lineTo(bx, by - bh); ctx.lineTo(bx + 130, by);
    ctx.closePath(); ctx.fill();
    if (bh > 130) {
      ctx.fillStyle = 'rgba(238,243,246,0.9)';
      ctx.beginPath();
      ctx.moveTo(bx - 34, by - bh + 46); ctx.lineTo(bx, by - bh); ctx.lineTo(bx + 34, by - bh + 46);
      ctx.lineTo(bx + 14, by - bh + 58); ctx.lineTo(bx - 14, by - bh + 58);
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
}

function drawTerrain(ctx, game) {
  const horizon = H * 0.42 - game.pitch * 260;
  // Ground mesh: slices from far to near; each slice is a strip of quads
  // across the valley. Nearer slices are drawn last and cover farther ones.
  const slices = 34;
  const step = 150;
  const xs = [];
  for (let x = -CONFIG.worldHalfWidth; x <= CONFIG.worldHalfWidth; x += 60) xs.push(x);
  for (let si = slices - 1; si >= 0; si--) {
    const zFar = game.z + (si + 1) * step;
    const zNear = game.z + si * step;
    for (let xi = 0; xi < xs.length - 1; xi++) {
      const x0 = xs[xi], x1 = xs[xi + 1];
      const p00 = project(game, x0, groundHeight(x0, zNear, game.seed), zNear);
      const p10 = project(game, x1, groundHeight(x1, zNear, game.seed), zNear);
      const p01 = project(game, x0, groundHeight(x0, zFar, game.seed), zFar);
      const p11 = project(game, x1, groundHeight(x1, zFar, game.seed), zFar);
      if (!p00 || !p10 || !p01 || !p11) continue;
      const midX = (x0 + x1) / 2, midZ = (zNear + zFar) / 2;
      const h = groundHeight(midX, midZ, game.seed);
      ctx.fillStyle = groundColor(midX, midZ, h, game.seed);
      ctx.beginPath();
      ctx.moveTo(p00.x, p00.y); ctx.lineTo(p10.x, p10.y);
      ctx.lineTo(p11.x, p11.y); ctx.lineTo(p01.x, p01.y);
      ctx.closePath(); ctx.fill();
    }
  }
  // The ground below the horizon on the near side (the plane's own shadow
  // of ground) is filled so no sky shows through under the mesh.
  ctx.fillStyle = groundColor(game.x, game.z + 40, groundHeight(game.x, game.z + 40, game.seed), game.seed);
  ctx.fillRect(0, horizon + 180, W, H - horizon - 180);
}

function drawRunway(ctx, game) {
  const rw = CONFIG.runway;
  if (game.z > rw.z1 + 200) return;
  const corners = [
    project(game, rw.x - rw.halfWidth, 2.5, rw.z0),
    project(game, rw.x + rw.halfWidth, 2.5, rw.z0),
    project(game, rw.x + rw.halfWidth, 2.5, rw.z1),
    project(game, rw.x - rw.halfWidth, 2.5, rw.z1),
  ];
  if (corners.some(p => !p)) return;
  ctx.fillStyle = CONFIG.colors.runway;
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y); ctx.lineTo(corners[1].x, corners[1].y);
  ctx.lineTo(corners[2].x, corners[2].y); ctx.lineTo(corners[3].x, corners[3].y);
  ctx.closePath(); ctx.fill();
  // Centre dashes.
  ctx.fillStyle = CONFIG.colors.runwayMark;
  for (let z = rw.z0 + 60; z < rw.z1; z += 90) {
    const a = project(game, rw.x - 1.5, 3, z);
    const b = project(game, rw.x + 1.5, 3, z);
    const c2 = project(game, rw.x + 1.5, 3, z + 45);
    const d = project(game, rw.x - 1.5, 3, z + 45);
    if (!a || !b || !c2 || !d) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c2.x, c2.y); ctx.lineTo(d.x, d.y);
    ctx.closePath(); ctx.fill();
  }
  // Threshold bars at the far end.
  ctx.fillStyle = CONFIG.colors.runwayMark;
  const t = project(game, 0, 3, rw.z1 - 20);
  if (t) { ctx.font = 'bold 15px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('27', t.x, t.y - 6); }
}

function drawTown(ctx, game) {
  const city = CONFIG.city;
  if (game.z > city.z1 + 300 || game.z + 2600 < city.z0) return;
  for (const b of game.buildings) {
    const base = project(game, b.x, 26, b.z);
    if (!base || base.dz > 2600) continue;
    const top = project(game, b.x, 26 + b.h, b.z);
    if (!top) continue;
    const w = Math.max(3, (b.w / 2) * base.s);
    ctx.fillStyle = CONFIG.colors.cityWall;
    ctx.fillRect(base.x - w, top.y, w * 2, base.y - top.y);
    ctx.fillStyle = CONFIG.colors.cityRoof;
    ctx.beginPath();
    ctx.moveTo(base.x - w, top.y); ctx.lineTo(base.x, top.y - Math.max(4, w * 0.45)); ctx.lineTo(base.x + w, top.y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,180,0.85)';
    const win = Math.max(2, w * 0.22);
    ctx.fillRect(base.x - w * 0.5, top.y + (base.y - top.y) * 0.35, win, win);
    ctx.fillRect(base.x + w * 0.2, top.y + (base.y - top.y) * 0.6, win, win);
  }
}

function drawClouds(ctx, game) {
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  for (const cl of game.cloudList) {
    const p = project(game, cl.x, cl.y, cl.z);
    if (!p || p.dz > 5200) continue;
    const r = cl.s * p.s * 0.5;
    if (r < 2) continue;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.38, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.ellipse(p.x - r * 0.55, p.y + r * 0.1, r * 0.6, r * 0.28, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.ellipse(p.x + r * 0.55, p.y + r * 0.08, r * 0.62, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function drawRings(ctx, game) {
  const c = CONFIG.colors;
  // Far rings first so the next ring draws on top.
  const list = game.ringList.slice(game.nextRing);
  for (let i = list.length - 1; i >= 0; i--) {
    const ring = list[i];
    const p = project(game, ring.x, ring.y, ring.z);
    if (!p) continue;
    const isNext = i === 0;
    const rx = ring.r * p.s, ry = ring.r * p.s * 0.92;
    if (rx < 2) continue;
    ctx.lineWidth = Math.max(2, rx * 0.14);
    ctx.strokeStyle = isNext ? c.ringNext : 'rgba(232,244,255,0.75)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = Math.max(1, rx * 0.05);
    ctx.strokeStyle = isNext ? '#7a4d00' : 'rgba(120,150,180,0.6)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, rx * 0.86, ry * 0.86, 0, 0, Math.PI * 2); ctx.stroke();
    if (isNext) {
      ctx.fillStyle = '#1f3a5f';
      ctx.font = `bold ${Math.max(13, Math.round(rx * 0.42))}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(ring.index + 1), p.x, p.y);
      ctx.textBaseline = 'alphabetic';
    }
  }
}

function drawPlane(ctx, game) {
  const c = CONFIG.colors;
  const px = CX, py = H * 0.62;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(game.roll * 0.85);
  ctx.scale(1, 1 - Math.abs(game.pitch) * 0.25);
  // Contrail wisps.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-58, 26); ctx.lineTo(-120, 44); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(58, 26); ctx.lineTo(120, 44); ctx.stroke();
  // Tail.
  ctx.fillStyle = c.planeTrim;
  ctx.beginPath(); ctx.moveTo(-16, -58); ctx.lineTo(-30, -96); ctx.lineTo(-8, -92); ctx.lineTo(-4, -58); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(16, -58); ctx.lineTo(30, -96); ctx.lineTo(8, -92); ctx.lineTo(4, -58); ctx.closePath(); ctx.fill();
  // Main wings, swept back.
  ctx.fillStyle = c.planeWing;
  ctx.beginPath(); ctx.moveTo(-14, -18); ctx.lineTo(-168, 34); ctx.lineTo(-158, 52); ctx.lineTo(-10, 30); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(14, -18); ctx.lineTo(168, 34); ctx.lineTo(158, 52); ctx.lineTo(10, 30); ctx.closePath(); ctx.fill();
  ctx.fillStyle = c.planeTrim;
  ctx.fillRect(-168, 30, 34, 5); ctx.fillRect(134, 30, 34, 5);
  // Fuselage.
  const body = ctx.createLinearGradient(-22, 0, 22, 0);
  body.addColorStop(0, '#c93320'); body.addColorStop(0.5, c.planeBody); body.addColorStop(1, '#a82a1a');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, -118);
  ctx.quadraticCurveTo(20, -70, 22, -10);
  ctx.quadraticCurveTo(22, 42, 12, 62);
  ctx.quadraticCurveTo(0, 72, -12, 62);
  ctx.quadraticCurveTo(-22, 42, -22, -10);
  ctx.quadraticCurveTo(-20, -70, 0, -118);
  ctx.closePath(); ctx.fill();
  // Canopy.
  ctx.fillStyle = '#bfe6f7';
  ctx.beginPath(); ctx.ellipse(0, -72, 11, 26, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath(); ctx.ellipse(-3, -80, 4, 10, 0.2, 0, Math.PI * 2); ctx.fill();
  // Nose stripe and number.
  ctx.fillStyle = '#fff';
  ctx.fillRect(-22, -6, 44, 5);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('07', 0, 34);
  ctx.restore();
  // Soft shadow on the ground far below, when low.
  if (game.y < 160) {
    const g = groundHeight(game.x, game.z + 60, game.seed);
    const p = project(game, game.x, g + 1, game.z + 60);
    if (p) {
      ctx.fillStyle = `rgba(20,30,20,${clamp(0.3 - game.y / 600, 0.05, 0.3)})`;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 26 * p.s + 8, 8 * p.s + 3, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawHud(ctx, game) {
  const c = CONFIG.colors;
  const ring = nextRingOf(game);
  // Top bar.
  ctx.fillStyle = 'rgba(12,28,48,0.82)';
  ctx.fillRect(0, 0, W, 58);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 26px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('SKYLINE RUN', 18, 30);
  ctx.font = '15px system-ui, sans-serif'; ctx.fillStyle = '#ffd970';
  ctx.fillText(`RING ${Math.min(game.rings + 1, CONFIG.ringCount)}/${CONFIG.ringCount}`, 218, 30);
  const items = [
    ['ALT', `${Math.round(game.y * 3.28)} ft`],
    ['SPD', `${Math.round(game.speed)} kt`],
    ['HDG', `${String(headingDegrees(game)).padStart(3, '0')}°`],
    ['THR', `${Math.round(game.throttle * 100)}%`],
    ['TIME', fmtTime(game.timeLeft)],
    ['SCORE', String(game.score)],
  ];
  let x = 400;
  for (const [label, value] of items) {
    ctx.font = '11px system-ui, sans-serif'; ctx.fillStyle = '#9fc4e8'; ctx.textAlign = 'left';
    ctx.fillText(label, x, 18);
    ctx.font = 'bold 19px system-ui, sans-serif'; ctx.fillStyle = '#fff';
    ctx.fillText(value, x, 42);
    x += label === 'SCORE' ? 130 : 118;
  }
  // Lives.
  ctx.textAlign = 'right'; ctx.font = 'bold 19px system-ui, sans-serif'; ctx.fillStyle = '#ffb3a7';
  ctx.fillText('♥'.repeat(Math.max(0, game.lives)) + '·'.repeat(Math.max(0, CONFIG.lives - game.lives)), W - 18, 30);
  ctx.textBaseline = 'alphabetic';
  // Next-ring pointer.
  if (ring && game.phase === 'flying') {
    const dx = ring.x - game.x, dy = ring.y - game.y;
    const dist = Math.max(0, ring.z - game.z);
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillStyle = c.ringNext;
    const arrow = dx > 30 ? '▶' : dx < -30 ? '◀' : '▲';
    ctx.fillText(`${arrow} NEXT RING ${dist > 1000 ? (dist / 1000).toFixed(1) + ' km' : Math.round(dist) + ' m'}`, CX, 84);
    if (game.ringFlash > 0) {
      ctx.font = 'bold 34px system-ui, sans-serif';
      ctx.fillStyle = game.ringMessage.includes('PERFECT') ? '#ffd970' : '#fff';
      ctx.strokeStyle = 'rgba(12,28,48,0.8)'; ctx.lineWidth = 6;
      ctx.strokeText(game.ringMessage, CX, 150);
      ctx.fillText(game.ringMessage, CX, 150);
    }
  }
  // Bottom instruments: artificial horizon, compass, throttle, vertical speed.
  const iy = H - 118;
  // Artificial horizon.
  ctx.save();
  ctx.beginPath(); ctx.arc(96, iy + 44, 52, 0, Math.PI * 2); ctx.clip();
  ctx.translate(96, iy + 44);
  ctx.rotate(-game.roll * 0.6);
  ctx.translate(0, game.pitch * 90);
  ctx.fillStyle = '#3f8fd2'; ctx.fillRect(-60, -60, 120, 60);
  ctx.fillStyle = '#8a6b46'; ctx.fillRect(-60, 0, 120, 60);
  ctx.fillStyle = '#fff'; ctx.fillRect(-60, -2, 120, 4);
  ctx.restore();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(96, iy + 44, 52, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffd970';
  ctx.beginPath(); ctx.moveTo(96 - 16, iy + 44); ctx.lineTo(96 + 16, iy + 44); ctx.lineTo(96, iy + 52); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', 96, iy + 116);
  // Compass strip.
  ctx.fillStyle = 'rgba(12,28,48,0.82)';
  ctx.fillRect(CX - 210, iy + 6, 420, 44);
  ctx.fillStyle = '#9fc4e8'; ctx.font = '12px system-ui, sans-serif';
  const hdg = headingDegrees(game);
  for (let d = -60; d <= 60; d += 15) {
    const a = (hdg + d + 360) % 360;
    const px = CX + d * 3.2;
    ctx.fillStyle = d === 0 ? '#ffd970' : '#cfe4f7';
    ctx.fillText(String(a).padStart(3, '0'), px, iy + 20);
    ctx.fillRect(px - 1, iy + 26, 2, d % 45 === 0 ? 12 : 7);
  }
  ctx.fillStyle = '#ffd970';
  ctx.beginPath(); ctx.moveTo(CX - 7, iy + 6); ctx.lineTo(CX + 7, iy + 6); ctx.lineTo(CX, iy + 14); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText('HEADING', CX, iy + 66);
  // Throttle gauge.
  const tx = W - 150;
  ctx.fillStyle = 'rgba(12,28,48,0.82)';
  ctx.fillRect(tx, iy - 6, 110, 96);
  ctx.fillStyle = '#22384f'; ctx.fillRect(tx + 18, iy + 6, 16, 68);
  ctx.fillStyle = game.throttle > 0.85 ? '#ff6b4a' : '#57c465';
  const th = game.throttle * 68;
  ctx.fillRect(tx + 18, iy + 74 - th, 16, th);
  ctx.fillStyle = '#fff'; ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('THR', tx + 44, iy + 26);
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(`${Math.round(game.throttle * 100)}%`, tx + 44, iy + 46);
  ctx.font = '11px system-ui, sans-serif'; ctx.fillStyle = '#9fc4e8';
  ctx.fillText('W/S', tx + 44, iy + 64);
  ctx.textAlign = 'center';
  // Vertical speed.
  ctx.fillStyle = '#fff'; ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(`V/S ${game.verticalSpeed >= 0 ? '+' : ''}${Math.round(game.verticalSpeed * 3.28 * 60)} fpm`, 190, iy + 30);
  ctx.fillText(`DIST ${Math.round(game.distance / 100) / 10} km`, 190, iy + 52);
  ctx.fillText(`COMBO x${game.combo}`, 190, iy + 74);
  ctx.textAlign = 'center';
}

export function fmtTime(t) {
  const s = Math.max(0, Math.ceil(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10,24,42,0.88)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#ffd970'; ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

function drawTitle(ctx, game) {
  ctx.fillStyle = 'rgba(8,20,38,0.45)';
  ctx.fillRect(0, 0, W, H);
  panel(ctx, CX - 330, 120, 660, 430);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd970';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText('SKYLINE RUN', CX, 196);
  ctx.fillStyle = '#fff';
  ctx.font = '21px system-ui, sans-serif';
  ctx.fillText('Fly the valley. Thread all 12 rings. Beat the clock.', CX, 238);
  ctx.font = '17px system-ui, sans-serif'; ctx.fillStyle = '#cfe4f7';
  ctx.fillText('Home runway → river → lakeside town → mountain ridge → the lake', CX, 272);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 17px system-ui, sans-serif'; ctx.textAlign = 'left';
  const lines = [
    ['← →  or  A / D', 'Bank and turn'],
    ['↑ ↓', 'Climb and dive'],
    ['W / S', 'Throttle up and down'],
    ['Space', 'Level the wings'],
    ['P / Esc', 'Pause      ·      M mute      ·      R restart'],
    ['Enter', 'Take off'],
  ];
  let y = 312;
  for (const [k, v] of lines) {
    ctx.fillStyle = '#ffd970'; ctx.fillText(k, CX - 280, y);
    ctx.fillStyle = '#fff'; ctx.fillText(v, CX - 60, y);
    y += 30;
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd970'; ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(game.speed > 0 || game.time > 0 ? 'Press ENTER to fly again' : 'Press ENTER to take off', CX, 512);
  ctx.fillStyle = '#9fc4e8'; ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('180 seconds · 12 rings · 3 airframes · a ring adds 6 seconds', CX, 540 - 8);
}

function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(8,20,38,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px system-ui, sans-serif';
  ctx.fillText('PAUSED', CX, H / 2 - 10);
  ctx.font = '19px system-ui, sans-serif'; ctx.fillStyle = '#cfe4f7';
  ctx.fillText('Press P to keep flying', CX, H / 2 + 30);
}

function drawCrash(ctx, game) {
  ctx.fillStyle = 'rgba(120,20,10,0.35)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('CRASHED', CX, H / 2 - 20);
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(game.lives > 0 ? `Airframe lost — ${game.lives} left, back in the air…` : 'Out of airframes.', CX, H / 2 + 20);
}

function drawEnd(ctx, game) {
  ctx.fillStyle = 'rgba(8,20,38,0.6)';
  ctx.fillRect(0, 0, W, H);
  panel(ctx, CX - 300, 130, 600, 430);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd970'; ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText(game.rings >= CONFIG.ringCount ? 'COURSE COMPLETE' : 'FLIGHT OVER', CX, 200);
  ctx.fillStyle = '#fff'; ctx.font = '19px system-ui, sans-serif';
  ctx.fillText(game.reason, CX, 238);
  ctx.font = 'bold 30px system-ui, sans-serif'; ctx.fillStyle = '#fff';
  ctx.fillText(`SCORE  ${game.score}`, CX, 296);
  ctx.font = '20px system-ui, sans-serif'; ctx.fillStyle = '#cfe4f7';
  const rows = [
    `Rings flown  ${game.rings} / ${CONFIG.ringCount}`,
    `Perfect rings  ${game.perfects}`,
    `Best combo  x${game.bestCombo}`,
    `Distance  ${Math.round(game.distance / 100) / 10} km`,
    `Time left  ${fmtTime(game.timeLeft)}`,
  ];
  let y = 340;
  for (const r of rows) { ctx.fillText(r, CX, y); y += 30; }
  ctx.fillStyle = '#ffd970'; ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('Press ENTER to fly again  ·  R to restart', CX, 522);
}

export function render(ctx, game) {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  // The whole world tilts with the bank, the plane stays level in frame.
  ctx.translate(CX, H * 0.42);
  ctx.rotate(-game.roll * 0.28);
  ctx.translate(-CX, -(H * 0.42));
  drawSky(ctx, game);
  drawTerrain(ctx, game);
  drawRunway(ctx, game);
  drawTown(ctx, game);
  drawClouds(ctx, game);
  drawRings(ctx, game);
  ctx.restore();
  if (game.phase === 'flying' || game.phase === 'paused' || game.phase === 'crashed') drawPlane(ctx, game);
  drawHud(ctx, game);
  if (game.phase === 'title') drawTitle(ctx, game);
  if (game.phase === 'paused') drawPaused(ctx);
  if (game.phase === 'crashed') drawCrash(ctx, game);
  if (game.phase === 'done') drawEnd(ctx, game);
}
