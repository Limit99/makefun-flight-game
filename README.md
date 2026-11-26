# Skyline Run

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/Limit99/makefun-flight-game/rank.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/Limit99/makefun-flight-game/reward.svg)](https://make.fun/c/best-flight-game-20261126-0057)

A valley flight game for the make.fun **best-flight-game-20261126-0057** bounty: take off from the home runway, thread twelve golden rings over a river, a lakeside town and a mountain ridge, and land the course before the 180-second window closes.

## How to play

Open `game/index.html` in a desktop browser (or run `node serve.ts` and open http://localhost:8080). No network, no build step — every file the game loads lives under `game/`.

1. **Take off** — press `Enter` (or click the panel). Throttle is already set; push `W` for full power.
2. **Steer** — `←` / `→` or `A` / `D` bank and turn, `↑` / `↓` climb and dive, `W` / `S` throttle up and down. `Space` levels the wings.
3. **Thread the rings** — the next ring is gold and numbered; fly through its centre for a perfect bonus. Each ring adds 6 seconds and builds your combo.
4. **Stay out of the ground** — the valley floor, the town roofs and the mountain ridge are all solid. A crash costs an airframe (you have 3) and 50 points.

Fly all 12 rings and the flight ends over the lake; run out of time or airframes and it ends where you are.

## The valley

A seeded procedural valley, the same every flight: a home runway, a river snaking down to the lake, a lakeside town with lit windows, a mountain ridge with snow-capped peaks, drifting clouds and a low sun. Altitude, speed, heading, throttle, time and score sit on the top HUD; an artificial horizon, a compass strip, a throttle gauge and vertical speed sit at the bottom.

## Files

- `game/` — the playable game (plain HTML + ES modules, canvas-drawn art, WebAudio sound, no libraries)
  - `game/src/config.js` — course, rings, flight model and colours
  - `game/src/world.js` — terrain, river, town, flight physics and scoring
  - `game/src/render.js` — chase view, terrain mesh, rings, plane and instruments
  - `game/src/input.js` — keyboard + mouse
  - `game/src/audio.js` — synthesised engine, wind, ring and crash sounds
  - `game/src/shots.js` — deterministic screenshot scenes (`?shot=start|play|end`)
  - `game/src/random.js` — seeded generator
  - `game/src/main.js` — boot and the game loop
- `main.ts` — the entry program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `screenshots/` — real renders of the game in a browser
