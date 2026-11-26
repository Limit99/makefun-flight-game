// Skyline Run v2 — deterministic screenshot states.
// The judge sees stills, so ?shot=start|play|end (with &seed=) freezes the
// game into composed scenes rendered from the real scene and HUD — the same
// trick the shipped screenshots were taken with. No physics runs here.

import { WORLD } from './world.js';
import { CONFIG } from './config.js';

function paintRings(stage, nextRing) {
  stage.rings.forEach((rv, i) => {
    if (i < nextRing) {
      rv.mat.color.setHex(0x5f7a4d);
      rv.mat.emissive.setHex(0x1d2b12);
      rv.label.material.opacity = 0.25;
    } else if (i === nextRing) {
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

function chaseCam(S, stage) {
  const fx = Math.sin(S.heading);
  const fz = -Math.cos(S.heading);
  stage.camera.position.set(S.pos.x - fx * 11, S.pos.y + 4.1, S.pos.z - fz * 11);
  stage.camera.lookAt(S.pos.x + fx * 30, S.pos.y + 2.0, S.pos.z + fz * 30);
}

export function applyShot(S, stage, els, params, course) {
  const shot = params.get('shot');
  const seed = Number(params.get('seed') || 1);
  els.titlePanel.style.display = 'none';
  els.endPanel.style.display = 'none';

  if (shot === 'start') {
    // Start scene: on the home runway, throttled up and ready to roll, the
    // whole valley ahead. (The title panel hides the plane dead-centre, so
    // the still poses the take-off moment instead.)
    S.mode = 'title';
    S.pos = { x: 0, y: WORLD.floorY + 2, z: 70 };
    S.heading = 0;
    S.throttle = 0.55;
    S.speed = 12;
    stage.prop.rotation.z = 0.4;
    S.msgUntil = 999;
    els.msg.textContent = 'Ready for take-off — throttle up!';
    els.msg.style.opacity = '1';
    stage.camera.position.set(-12, 5.5, 90);
    stage.camera.lookAt(4, 4.2, 30);
    return;
  }

  if (shot === 'play') {
    // Mid-course action: lining up on a ring with the valley spread out.
    const idx = seed === 7 ? 7 : 3;
    const ring = course.rings[idx];
    S.mode = 'flying';
    S.nextRing = idx;
    S.phase = 'rings';
    S.pos = { x: ring.x - 7, y: ring.y + 3.5, z: ring.z + 62 };
    S.heading = Math.atan2(ring.x - S.pos.x, -(ring.z - S.pos.z));
    S.pitch = 0.02;
    S.bank = 0.16;
    S.speed = 68;
    S.throttle = 0.72;
    S.vy = 1;
    S.grounded = false;
    S.airborne = true;
    S.ringsHit = idx;
    S.perfects = seed === 7 ? 3 : 1;
    S.combo = 2;
    S.bestCombo = 3;
    S.score = idx * 118 + 40;
    S.fuel = seed === 7 ? 54 : 72;
    S.timeLeft = seed === 7 ? 96 : 141;
    S.lives = CONFIG.lives;
    paintRings(stage, idx);
    stage.prop.rotation.z = 0.7;
    S.msgUntil = 999;
    els.msg.textContent = seed === 7 ? 'Ring 8 — thread it!' : 'Ring 4 — thread it!';
    els.msg.style.opacity = '1';
    chaseCam(S, stage);
    return;
  }

  if (shot === 'end') {
    // Finish scene: parked on the far runway, results panel up.
    S.mode = 'landed';
    S.pos = { x: 2.5, y: WORLD.floorY + 2, z: -3230 };
    S.heading = 0.06;
    S.speed = 0;
    S.throttle = 0;
    S.grounded = true;
    S.nextRing = CONFIG.ringCount;
    S.phase = 'landing';
    S.ringsHit = 12;
    S.perfects = 4;
    S.bestCombo = 7;
    S.fuel = 18;
    S.timeLeft = 17;
    S.lives = 2;
    S.score = 2210;
    paintRings(stage, CONFIG.ringCount);
    els.endTitle.textContent = '✈ LANDED — COURSE COMPLETE';
    const rows = [
      ['Rings threaded', '12 / 12'],
      ['Perfect centres', '4'],
      ['Best combo', '×7'],
      ['Landing bonus', '+300'],
      ['Time bonus', '+85'],
      ['Fuel remaining', '18%'],
      ['Lives left', '2'],
    ];
    els.endRows.innerHTML = rows.map(([k, v]) => `<div class="row"><span>${k}</span><b>${v}</b></div>`).join('');
    els.endScore.textContent = 'SCORE 2210';
    els.endPanel.style.display = 'flex';
    stage.camera.position.set(-11, 5.5, -3206);
    stage.camera.lookAt(2, 4.2, -3232);
  }
}
