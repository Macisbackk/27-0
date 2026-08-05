# Full correction pass — validation report

Generated: 2026-08-05

## Automated test gates

| Suite | Result | Key metrics |
|-------|--------|-------------|
| `test-squad-roles.ts` | **11/11 pass** | Legacy role migration, evaluator bands |
| `test-manager-fixture-display.ts` | **10/10 pass** | Concise league labels in Manager context |
| `test-scroll-lock.ts` | **11/11 pass** | Modal lock preserved when clearing animation locks |
| `test-reserve-distribution.ts` | **PASS** | Mean **72.91**, median **73.0**; bands 25/40/25/10% within tolerance |
| `sim-transfer-balance.ts` | **PASS** | Avg **3.54** senior approaches/season; **39.6%** opening-week share |
| `test-save-storage.ts` | **10/10 pass** | IndexedDB round-trip, interrupted write, legacy migration |
| `test-match-draws.ts` | **23/23 pass** | GP rules; Quick Mode no draws |

## Implementation summary by plan section

### 1. Shared foundations
- Context-aware competition labels (`managerFixtureDisplay.ts`)
- `UI_LAYERS`, `BORDER` tokens, `#game-portal-root`, `GameShortContent` / `GameEmptyState`
- `GameModal` + `RecruitmentSlotReveal` on shared portal/layers; `useScrollLock`

### 2. Squad roles
- New union: `key-player | first-team | rotation | squad-depth | reserve`
- Central evaluator (`squadRole.ts`) + `migrateSquadRoles.ts`
- UI labels via `formatSquadRole`; removed "Fringe / Development" tier text

### 3. Quick Mode mobile
- Portaled overlays + critical animation layer
- Portaled mobile Respin bar; compact selector padding
- Playoff: no auto-open Match Stats after simulation
- Mobile match results collapsed by default in Season Review

### 4. Reserves & Championship
- Reserve floor **65**; scale version **4** migration
- Weighted 65–82 distribution (mean 70–73)
- Championship rebalance in rating scale / squads / league modules

### 5. Transfer balance
- `TransferTargetPoolConfig` with senior/reserve weights, cooldowns, caps
- ~2–5 senior approaches per season (sim validated)
- Reduced Championship reserve bid frequency

### 6. Showcase & ages
- `/showcase` navigation verified; year filter extended
- `playerShowcaseVersion: 2`, `historicAgeDataVersion: 2` markers
- Joe Mellor GOAT exclusion preserved

### 7. Persistence v2
- IndexedDB career blobs; localStorage slot pointers only
- Staged writes with checksum verify; `saveStorageVersion: 2`
- Save size diagnostics by category

### 8. Manager flows
- **3** pre-season friendlies: batch select → confirm schedule → play in order
- Boosts consolidated to Club Office → Boosts (removed from Hub)
- Programme ticker resolves player names by ID

### 9. Fixtures & events
- Fixed duplicate venue labels ("Home, Home")
- `.fixture-matchup-title` prevents vertical letter breaks
- Onboarding modal scroll body uses `data-scroll-lock-allow`
- Golden Point events in live match path (`managerLiveMatch.ts`)

### 10. Typecheck
- `npx tsc --noEmit` — **pass**

## Remaining manual checks (recommended)
- Mobile widths 320–430px: Respin visibility, player selector, modal scroll
- Production build: `npm run build`
- Spot-check Manager Match Review for "Won in Golden Point" on tied games
