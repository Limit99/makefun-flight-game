// Skyline Run v2 — the 3D scene (three.js, vendored locally, fully offline).
// Builds the terrain, water, runways, towns, trees, clouds, rings and the
// player's plane from the shared world definition, and exposes just the
// handles main.js needs each frame. The HUD lives in the DOM, not here.

import { WORLD, terrainHeight, riverX } from './world.js';

const SKY = 0x7fb2dd;
const HORIZON = 0xd7e8f5;

function terrainColor(x, z, y, out) {
  // Deterministic variation so the ground is not one flat green.
  const n = Math.sin(x * 0.11 + z * 0.07) * Math.cos(x * 0.031 - z * 0.043);
  if (y < 1.1) {
    out.setRGB(0.76, 0.70, 0.52); // sandy shore
  } else if (y > 88) {
    out.setRGB(0.96, 0.97, 0.99); // snow
  } else if (y > 34) {
    const t = (y - 34) / 54;
    out.setRGB(0.42 + 0.54 * t, 0.40 + 0.57 * t, 0.38 + 0.61 * t); // rock to snow
  } else if (y > 14) {
    out.setRGB(0.50 + n * 0.04, 0.47 + n * 0.04, 0.38); // dry rock / scrub
  } else {
    out.setRGB(0.30 + n * 0.05, 0.52 + n * 0.06, 0.26 + n * 0.04); // grass
  }
  return out;
}

function buildTerrain(THREE) {
  const W = WORLD.width;
  const L = WORLD.length + 300;
  const segW = 110;
  const segL = 300;
  const geo = new THREE.PlaneGeometry(W, L, segW, segL);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const zOff = -WORLD.length / 2 + 60; // mesh centre z; world z = local z + zOff
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const wz = pos.getZ(i) + zOff;
    const y = terrainHeight(x, wz);
    pos.setY(i, y);
    terrainColor(x, wz, y, c);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.z = zOff;
  return mesh;
}

function buildRunway(THREE, r) {
  const group = new THREE.Group();
  const len = r.zTop - r.zBot;
  const cz = (r.zTop + r.zBot) / 2;
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(r.halfWidth * 2, len),
    new THREE.MeshLambertMaterial({ color: 0x3c4147 })
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(r.x, WORLD.floorY + 0.07, cz);
  group.add(strip);
  // Centreline dashes.
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f0 });
  for (let z = r.zBot + 14; z < r.zTop - 8; z += 26) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 11), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(r.x, WORLD.floorY + 0.1, z);
    group.add(dash);
  }
  // Threshold bars at both ends.
  for (const endZ of [r.zTop - 5, r.zBot + 5]) {
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 6), dashMat);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(r.x + i * 5.4, WORLD.floorY + 0.1, endZ);
      group.add(bar);
    }
  }
  // Edge lights.
  const lightGeo = new THREE.SphereGeometry(0.55, 6, 5);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffd76a });
  const count = Math.floor(len / 36) * 2;
  const lights = new THREE.InstancedMesh(lightGeo, lightMat, count);
  const m = new THREE.Matrix4();
  let k = 0;
  for (let z = r.zBot + 8; z <= r.zTop - 4 && k < count - 1; z += 36) {
    m.setPosition(r.x - r.halfWidth - 1.6, WORLD.floorY + 0.6, z);
    lights.setMatrixAt(k++, m);
    m.setPosition(r.x + r.halfWidth + 1.6, WORLD.floorY + 0.6, z);
    lights.setMatrixAt(k++, m);
  }
  lights.count = k;
  group.add(lights);
  return group;
}

function numberSprite(THREE, n) {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 256;
  const g = cv.getContext('2d');
  g.beginPath();
  g.arc(128, 128, 104, 0, Math.PI * 2);
  g.fillStyle = 'rgba(20,24,30,0.72)';
  g.fill();
  g.lineWidth = 10;
  g.strokeStyle = '#ffd76a';
  g.stroke();
  g.fillStyle = '#ffffff';
  g.font = 'bold 140px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(n), 128, 136);
  const tex = new THREE.CanvasTexture(cv);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  spr.scale.set(11, 11, 1);
  return spr;
}

