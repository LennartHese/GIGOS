# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

GIGOS — Zehlendorf Mitte is a German-language, Pokémon-style top-down exploration/creature-collecting satire set in a fictionalized Berlin-Zehlendorf. Content is adult/satirical (drug-culture and Berlin club-scene jokes, e.g. catchable "Gigos" like `koks`, `ecstasy`, a "Blue Punisher" item) — keep that tone in mind when editing dialogue/flavor text so additions stay consistent with the existing voice.

The game is a multi-file, native-ES-module HTML5 canvas project (no bundler, no build step, no dependencies, no package.json). Everything is procedural pixel art — canvas draw calls, not sprite sheets — except a handful of real image assets under `assets/images/`.

`backup/gigos-zehlendorf.html` is the **original single-file version** of the game (~4300 lines, everything inline) kept as an untouched historical reference/spec. It must **never be edited**. The live, developed game is entirely under `src/`, `index.html`, `styles/`, and `assets/`.

## Running / testing

Native ES module imports (`<script type="module">`) are blocked under `file://` in browsers, so the game must be served over HTTP:

```
python -m http.server 8765
```

then open `http://localhost:8765/index.html`. This is a local dev convenience only — the shipped game is still just static files, deployable to any web server.

There are no automated tests or linters configured. Verify changes by playing through the affected area in a browser. There's no save/load system (no `localStorage` use) — game state is entirely in-memory and resets on page reload.

## Architecture

```
index.html                 shell: canvas + UI divs, links styles/main.css, loads src/main.js as a module
styles/main.css            all CSS (verbatim from the original inline <style> block)
assets/images/              3 JPEG loading screens (title + district loads), UI PNGs (door/owner/bark/punisher
                             sprites), and a handful of image-backed Gigo sprites (kraehe/squirrel/krabbe)
src/
  main.js                   the hub: shared bootstrapping + cross-scene dispatch (see below)
  core/                      constants.js, math.js, canvas.js, state.js, input.js — no gameplay branching
  data/                      gigodex.js, moves.js, encounters.js, starters.js — plain data tables
  entities/                  player.js, drawChar.js, creatures.js — player + generic humanoid/creature drawing
  systems/                   dialogue.js, inventory.js, dex.js, party.js, evolution.js, battle.js
  ui/                        banner.js, toast.js — small self-contained DOM UI pieces
  world/                     one file per scene: town.js, efes.js, cafe.js, wohnung.js, eiche.js, chb.js,
                             kl.js, mitte.js, club.js
```

### The central state object

`src/core/state.js` exports `const G = { state: 'title', scene: 'town' }`. Every module imports `{ G }` and reads/writes `G.state` / `G.scene` as object properties — never reassigns the imported binding itself (that's illegal for ES module imports; only object-property mutation works across files).

### Scene modules (`src/world/*.js`)

Each scene owns its own offscreen "below"/"above" canvas pair, its own `solids`/`inters`/`doors` collision & interaction arrays, and exports the same shape of functions: `build*()` (called once at startup), `blocked*(nx,ny)` (collision check), `checkEncounter*()` (wild-encounter roll, where applicable), `render*()`, and — except for `town.js`, which is the default/starting scene — `enter*()`/`exit*()` transition functions.

`main.js` still owns the **shared per-frame dispatch**: `update(dt)`, `render()`/`_render()`, and `tryInteract()` are each one big function with an `if(G.scene==='x')` / `else if` branch per scene, calling into that scene's exported `blockedX`/`checkEncounterX`/`renderX`/etc. When adding a new scene, mirror an existing one's exports and wire it into all three dispatchers plus a `doors` entry for the transition — don't invent a new per-scene pattern.

### Cross-scene mutable state lives in `main.js`

A handful of pieces of state are read by scene modules but written by `main.js`'s own shared dispatch code every frame (most commonly per-scene camera offsets, e.g. `ccamx/ccamy` for CHB, `klcamx/klcamy` for KL, `mitcamx/mitcamy` for Mitte, `clubcamx/clubcamy` for Club, and the town's own `camx/camy`). These stay declared and `export`ed in `main.js`, with a `setXCam(x,y)` setter for the owning scene's own `enter*()` function to call, while `main.js`'s per-frame code writes them directly. Other shared cross-file state (`sitting`/`clearSitting`, `encCool`, `grassFlash`/`setGrassFlash`, `enterCool`/`setEnterCool`, `hasLeo`/`setHasLeo`, quest flags like `clubUnlocked`/`loveAura`) follows the same pattern: a plain export for reads, a setter function for the rare cross-file write (since reassigning an imported `let` binding directly is illegal in ES modules).

Some scene files import from each other directly rather than going through `main.js` — e.g. `club.js` imports palettes from `mitte.js` and `cground` from `chb.js`, `mitte.js` imports palettes from `chb.js`, and `town.js`/`eiche.js` mutually import from each other (`town.js` needs `eiche.js`'s `setEicheReturn`; `eiche.js` needs `town.js`'s shared `cat` object for the post-quest companion behavior). These circular imports are safe because both sides only touch the imported binding inside function bodies (called later, after all modules have finished loading), never at module top-level evaluation.

### Creature/battle system

`src/data/gigodex.js` exports `GIGODEX`, the master creature registry (stats, type, rarity, catch rate, moves, a `draw` fn, evolution config, dex flavor text); it circularly imports creature draw functions from `src/entities/creatures.js` (also safe — draw functions are only called from within render calls, not at module load). `src/data/moves.js` defines attacks. `src/systems/battle.js` holds `makeGigo`, `calcDamage`, `catchChance`, XP/leveling, and the full battle state machine (`startBattle`/`updateBattle`/`renderBattle`/`battleKey`). `src/systems/evolution.js` handles the evolve cutscene. `src/data/encounters.js` has the per-zone wild-spawn tables (`WILDENC`/`AREA_CAP`) and `rollWild()`.

### Other systems

`src/systems/dialogue.js` — linear (`openDialog`/`advanceDialog`) and branching (`openChoice`/`pickChoice`) dialogue. `src/systems/dex.js` — the in-game Berlinodex (`DEX_PAGES`, `renderDex`, `openDex`/`closeDex`, `dexSeen`/`dexCaught` tracking, the latter two actually live in `main.js`). `src/systems/party.js` — team management and the catch-overflow choice screen. `src/systems/inventory.js` — item pickup/use.

When editing, prefer following the existing per-area function-naming convention (`enterX`/`exitX`/`renderX`/`blockedX`/`checkEncounterX`) and the setter-for-cross-file-write pattern rather than introducing a new abstraction, since the codebase leans on this consistency instead of shared frameworks.
