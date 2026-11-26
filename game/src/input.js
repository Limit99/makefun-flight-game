// Skyline Run — input: keyboard plus mouse clicks on the title / end
// screens. Keys are read as a held set so holding a key steers smoothly;
// the game itself only ever sees steer / pitch / throttleDelta numbers.
export function createInput(canvas, handlers) {
  const keys = new Set();
  const state = { steer: 0, pitch: 0, throttleDelta: 0 };
  const codeOf = (e) => e.code;

  function onKeyDown(e) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys.add(codeOf(e));
    handlers.onPress?.(codeOf(e));
  }
  function onKeyUp(e) { keys.delete(codeOf(e)); }

  function poll() {
    const left = keys.has('ArrowLeft') || keys.has('KeyA');
    const right = keys.has('ArrowRight') || keys.has('KeyD');
    const up = keys.has('ArrowUp');
    const down = keys.has('ArrowDown');
    const thrUp = keys.has('KeyW');
    const thrDown = keys.has('KeyS');
    state.steer = (right ? 1 : 0) - (left ? 1 : 0);
    // Up arrow pulls the nose up (arcade convention, like the title says).
    state.pitch = (up ? 1 : 0) - (down ? 1 : 0);
    state.throttleDelta = (thrUp ? 1 : 0) - (thrDown ? 1 : 0);
    if (keys.has('Space')) state.steer *= 0.2;
    return state;
  }

  function onClick(e) {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 1280;
    const y = ((e.clientY - rect.top) / rect.height) * 720;
    handlers.onClick?.(x, y);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('click', onClick);
  // Space levels the wings: a tap while flying recentres roll and heading.
  function level() {
    keys.delete('Space');
  }
  return { poll, keys, level };
}

// Where a click counts as "start": the big centre panel on title/end.
export function inCentrePanel(x, y) {
  return x > 310 && x < 970 && y > 120 && y < 550;
}
