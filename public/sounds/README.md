# 27-0 Sound Assets

Place lightweight `.mp3` or `.wav` files here. The game loads them automatically;
if a file is missing, synthesized fallback tones play instead (no crash).

**Current ship state:** no binary assets are committed. Runtime audio is Web Audio
synth via `src/lib/sound/synth.ts`, orchestrated by `src/lib/sound/manager.ts`
and semantic helpers in `src/lib/sound.ts`.

Do not call `new Audio()` from components — always use `playSound("…")` /
helpers such as `playTryScored()`, `playProgressWeek()`, etc.

Sound toggle lives in the sidebar (`27-0-sound-muted` in localStorage).
Mobile: audio unlocks on first pointer/keydown (`initSoundUnlock`).

## Mix hierarchy (approx.)

1. Quiet UI (click / tab / toggle)
2. Notifications (transfer offer, popup open)
3. Match events (try > conversion > half-time)
4. Major results / achievements

## Suggested files

| File | Category | Used for |
|------|----------|----------|
| `click.mp3` | UI | Primary / secondary UI clicks |
| `tab-change.mp3` | Navigation | Tab / section changes (cooldown-limited) |
| `menu-open.mp3` / `menu-close.mp3` | Navigation | Menus / popup open-close aliases |
| `toggle.mp3` | UI | Generic switches |
| `select.mp3` | Selection | Player / boost select |
| `reveal.mp3` | Selection | Choice / offer reveal |
| `reroll.mp3` | Quick Mode | Respin activation |
| `slot-spin-start.mp3` / `slot-spin-tick.mp3` / `slot-land.mp3` | Quick Mode | Spin cadence + land |
| `draft-place.mp3` / `remove.mp3` / `autofill.mp3` | Draft | Placement actions |
| `complete.mp3` | Success | Position filled / calendar complete alias |
| `success.mp3` / `warning.mp3` / `fail.mp3` | Feedback | Confirm / soft fail |
| `hard-on.mp3` / `hard-off.mp3` | Mode | Hard Mode toggle |
| `era-on.mp3` / `era-off.mp3` | Mode | Era Mode toggle |
| `simulate-round.mp3` / `simulate-all.mp3` | Simulation | Round sim / Progress Week file alias |
| `season-start.mp3` | Match | Kick-off / match started alias |
| `win.mp3` / `loss.mp3` / `big-win.mp3` / `upset.mp3` | Match | Result presentation |
| `trophy.mp3` / `cup-loss.mp3` | Trophy | Cup / achievement |
| `perfect.mp3` / `disaster.mp3` / `crowd.mp3` | Season | Season outcomes / FT alias |
| `expand.mp3` / `panel-close.mp3` | Panel | Expand / collapse |
| `historic.mp3` / `legend.mp3` / `goat.mp3` | Special | Offer rarity |
| `joe-mellor.mp3` / `super-sam-hallas.mp3` | Easter egg | Mode easter eggs |
| `mode-normal.mp3` / `mode-hard.mp3` / `mode-draft.mp3` / `challenge-cup.mp3` | Mode start | Mode activation |

Semantic IDs without dedicated files reuse the paths above (see `SOUND_FILES` in
`manager.ts`) and have dedicated synth tones where important:

- `tryScored`, `conversion`, `conversionMiss`, `halfTime`
- `progressWeek`, `calendarComplete`, `goldenPointStart`
- `achievementUnlock`

Keep files short (&lt; 100 KB), CC0 / owned / properly licensed only — never
ripped from commercial sports games.