function buildPlane(THREE) {
  const plane = new THREE.Group();
  const red = new THREE.MeshLambertMaterial({ color: 0xc0272d });
  const white = new THREE.MeshLambertMaterial({ color: 0xf2f2ee });
  const dark = new THREE.MeshLambertMaterial({ color: 0x22262c });
  const glass = new THREE.MeshPhongMaterial({ color: 0x1c2f42, shininess: 90 });

  // Fuselage along Z, nose toward -Z.
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.92, 6.6, 14), red);
  fus.rotation.x = Math.PI / 2;
  plane.add(fus);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 10), red);
  nose.scale.set(1, 1, 1.5);
  nose.position.z = -3.3;
  plane.add(nose);
  const tailCone = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.6, 1.6, 10), red);
  tailCone.rotation.x = Math.PI / 2;
  tailCone.position.z = 3.9;
  plane.add(tailCone);

  // Canopy.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.66, 12, 10), glass);
  canopy.scale.set(0.92, 0.75, 1.9);
  canopy.position.set(0, 0.62, -0.5);
  plane.add(canopy);

  // Main wing with white tips.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.16, 1.55), red);
  wing.position.set(0, -0.18, -0.4);
  plane.add(wing);
  for (const s of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.17, 1.55), white);
    tip.position.set(s * 4.35, -0.18, -0.4);
    plane.add(tip);
    const roundel = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.05, 16), white);
    roundel.position.set(s * 3.1, -0.08, -0.4);
    plane.add(roundel);
  }
  // Tail feathers.
  const hstab = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.13, 1.0), red);
  hstab.position.set(0, 0.18, 4.3);
  plane.add(hstab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.6, 1.15), red);
  fin.position.set(0, 0.85, 4.3);
  plane.add(fin);
  // Stripe along the fuselage.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 4.6), white);
  stripe.position.set(0, -0.15, 0.6);
  plane.add(stripe);

  // Propeller at the nose, spun by main.js.
  const prop = new THREE.Group();
  const bladeMat = dark;
  const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 4.6, 0.08), bladeMat);
  const b2 = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.34, 0.08), bladeMat);
  prop.add(b1, b2);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), white);
  prop.add(hub);
  prop.position.z = -4.35;
  plane.add(prop);

  // Fixed gear legs + wheels, simple and readable from behind.
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.1, 0.16), dark);
    leg.position.set(s * 1.15, -0.95, -0.7);
    plane.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.24, 12), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(s * 1.15, -1.5, -0.7);
    plane.add(wheel);
  }
  return { plane, prop };
}

export function createStage(canvas, course) {
  const THREE = window.THREE;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(1280, 720, false);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(HORIZON, 220, 1650);

  const camera = new THREE.PerspectiveCamera(62, 1280 / 720, 0.1, 6000);
  camera.position.set(0, 8, 26);

  const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x51683f, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d8, 0.95);
  sun.position.set(-260, 420, -140);
  scene.add(sun);

  scene.add(buildTerrain(THREE));

  // One water plane: only the carved river, the lake and the shores dip
  // below its level, so it reads as water exactly where it should.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.width, WORLD.length + 300),
    new THREE.MeshPhongMaterial({ color: 0x2f6ea6, transparent: true, opacity: 0.88, shininess: 140 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.8, -WORLD.length / 2 + 60);
  scene.add(water);

  scene.add(buildRunway(THREE, WORLD.homeRunway));
  scene.add(buildRunway(THREE, WORLD.farRunway));

  // Towns from the shared building list (the same list physics collides with).
  {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const inst = new THREE.InstancedMesh(geo, mat, course.buildings.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const col = new THREE.Color();
    course.buildings.forEach((b, i) => {
      m.compose(
        new THREE.Vector3(b.x, terrainHeight(b.x, b.z) + b.h / 2 - 0.3, b.z),
        q,
        new THREE.Vector3(b.w, b.h, b.d)
      );
      inst.setMatrixAt(i, m);
      inst.setColorAt(i, col.setHex(b.color));
    });
    scene.add(inst);
  }

  // Trees: instanced cones on instanced trunks.
  {
    const coneGeo = new THREE.ConeGeometry(2.4, 7.5, 7);
    const coneMat = new THREE.MeshLambertMaterial({ color: 0x2e5d33 });
    const cones = new THREE.InstancedMesh(coneGeo, coneMat, course.trees.length);
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.45, 2.4, 6);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2c });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, course.trees.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    course.trees.forEach((t, i) => {
      m.compose(new THREE.Vector3(t.x, t.y + 1.2 * t.s, t.z), q, new THREE.Vector3(t.s, t.s, t.s));
      trunks.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(t.x, t.y + (2.4 + 3.4) * t.s, t.z), q, new THREE.Vector3(t.s, t.s, t.s));
      cones.setMatrixAt(i, m);
    });
    scene.add(trunks, cones);
  }

  // Clouds: clusters of flattened spheres.
  {
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.82 });
    const geo = new THREE.SphereGeometry(1, 10, 8);
    for (const cl of course.clouds) {
      const g = new THREE.Group();
      for (let i = 0; i < cl.puffs; i++) {
        const s = new THREE.Mesh(geo, mat);
        const off = (i - (cl.puffs - 1) / 2) * cl.s * 0.55;
        s.position.set(off, Math.sin(i * 2.1) * cl.s * 0.1, Math.cos(i * 1.7) * cl.s * 0.16);
        s.scale.set(cl.s * (0.75 - Math.abs(i - (cl.puffs - 1) / 2) * 0.12), cl.s * 0.30, cl.s * 0.5);
        g.add(s);
      }
      g.position.set(cl.x, cl.y, cl.z);
      scene.add(g);
    }
  }

  // Rings: gold torus + number badge, standing vertical across the course.
  const rings = course.rings.map((r) => {
    const group = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0xe8b62a, emissive: 0x7a5200 });
    const torus = new THREE.Mesh(new THREE.TorusGeometry(r.r, 1.1, 10, 30), mat);
    group.add(torus);
    const label = numberSprite(THREE, r.index + 1);
    label.position.set(0, r.r + 8, 0);
    group.add(label);
    group.position.set(r.x, r.y, r.z);
    scene.add(group);
    return { group, mat, label };
  });

  const { plane, prop } = buildPlane(THREE);
  scene.add(plane);

  function resize() {
    const w = canvas.clientWidth || 1280;
    const h = canvas.clientHeight || 720;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  return { THREE, renderer, scene, camera, plane, prop, rings, resize };
}
