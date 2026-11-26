// Skyline Run — sound: everything is synthesised with WebAudio, no audio
// files. An engine hum follows throttle and speed, wind follows speed, and
// rings, misses and crashes are short chimes. Audio only starts after a
// user gesture, as browsers require.
export function createAudio() {
  let ctx = null, engine = null, engineGain = null, wind = null, windGain = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      engine = ctx.createOscillator();
      engine.type = 'sawtooth';
      engine.frequency.value = 55;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 320;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      engine.connect(lp); lp.connect(engineGain); engineGain.connect(ctx.destination);
      engine.start();
      // Wind: looped filtered noise from a small generated buffer.
      const len = ctx.sampleRate;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      wind = ctx.createBufferSource();
      wind.buffer = buf; wind.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 0.6;
      windGain = ctx.createGain(); windGain.gain.value = 0;
      wind.connect(bp); bp.connect(windGain); windGain.connect(ctx.destination);
      wind.start();
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, at, dur, type, vol) {
    if (!ctx || muted) return;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(at); o.stop(at + dur + 0.05);
  }

  return {
    ensure,
    setMuted(m) { muted = m; if (engineGain) engineGain.gain.value = 0; if (windGain) windGain.gain.value = 0; },
    isMuted() { return muted; },
    // Called every frame while flying: engine and wind follow the plane.
    update(game) {
      if (!ctx || muted || !started) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const t = ctx.currentTime;
      const flying = game.phase === 'flying';
      engine.frequency.setTargetAtTime(48 + game.throttle * 70 + game.speed * 0.22, t, 0.1);
      engineGain.gain.setTargetAtTime(flying ? 0.045 + game.throttle * 0.05 : 0, t, 0.15);
      windGain.gain.setTargetAtTime(flying ? Math.min(0.09, game.speed / 2400) : 0, t, 0.2);
    },
    ring(perfect) {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      tone(660, t, 0.16, 'sine', 0.22);
      tone(880, t + 0.09, 0.18, 'sine', 0.22);
      if (perfect) tone(1320, t + 0.18, 0.28, 'sine', 0.2);
    },
    miss() {
      if (!ctx || muted) return;
      tone(220, ctx.currentTime, 0.25, 'triangle', 0.14);
    },
    crash() {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      tone(90, t, 0.5, 'sawtooth', 0.25);
      tone(55, t + 0.05, 0.6, 'square', 0.16);
    },
    click() {
      if (!ctx || muted) return;
      tone(520, ctx.currentTime, 0.07, 'sine', 0.12);
    },
    finish() {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      [523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * 0.12, 0.3, 'sine', 0.2));
    },
  };
}
