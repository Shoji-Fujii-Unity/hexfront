# HEXFRONT

[日本語](README.md) | [English](README.en.md) | [简体中文](README.zh-CN.md)

A turn-based strategy game where you command modern military units on a hex grid and fight to capture territory.
It runs entirely in your browser. **The game is a single `index.html` file; no server, libraries, or network
connection are required.** It also works offline.

- Pixel-art sprites, terrain, sound effects, and music are generated in code (no image or audio files)
- Designed for landscape screens. On phones, play in landscape; a notice appears in portrait mode, but you can continue
- Languages: Japanese / English / Simplified Chinese (switch from the title screen or the top-right button; your choice is saved)
- Sound effects and music are synthesized with WebAudio and can be toggled independently in Settings; choices are saved. Music starts after the first interaction, and the top-right button controls sound effects only
- Unit badges show short type codes; tap a unit or consult the codex for its name. Zoom in when needed. With no unit selected, tap terrain to inspect its effects and land movement costs (friendly factories and airfields open production)
- Saves automatically to browser localStorage when you suspend or end a turn; continue from the title screen

## How to Play

### Victory conditions
1. **Capture the enemy HQ.** It takes three capture points. While being captured, the HQ fires back for 20 damage.
2. **Eliminate the enemy.** The enemy has no units or income sources and cannot afford its cheapest unit.
3. **At the turn limit, score decides the winner** (funds, surviving unit value, income from controlled properties, and HQ). Both sides play the final turn; ties go to the first player.

### Turn sequence
1. Tap or click one of your units. Move to a green hex, or attack by selecting an enemy (a damage forecast appears first).
2. Capture cities, farms, factories, airfields, and supply depots with infantry and other eligible units to increase your income.
3. Spend your income to build units at factories and airfields (production slots are limited).
4. Select **End Turn** to let the enemy AI take its turn.

### Supply and ammunition
- Resupply fuel and ammunition on or next to a friendly supply location, such as a city, farm, or depot.
- Supply trucks also resupply adjacent units. Units without fuel cannot move; units without ammunition cannot attack.
- Self-sufficient units (such as infantry, machine guns, and anti-tank missile teams) have unlimited ammunition.

### Units
There are 17 real-world units: rifle squad (M16), M240 machine gun, Javelin anti-tank missile team, engineers, M939
truck, M113 armored personnel carrier, M2 Bradley, M1A2 Abrams, PzH 2000, M270 MLRS, M163 Vulcan, MIM-104 Patriot,
CH-47, MQ-9, AH-64, M142 HIMARS, and AEW&C.

Units are divided into land and air forces, and into four classes: infantry, _SOFT_ (light armor), armor, and air.
Class matchups, range, terrain defence, forests, cities, hills, mountains, rivers, bridges, and ferries all affect combat.
Advanced units unlock as you progress through the campaign; locked units are shown in the codex.

### Controls
| Action | Phone (landscape) | PC |
|---|---|---|
| Select / move / attack a unit | Tap | Click |
| Pan the map | Drag | Drag / mouse wheel |
| Zoom | Pinch | Mouse wheel or ＋ / － / FIT buttons |
| Cancel | Bottom **Cancel** button | Esc |
| Undo the current turn | Bottom **Undo** button | Same |

Commands are at the bottom, funds/turn/unit count at the top, combat log at the lower left, and sound/language/menu
controls at the upper right.

## Campaign (12 stages)

| # | Name | Map | Turn limit | Starting funds | Unit cap | Theme |
|---|---|---:|---:|---:|---:|---|
| 1 | First Contact | 15×9 | 20 | 30 | 6 | Plains |
| 2 | River Crossing | 17×10 | 22 | 45 | 8 | River and bridges |
| 3 | Forest Ambush | 19×10 | 25 | 60 | 10 | Forest |
| 4 | Mountain Pass | 21×11 | 28 | 80 | 12 | Mountains |
| 5 | Desert Convoy Route | 23×11 | 30 | 100 | 14 | Desert |
| 6 | Coastal Airfield | 25×12 | 32 | 120 | 16 | Coast |
| 7 | Twin Rivers | 27×12 | 34 | 145 | 18 | Forest and rivers |
| 8 | Urban Assault | 29×13 | 36 | 170 | 19 | City |
| 9 | Delta Defence Line | 31×13 | 38 | 200 | 20 | Delta |
| 10 | Desert Clash | 33×14 | 42 | 230 | 21 | Desert |
| 11 | Mountain Fortress | 35×15 | 46 | 260 | 22 | Mountain fortress |
| 12 | Final Offensive | 37×16 | 52 | 300 | 24 | Mixed |

Stages use fixed seeds, so each is a designed battle with the same map every time. Choose Easy, Normal, or Hard for
the enemy strength.

## Getting Started

1. Open `index.html` in a browser (double-click it; on a phone, transfer the file and open it).
2. On the title screen, select **New Operation**, choose a stage, then select **Start**.
3. If you close the game, open it again and select **Continue** to resume.

Save data is stored in browser localStorage:
- `hexfront.save.v1` — the current game
- `hexfront.profile.v1` — language, sound effects, music, difficulty, high scores, and unlocked stages

Clearing browser site data also deletes saves. To transfer progress to another device, use the same browser and file name.

## Development, Build, and Tests

```text
hexfront/
  index.html          Final game (parts concatenated)
  build.ps1           Concatenates parts/ into index.html
  parts/              p00_head.html, p01_core, p02_i18n, p03_data,
                      p04_stages, p05_rules, p06_ai, p07_render,
                      p08_ui, p09_audio, p10_main, p99_foot
  tests/
    logic-test.js     Logic tests without a DOM (hex math, rules, AI self-play, etc.)
    browser-test.js   UI, input, rendering, and mobile tests using headless Chrome (CDP)
    audio-test.js     Audio scheduling and profile compatibility tests
    shots/            Screenshots generated by browser-test
```

```powershell
# Build (parts → index.html)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File build.ps1

# Tests (about 300 logic checks, then about 60 browser checks)
node tests/logic-test.js
node tests/audio-test.js
node tests/browser-test.js
```

- `browser-test.js` controls headless Chrome over CDP (no npm required; uses Node 24 `WebSocket`/`fetch`).
  The default Chrome path is `C:\Program Files\Google\Chrome\Application\chrome.exe`.
- Debug mode: open `index.html?debug=1` to enable test hooks such as funds cheats and turn automation (`HF.ui.dbg.*`).

### Implementation notes
- The hex grid uses pointy-top odd-r offset coordinates. `HF.axial` / `HF.DIRS` are central to correctness and performance.
- Combat rolls are deterministic via `HF.hash01`, so the attack forecast matches the actual combat roll.
- Sprites are defined as ASCII bitmaps (`HF.ART`) and palettes (`HF.PAL`), then rendered from an offscreen canvas with nearest-neighbor scaling.
- The AI evaluates cached threat, supply, and enemy-HQ pressure fields, taking tens of milliseconds per turn even on large maps.
