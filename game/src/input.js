// Skyline Run v2 — keyboard input.
// A small state tracker: main.js polls held keys for the flight axes and
// asks about edge presses (pause, mute, restart) once per frame.

const HELD = new Set();
const PRESSED = new Set(); // edge-triggered, cleared by main.js each frame

const TRACKED = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space',
  'KeyP', 'KeyM', 'KeyR', 'Enter', 'Escape',
]);

export function initInput() {
  window.addEventListener('keydown', (e) => {
    if (TRACKED.has(e.code)) e.preventDefault();
    if (!e.repeat) PRESSED.add(e.code);
    HELD.add(e.code);
  });
  window.addEventListener('keyup', (e) => HELD.delete(e.code));
  window.addEventListener('blur', () => HELD.clear());
}

export function wasPressed(code) {
  return PRESSED.has(code);
}

export function clearPressed() {
  PRESSED.clear();
}

// -1..1 flight axes from whatever combination is held.
export function bankAxis() {
  let v = 0;
  if (HELD.has('ArrowLeft') || HELD.has('KeyA')) v -= 1;
  if (HELD.has('ArrowRight') || HELD.has('KeyD')) v += 1;
  return v;
}

export function pitchAxis() {
  let v = 0;
  if (HELD.has('ArrowUp')) v += 1;    // nose up
  if (HELD.has('ArrowDown')) v -= 1;  // nose down
  return v;
}

export function throttleAxis() {
  let v = 0;
  if (HELD.has('KeyW')) v += 1;
  if (HELD.has('KeyS')) v -= 1;
  return v;
}

export function levelWingsHeld() {
  return HELD.has('Space');
}
