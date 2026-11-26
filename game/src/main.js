// Skyline Run v2 — game loop, flight model, scoring and HUD.
// three.js draws the world (render.js); everything about playing the game —
// taking off, threading the rings, watching the fuel, and landing on the far
// runway — lives here. Deterministic screenshot states live in shots.js.

import { CONFIG } from './config.js';
import { WORLD, terrainHeight, onRunway, buildRings, buildBuildings, buildTrees, buildClouds } from './world.js';
import { createStage } from './render.js';
import { initInput, wasPressed, clearPressed, bankAxis, pitchAxis, throttleAxis, levelWingsHeld } from './input.js';
import { initAudio, updateAudio, setMuted, isMuted, sndRing, sndMiss, sndCrash, sndTouchdown, sndFinish } from './audio.js';
import { applyShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const els = {
  canvas: $('game-canvas'),
  alt: $('h-alt'), spd: $('h-spd'), hdg: $('h-hdg'), time: $('h-time'),
  score: $('h-score'), fuelBar: $('h-fuel-bar'), fuelTxt: $('h-fuel-txt'),
  lives: $('h-lives'), ring: $('h-ring'), wind: $('h-wind'), vs: $('h-vs'),
  thrBar: $('h-thr-bar'), msg: $('msg'), warn: $('warn'),
  horizon: $('horizon'), compass: $('compass'),
  titlePanel: $('panel-title'), endPanel: $('panel-end'), pausePanel: $('panel-pause'),
  endTitle: $('end-title'), endRows: $('end-rows'), endScore: $('end-score'),
  sr: $('sr-status'),
};

const course = {
  rings: buildRings(),
  buildings: buildBuildings(),
  trees: buildTrees(),
  clouds: buildClouds(),
};
const stage = createStage(els.canvas, course);
const { camera, plane, prop, rings: ringViews } = stage;

const S = {
  mode: 'title', // title | flying | paused | landed | over
  pos: { x: 0, y: WORLD.floorY + 2, z: 70 },
  heading: 0, pitch: 0, bank: 0,
  speed: 0, throttle: 0, vy: 0,
  grounded: true, airborne: false,
  fuel: CONFIG.fuelStart, score: 0, lives: CONFIG.lives,
  timeLeft: CONFIG.timeLimit, combo: 0, bestCombo: 0,
  nextRing: 0, ringsHit: 0, perfects: 0,
  phase: 'rings', // rings | landing
  wind: 0, windGust: 0, elapsed: 0,
  msgUntil: 0, result: '', landingBonus: 0, timeBonus: 0,
  prevZ: 70, camPos: { x: 0, y: 10, z: 100 },
  auto: null, // autopilot control override (?autopilot demo / test mode)
};

function headingTo(from, to) {
  return Math.atan2(to.x - from.x, -(to.z - from.z));
}

function resetFlight() {
  S.pos = { x: 0, y: WORLD.floorY + 2, z: 70 };
  S.heading = 0; S.pitch = 0; S.bank = 0;
  S.speed = 0; S.throttle = 0; S.vy = 0;
  S.grounded = true; S.airborne = false;
  S.fuel = CONFIG.fuelStart; S.score = 0; S.lives = CONFIG.lives;
  S.timeLeft = CONFIG.timeLimit; S.combo = 0; S.bestCombo = 0;
  S.nextRing = 0; S.ringsHit = 0; S.perfects = 0;
  S.phase = 'rings'; S.elapsed = 0; S.result = '';
  S.landingBonus = 0; S.timeBonus = 0;
  S.prevZ = S.pos.z;
  paintRings();
}

function paintRings() {
  ringViews.forEach((rv, i) => {
    if (i < S.nextRing) {
      rv.mat.color.setHex(0x5f7a4d);
      rv.mat.emissive.setHex(0x1d2b12);
      rv.label.material.opacity = 0.25;
    } else if (i === S.nextRing) {
      rv.mat.color.setHex(0xffc93c);
      rv.mat.emissive.setHex(0xa86f00);
      rv.label.material.opacity = 1;
    } else {
      rv.mat.color.setHex(0xe8b62a);
      rv.mat.emissive.setHex(0x7a5200);
      rv.label.material.opacity = 0.85;
    }
  });
}

function showMsg(text, secs = 2.2) {
  els.msg.textContent = text;
  els.msg.style.opacity = '1';
  S.msgUntil = S.elapsed + secs;
}

function startFlight() {
  resetFlight();
  S.mode = 'flying';
  els.titlePanel.style.display = 'none';
  els.endPanel.style.display = 'none';
  els.pausePanel.style.display = 'none';
  showMsg('Throttle up — take off!', 2.4);
}

function endFlight(title) {
  S.mode = title === 'LANDED' ? 'landed' : 'over';
  S.result = title;
  els.endTitle.textContent = title === 'LANDED' ? '✈ LANDED — COURSE COMPLETE' : title;
  const rows = [
    ['Rings threaded', `${S.ringsHit} / ${CONFIG.ringCount}`],
    ['Perfect centres', String(S.perfects)],
    ['Best combo', `×${S.bestCombo}`],
    ['Landing bonus', S.landingBonus ? `+${S.landingBonus}` : '—'],
    ['Time bonus', S.timeBonus ? `+${S.timeBonus}` : '—'],
    ['Fuel remaining', `${Math.max(0, S.fuel).toFixed(0)}%`],
    ['Lives left', String(Math.max(0, S.lives))],
  ];
  els.endRows.innerHTML = rows.map(([k, v]) => `<div class="row"><span>${k}</span><b>${v}</b></div>`).join('');
  els.endScore.textContent = `SCORE ${S.score}`;
  els.endPanel.style.display = 'flex';
  updateAudio(0, 0, false);
}

function crash(reason) {
  sndCrash();
  S.lives -= 1;
  S.score = Math.max(0, S.score - CONFIG.crashPenalty);
  S.combo = 0;
  if (S.lives <= 0) {
    showMsg(reason, 2);
    endFlight('OUT OF AIRCRAFT');
    return;
  }
  showMsg(`${reason} — ${S.lives} ${S.lives === 1 ? 'life' : 'lives'} left`, 2.6);
  // Respawn in the air, lined up on the next objective.
  const target = S.phase === 'landing'
    ? { x: WORLD.farRunway.x, y: 40, z: WORLD.farRunway.zTop + 420 }
    : course.rings[Math.min(S.nextRing, CONFIG.ringCount - 1)];
  S.pos = { x: target.x * 0.4, y: Math.max(target.y + 14, 42), z: target.z + 260 };
  if (S.phase === 'landing') S.pos = { x: 0, y: 44, z: WORLD.farRunway.zTop + 430 };
  S.heading = headingTo(S.pos, target);
  S.pitch = 0; S.bank = 0; S.vy = 0;
  S.speed = 56; S.throttle = 0.62;
  S.grounded = false; S.airborne = true;
  S.fuel = Math.max(S.fuel, CONFIG.fuelRespawnFloor);
  S.prevZ = S.pos.z;
}

function buildingHit() {
  for (const b of course.buildings) {
    if (Math.abs(S.pos.x - b.x) <= b.w / 2 + 1 && Math.abs(S.pos.z - b.z) <= b.d / 2 + 1) {
      const top = terrainHeight(b.x, b.z) + b.h;
      if (S.pos.y - 1.5 < top) return true;
    }
  }
  return false;
}

function stepFlight(dt) {
  S.elapsed += dt;
  const bankIn = S.auto ? S.auto.bank : bankAxis();
  const pitchIn = S.auto ? S.auto.pitch : pitchAxis();

  // Throttle and speed.
  if (S.fuel > 0) {
    if (S.auto) {
      const d = S.auto.throttle - S.throttle;
      S.throttle += Math.max(-dt * 1.2, Math.min(dt * 1.2, d));
    } else {
      S.throttle = Math.min(1, Math.max(0, S.throttle + throttleAxis() * dt * 0.55));
    }
  } else S.throttle = 0;
  const targetSpeed = S.grounded
    ? S.throttle * CONFIG.maxSpeed
    : S.fuel > 0
      ? CONFIG.minSpeed * 0.4 + S.throttle * (CONFIG.maxSpeed - CONFIG.minSpeed * 0.4)
      : 34;
  S.speed += (targetSpeed - S.speed) * Math.min(1, CONFIG.accelResponse * 1.6 * dt);
  if (S.grounded && S.throttle < 0.05) S.speed = Math.max(0, S.speed - 7 * dt);

  // Bank, pitch, heading.
  const level = levelWingsHeld();
  const bankTarget = level ? 0 : bankIn * CONFIG.maxBank;
  S.bank += (bankTarget - S.bank) * Math.min(1, dt * 3.2);
  const pitchTarget = level ? 0 : pitchIn * CONFIG.maxPitch;
  S.pitch += (pitchTarget - S.pitch) * Math.min(1, dt * (S.grounded ? 1.6 : 2.6));
  if (S.grounded) {
    S.heading += (S.bank / CONFIG.maxBank) * 0.35 * dt * Math.min(1, S.speed / 40);
  } else {
    S.heading += CONFIG.turnRate * (S.bank / CONFIG.maxBank) * dt * (52 / Math.max(30, S.speed));
  }

  // Wind: slow sine gusts across the valley.
  S.windGust = 0.5 + 0.5 * Math.sin(S.elapsed * 0.23 + 1.3) * Math.sin(S.elapsed * 0.071);
  S.wind = Math.sin(S.elapsed * 0.4 + S.pos.z * 0.002) * CONFIG.windMax * S.windGust;

  // Fuel.
  if (S.speed > 4) {
    S.fuel -= (CONFIG.fuelDrainBase + CONFIG.fuelDrainThrottle * S.throttle) * dt;
    if (S.fuel < 0) S.fuel = 0;
  }

  const groundY = terrainHeight(S.pos.x, S.pos.z);
  const fwdX = Math.sin(S.heading);
  const fwdZ = -Math.cos(S.heading);

  if (S.grounded) {
    const prevGround = groundY;
    S.pos.x += fwdX * S.speed * dt;
    S.pos.z += fwdZ * S.speed * dt;
    const newGround = terrainHeight(S.pos.x, S.pos.z);
    if (newGround - prevGround > 2.6 && S.speed > 12) { crash('Hit rising ground'); return; }
    S.pos.y = newGround + 2;
    S.vy = 0;
    if (buildingHit()) { crash('Hit a building'); return; }
    // Lift-off: enough speed and a pull on the stick.
    if (S.speed >= 40 && S.pitch > 0.1) {
      S.grounded = false;
      S.vy = Math.sin(S.pitch) * S.speed * 0.45;
      showMsg('Airborne!', 1.2);
    }
    // Touchdown judgement happens on the grounded transition in the air
    // branch; rolling to a stop on the far runway also counts if we arrived
    // there gently during the landing phase.
  } else {
    // Airborne physics.
    let vy = Math.sin(S.pitch) * S.speed;
    vy -= CONFIG.baseSink * (1.2 - S.speed / CONFIG.maxSpeed);
    if (S.speed < 31) vy -= (31 - S.speed) * 0.22; // stall sink
    if (S.fuel <= 0) vy -= 2.4;                     // dead engine glides down
    S.vy = vy;
    S.pos.x += (fwdX * Math.cos(S.pitch) * S.speed + S.wind) * dt;
    S.pos.z += fwdZ * Math.cos(S.pitch) * S.speed * dt;
    S.pos.y += vy * dt;
    if (S.pos.y > groundY + 6) S.airborne = true;

    // Ring crossings (rings stand in the XY plane at fixed z).
    if (S.phase === 'rings' && S.nextRing < CONFIG.ringCount) {
      const ring = course.rings[S.nextRing];
      if (S.prevZ > ring.z && S.pos.z <= ring.z) {
        const d = Math.hypot(S.pos.x - ring.x, S.pos.y - ring.y);
        if (d <= ring.r) {
          const perfect = d <= ring.r * 0.4;
          S.combo += 1;
          S.bestCombo = Math.max(S.bestCombo, S.combo);
          let gained = CONFIG.ringScore + (S.combo - 1) * CONFIG.comboStep + (perfect ? CONFIG.ringCentreBonus : 0);
          S.score += gained;
          S.ringsHit += 1;
          if (perfect) S.perfects += 1;
          S.timeLeft = Math.min(S.timeLeft + CONFIG.ringTimeBonus, CONFIG.timeLimit + 60);
          S.fuel = Math.min(100, S.fuel + CONFIG.fuelPerRing);
          sndRing(perfect);
          showMsg(perfect ? `PERFECT! +${gained}` : `Ring ${S.nextRing + 1}! +${gained}`, 1.4);
          S.nextRing += 1;
          paintRings();
          if (S.nextRing >= CONFIG.ringCount) {
            S.phase = 'landing';
            showMsg('All rings! Land on the far runway by the lake', 3.4);
          }
        } else if (d <= ring.r * 2.6) {
          S.combo = 0;
          sndMiss();
          showMsg(`Missed ring ${S.nextRing + 1}`, 1.4);
          S.nextRing += 1;
          paintRings();
          if (S.nextRing >= CONFIG.ringCount) {
            S.phase = 'landing';
            showMsg('Head for the far runway — land to finish', 3.2);
          }
        }
      }
    }

    // Settling back onto the ground before ever climbing away is just a
    // bounced take-off, not a crash.
    if (!S.airborne && S.pos.y <= groundY + 2 && S.vy <= 0) {
      S.grounded = true;
      S.pos.y = groundY + 2;
      S.vy = 0;
      S.prevZ = S.pos.z;
      return;
    }

    // Ground contact after having been properly airborne.
    if (S.pos.y <= groundY + 2 && S.airborne) {
      const sink = -S.vy;
      if (S.phase === 'landing' && onRunway(S.pos.x, S.pos.z, WORLD.farRunway)) {
        if (S.speed <= CONFIG.landMaxSpeed && sink <= CONFIG.landMaxSinkHard) {
          const smooth = sink <= CONFIG.landMaxSink;
          S.landingBonus = smooth ? CONFIG.landingSmoothBonus : CONFIG.landingFirmBonus;
          S.timeBonus = Math.floor(S.timeLeft) * CONFIG.finishTimeBonusPerSec;
          S.score += S.landingBonus + S.timeBonus;
          sndTouchdown(smooth);
          sndFinish();
          endFlight('LANDED');
          return;
        }
        crash('Hard landing — the gear collapsed');
        return;
      }
      if (buildingHit()) { crash('Hit a building'); return; }
      crash('Crashed into the terrain');
      return;
    }
    if (S.pos.y <= groundY + 2 && buildingHit()) { crash('Hit a building'); return; }
    if (S.pos.y < groundY - 4) { crash('Crashed into the terrain'); return; }
  }
  S.prevZ = S.pos.z;

  // Clock.
  S.timeLeft -= dt;
  if (S.timeLeft <= 0) {
    S.timeLeft = 0;
    endFlight('OUT OF TIME');
  }
}

function updateCamera(dt) {
  const fx = Math.sin(S.heading);
  const fz = -Math.cos(S.heading);
  const dist = S.grounded ? 13 : 11;
  const tx = S.pos.x - fx * dist;
  const tz = S.pos.z - fz * dist;
  const ty = S.pos.y + (S.grounded ? 3.4 : 4.1);
  const k = 1 - Math.exp(-dt * 5.5);
  S.camPos.x += (tx - S.camPos.x) * k;
  S.camPos.y += (ty - S.camPos.y) * k;
  S.camPos.z += (tz - S.camPos.z) * k;
  camera.position.set(S.camPos.x, S.camPos.y, S.camPos.z);
  camera.lookAt(S.pos.x + fx * 30, S.pos.y + 2.0, S.pos.z + fz * 30);
}

function updatePlaneVisual() {
  plane.position.set(S.pos.x, S.pos.y, S.pos.z);
  plane.rotation.order = 'YXZ';
  plane.rotation.y = -S.heading;
  plane.rotation.x = S.pitch * 0.85;
  plane.rotation.z = -S.bank;
  prop.rotation.z += (2 + S.throttle * 42 + S.speed * 0.12) * (1 / 30);
  // Pulse the next ring so the eye finds it.
  ringViews.forEach((rv, i) => {
    const s = i === S.nextRing && S.phase === 'rings' ? 1 + Math.sin(S.elapsed * 5) * 0.045 : 1;
    rv.group.scale.set(s, s, s);
  });
}

function fmtTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function updateHUD() {
  const agl = Math.max(0, S.pos.y - terrainHeight(S.pos.x, S.pos.z));
  els.alt.textContent = `${agl.toFixed(0)} m`;
  els.spd.textContent = `${(S.speed * 1.9).toFixed(0)} kt`;
  const deg = ((S.heading * 180 / Math.PI) % 360 + 360) % 360;
  els.hdg.textContent = `${deg.toFixed(0).padStart(3, '0')}°`;
  els.time.textContent = fmtTime(S.timeLeft);
  els.time.style.color = S.timeLeft < 30 ? '#ff7a6b' : '';
  els.score.textContent = String(S.score);
  els.fuelBar.style.width = `${Math.max(0, S.fuel)}%`;
  els.fuelBar.style.background = S.fuel < CONFIG.fuelLowWarn ? '#e5484d' : '#57c24d';
  els.fuelTxt.textContent = `${Math.max(0, S.fuel).toFixed(0)}%`;
  els.lives.textContent = '✈'.repeat(Math.max(0, S.lives)) || '—';
  els.thrBar.style.width = `${S.throttle * 100}%`;
  els.vs.textContent = S.grounded ? '0 m/s' : `${S.vy >= 0 ? '▲' : '▼'} ${Math.abs(S.vy).toFixed(0)} m/s`;
  const wArrow = S.wind > 0.6 ? '▶' : S.wind < -0.6 ? '◀' : '·';
  els.wind.textContent = `${wArrow} ${Math.abs(S.wind).toFixed(0)} m/s`;
  if (S.phase === 'landing') {
    const d = Math.hypot(S.pos.x - WORLD.farRunway.x, S.pos.z - (WORLD.farRunway.zTop + WORLD.farRunway.zBot) / 2);
    const rel = headingTo(S.pos, { x: WORLD.farRunway.x, z: WORLD.farRunway.zTop });
    let relDeg = ((rel - S.heading) * 180 / Math.PI % 360 + 540) % 360 - 180;
    const arrow = relDeg > 18 ? '▶' : relDeg < -18 ? '◀' : '▲';
    els.ring.textContent = `LAND ${arrow} ${d.toFixed(0)} m`;
  } else {
    const ring = course.rings[S.nextRing];
    const d = ring ? Math.hypot(S.pos.x - ring.x, S.pos.z - ring.z) : 0;
    els.ring.textContent = `RING ${Math.min(S.nextRing + 1, CONFIG.ringCount)}/${CONFIG.ringCount} · ${d.toFixed(0)} m`;
  }
  // Warnings.
  let warn = '';
  if (S.mode === 'flying' && !S.grounded) {
    if (S.fuel <= 0) warn = '⛽ ENGINE DEAD — GLIDE!';
    else if (S.fuel < CONFIG.fuelLowWarn) warn = '⛽ LOW FUEL';
    else if (S.speed < 31) warn = '⚠ STALL';
  }
  els.warn.textContent = warn;
  els.warn.style.visibility = warn ? 'visible' : 'hidden';
  if (S.elapsed > S.msgUntil) els.msg.style.opacity = '0';
  els.sr.textContent = `Altitude ${agl.toFixed(0)} metres, speed ${(S.speed * 1.9).toFixed(0)} knots, score ${S.score}, fuel ${Math.max(0, S.fuel).toFixed(0)} percent.`;
  drawHorizon();
  drawCompass(deg);
}

function drawHorizon() {
  const cv = els.horizon;
  const g = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  g.clearRect(0, 0, w, h);
  g.save();
  g.translate(w / 2, h / 2);
  g.rotate(S.bank);
  const pitchPx = -S.pitch * 46;
  g.translate(0, pitchPx);
  g.fillStyle = '#5b9bd5';
  g.fillRect(-w, -h * 2, w * 2, h * 2);
  g.fillStyle = '#7a5c38';
  g.fillRect(-w, 0, w * 2, h * 2);
  g.strokeStyle = 'rgba(255,255,255,0.75)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(-w, 0);
  g.lineTo(w, 0);
  g.stroke();
  for (const off of [-24, 24]) {
    g.beginPath();
    g.moveTo(-26, off);
    g.lineTo(26, off);
    g.stroke();
  }
  g.restore();
  g.strokeStyle = '#ffd76a';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(w / 2 - 22, h / 2);
  g.lineTo(w / 2 - 6, h / 2);
  g.lineTo(w / 2, h / 2 + 5);
  g.lineTo(w / 2 + 6, h / 2);
  g.lineTo(w / 2 + 22, h / 2);
  g.stroke();
}

function drawCompass(deg) {
  const cv = els.compass;
  const g = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(10,16,24,0.55)';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#eaf4ff';
  g.font = 'bold 13px system-ui, sans-serif';
  g.textAlign = 'center';
  const pxPerDeg = 2.4;
  const labels = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
  for (let world = 0; world < 360; world += 15) {
    const delta = ((world - deg + 540) % 360) - 180;
    const x = w / 2 + delta * pxPerDeg;
    if (x < -10 || x > w + 10) continue;
    if (labels[world]) g.fillText(labels[world], x, 18);
    else g.fillRect(x - 1, 4, 2, 7);
  }
  g.fillStyle = '#ffd76a';
  g.beginPath();
  g.moveTo(w / 2 - 6, 0);
  g.lineTo(w / 2 + 6, 0);
  g.lineTo(w / 2, 8);
  g.fill();
}

// Panels and keys.
function bindUI() {
  const start = () => { initAudio(); if (S.mode === 'title' || S.mode === 'over' || S.mode === 'landed') startFlight(); };
  els.titlePanel.addEventListener('click', start);
  els.endPanel.addEventListener('click', start);
  els.canvas.addEventListener('click', () => { initAudio(); });
}

// A simple autopilot used by the ?autopilot demo/test mode: it flies the
// same controls a player would, aiming at the next ring and then gliding
// onto the far runway. It proves the course is completable end to end.
function computeAuto() {
  const target = S.phase === 'landing'
    ? { x: WORLD.farRunway.x, y: WORLD.floorY + 2, z: (WORLD.farRunway.zTop + WORLD.farRunway.zBot) / 2 }
    : course.rings[Math.min(S.nextRing, CONFIG.ringCount - 1)];
  const desired = headingTo(S.pos, target);
  const dh = ((desired - S.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  const bank = Math.max(-1, Math.min(1, dh * 1.5));
  let pitch;
  let throttle;
  if (S.grounded) {
    throttle = 1;
    pitch = S.speed > 42 ? 0.8 : 0;
  } else if (S.phase === 'landing') {
    const dist = Math.hypot(S.pos.x - target.x, S.pos.z - target.z);
    const targetY = dist > 300 ? 30 : WORLD.floorY + 2 + Math.max(0, dist - 60) * 0.055;
    pitch = Math.max(-0.8, Math.min(0.8, (targetY - S.pos.y) * 0.035));
    throttle = Math.max(0, Math.min(0.75, 0.3 + (40 - S.speed) * 0.04));
  } else {
    pitch = Math.max(-0.8, Math.min(0.85, (target.y - S.pos.y) * 0.03));
    throttle = 0.72;
  }
  S.auto = { bank, pitch, throttle };
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (S.mode === 'flying') {
    if (wasPressed('KeyP') || wasPressed('Escape')) {
      S.mode = 'paused';
      els.pausePanel.style.display = 'flex';
    } else {
      if (AUTOPILOT) computeAuto();
      stepFlight(dt);
    }
  } else if (S.mode === 'paused') {
    if (wasPressed('KeyP') || wasPressed('Escape')) {
      S.mode = 'flying';
      els.pausePanel.style.display = 'none';
    }
  }
  if (wasPressed('KeyM')) setMuted(!isMuted());
  if (wasPressed('KeyR') && S.mode !== 'title') { startFlight(); }
  if (wasPressed('Enter') && (S.mode === 'title' || S.mode === 'over' || S.mode === 'landed')) { initAudio(); startFlight(); }

  if (S.mode === 'flying' || S.mode === 'paused') updateAudio(S.throttle, S.speed / CONFIG.maxSpeed, S.mode === 'flying');
  updatePlaneVisual();
  if (S.mode !== 'paused') updateCamera(dt);
  updateHUD();
  clearPressed();
  stage.renderer.render(stage.scene, camera);
}

// Boot: shot mode freezes a composed scene; otherwise the title screen idles
// with the plane on the home runway.
const params = new URLSearchParams(location.search);
const AUTOPILOT = params.has('autopilot');
window.__skyline = S;
initInput();
bindUI();
resetFlight();
if (AUTOPILOT) {
  startFlight();
  requestAnimationFrame(frame);
} else if (params.has('shot')) {
  applyShot(S, stage, els, params, course);
  updatePlaneVisual();
  updateHUD();
  stage.renderer.render(stage.scene, camera);
} else {
  S.camPos = { x: -14, y: 7, z: 96 };
  camera.position.set(S.camPos.x, S.camPos.y, S.camPos.z);
  camera.lookAt(0, 4, 30);
  requestAnimationFrame(frame);
}
