# 27-0 Sound Assets

Place lightweight `.mp3` or `.wav` files here. The game loads them automatically;
if a file is missing, synthesized fallback tones play instead (no crash).

All sounds are triggered through `src/lib/sound.ts` → `src/lib/sound/manager.ts`.

Suggested files:

| File | Category | Used for |
|------|----------|----------|
| `click.mp3` | Navigation | UI clicks, sidebar nav, deliberate filter actions |
| `tab-change.mp3` | Navigation | Stats/leaderboard tabs, section toggles |
| `menu-open.mp3` | Navigation | Sidebar menu open |
| `menu-close.mp3` | Navigation | Sidebar menu close |
| `toggle.mp3` | Toggle | Generic switch sounds |
| `select.mp3` | Selection | Player selected, slot picked, bracket match selected |
| `reveal.mp3` | Selection | Player choices revealed |
| `reroll.mp3` | Action | Reroll used |
| `draft-place.mp3` | Action | Draft position placement |
| `remove.mp3` | Action | Fantasy player removed |
| `autofill.mp3` | Action | Fantasy autofill success |
| `complete.mp3` | Success | Squad position filled |
| `success.mp3` | Success | Positive confirmation |
| `warning.mp3` | Error | Short warning (autofill fail, validation) |
| `fail.mp3` | Error | F grade / failure |
| `hard-on.mp3` | Hard Mode | Hard Mode enabled |
| `hard-off.mp3` | Hard Mode | Hard Mode disabled |
| `era-on.mp3` | Era Mode | Era Challenge Cup enabled |
| `era-off.mp3` | Era Mode | Current Challenge Cup enabled |
| `simulate-round.mp3` | Simulation | Simulate next round / single cup match |
| `simulate-all.mp3` | Simulation | Simulate all remaining / full tournament |
| `season-start.mp3` | Simulation | Season / cup start |
| `win.mp3` | Match | Narrow match win |
| `loss.mp3` | Match | Match loss |
| `big-win.mp3` | Match | Big / thrashing win |
| `upset.mp3` | Match | Upset victory |
| `trophy.mp3` | Trophy | Cup final won, top grades |
| `cup-loss.mp3` | Trophy | Cup final lost |
| `perfect.mp3` | Season | 27-0 perfect season |
| `disaster.mp3` | Season | 0-27 winless season |
| `crowd.mp3` | Season | Season simulation complete |
| `expand.mp3` | Panel | Panels expanded (match details, cards, sections) |
| `panel-close.mp3` | Panel | Panels collapsed / modals closed |
| `historic.mp3` | Special | Historic player in offers |
| `legend.mp3` | Special | Legend player in offers |
| `goat.mp3` | Special | GOAT player in offers |
| `joe-mellor.mp3` | Easter egg | Joe Mellor mode |
| `super-sam-hallas.mp3` | Easter egg | Super Sam Hallas mode |
| `mode-normal.mp3` | Mode start | Normal / Classic mode |
| `mode-hard.mp3` | Mode start | Hard mode |
| `mode-draft.mp3` | Mode start | Draft mode |
| `challenge-cup.mp3` | Mode start | Challenge Cup activation |

Keep files short (&lt; 100 KB) and normalized volume for best results.

Sound toggle lives in the sidebar only (`27-0-sound-muted` in localStorage).
