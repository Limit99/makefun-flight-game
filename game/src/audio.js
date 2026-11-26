// Skyline Run v2 — synthesized sound, no audio files.
// A WebAudio engine hum and wind rush that follow the flight, plus short
// one-shot cues for rings, misses, crashes, touchdown and the finish.
// Everything is created lazily on the first user gesture (browser policy).

let ctx = null;
let master = null;
let engineOsc = null;
let engineGain = null;
let windGain = null;
let windFilter = null;
let muted = false;

export function initAudio() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(ctx.destination);

  // Engine: a detuned saw pair through a lowpass, pitch follows throttle.
  engineOsc = ctx.createOscillator();
  engineOsc.type = 'sawtooth';
  engineOsc.frequency.value = 55;
  const engineFilter = ctx.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = 320;
  engineGain = ctx.createGain();
  engineGain.gain.value = 0.0;
  engineOsc.connect(engineFilter).connect(engineGain).connect(master);
  engineOsc.start();

  // Wind: looped noise through a bandpass, gain follows airspeed.
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;
  windFilter = ctx.createBiquadFilter();
  windFilter.type = 'bandpass';
  windFilter.frequency.value = 600;
  windFilter.Q.value = 0.6;
  windGain = ctx.createGain();
  windGain.gain.value = 0.0;
  noise.connect(windFilter).connect(windGain).connect(master);
  noise.start();
}

export function setMuted(m) {
  muted = m;
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.5, ctx.currentTime, 0.05);
}

export function isMuted() {
  return muted;
}

// Called every frame while flying.
export function updateAudio(throttle, speedNorm, running) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const target = running ? 0.05 + throttle * 0.075 : 0.0;
  engineGain.gain.setTargetAtTime(target, t, 0.12);
  engineOsc.frequency.setTargetAtTime(48 + throttle * 65 + speedNorm * 12, t, 0.12);
  windGain.gain.setTargetAtTime(running ? speedNorm * speedNorm * 0.16 : 0.0, t, 0.15);
  windFilter.frequency.setTargetAtTime(350 + speedNorm * 900, t, 0.15);
}

function blip(freqA, freqB, dur, type, vol, when = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freqA, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(30, freqB), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export function sndRing(perfect) {
  blip(880, 880, 0.12, 'sine', 0.22);
  blip(1318, 1318, 0.2, 'sine', 0.2, 0.09);
  if (perfect) blip(1760, 1760, 0.26, 'sine', 0.16, 0.18);
}

export function sndMiss() {
  blip(220, 160, 0.22, 'triangle', 0.18);
}

export function sndCrash() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const len = ctx.sampleRate * 0.4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = 0.5;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 900;
  src.connect(f).connect(g).connect(master);
  src.start(t);
  blip(120, 40, 0.4, 'sawtooth', 0.2);
}

export function sndTouchdown(smooth) {
  blip(300, 240, 0.1, 'sine', 0.2);
  if (smooth) {
    blip(660, 660, 0.14, 'sine', 0.18, 0.1);
    blip(990, 990, 0.22, 'sine', 0.16, 0.2);
  }
}

export function sndFinish() {
  const notes = [523, 659, 784, 1046];
  notes.forEach((n, i) => blip(n, n, 0.24, 'triangle', 0.2, i * 0.13));
}
