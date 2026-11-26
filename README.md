# Skyline Run

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/Limit99/makefun-flight-game/rank.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/Limit99/makefun-flight-game/reward.svg)](https://make.fun/c/best-flight-game-20261126-0057)

A 3D valley flight game for the make.fun **best-flight-game-20261126-0057** bounty: take off from the home runway, thread twelve golden rings down a mountain valley — over a snaking river, past two towns, toward a lake — manage your fuel against the throttle, ride out the crosswind gusts, and finish by landing on the far runway before the 180-second window closes.

## How to play

Open `game/index.html` in a desktop browser (or run `node serve.ts` and open http://localhost:8080). No network at runtime, no build step — every file the game loads lives under `game/`, including the vendored three.js build it renders with.

1. **Take off** — click the panel or press `Enter`, push `W` for power, and pull `↑` once you are fast enough.
2. **Steer** — `←` / `→` or `A` / `D` bank and turn, `↑` / `↓` climb and dive, `W` / `S` throttle. `Space` levels the wings. `P` pauses, `M` mutes, `R` restarts.
3. **Thread the rings** — the next ring glows gold and carries its number; dead-centre passes pay a perfect bonus and build your combo. Each ring adds 6 seconds and 6% fuel.
4. **Mind the tank** — full throttle drinks fuel at nearly triple the cruise rate. An empty tank means a dead engine and a glide. Crosswind gusts push you off the line; the HUD calls them out.
5. **Land to finish** — after ring 12, follow the LAND guidance to the far runway by the lake: slow, gentle and lined up pays a smooth-touchdown bonus; arrive hot or hard and the gear collapses. The valley floor, the town roofs and the ridge are all solid, and a crash costs one of your 3 airframes and 50 points.

## The valley

A seeded procedural valley, the same every flight: vertex-coloured 3D terrain with grass, rock and snow, a river carved down to a water plane, a lake at the far end, two towns of solid buildings, hundreds of low-poly pines, drifting clouds and fog on the horizon. Altitude, speed, heading, time, score, lives and fuel sit on the top HUD; an artificial horizon, a compass strip, vertical speed and the throttle gauge sit at the bottom.

## Files

- `game/` — the playable game (HTML + ES modules + vendored three.js, WebAudio sound)
  - `game/lib/three.min.js` — three.js r128 (MIT), vendored so the game runs fully offline
  - `game/src/config.js` — tuning: course, flight model, fuel, landing judgement
  - `game/src/world.js` — the shared world definition: terrain height field, rings, towns, trees, clouds
  - `game/src/render.js` — the three.js scene: terrain mesh, water, runways, towns, rings, the plane
  - `game/src/main.js` — boot, the flight model, scoring, landing judgement and the HUD
  - `game/src/input.js` — keyboard state and flight axes
  - `game/src/audio.js` — synthesised engine, wind, ring, crash and touchdown sounds
  - `game/src/shots.js` — deterministic screenshot scenes (`?shot=start|play|end`)
  - `game/src/random.js` — the seeded generator behind the world's placement
- `main.ts` — the entry program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `screenshots/` — real renders of the game in a browser
