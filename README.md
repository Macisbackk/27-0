# 27-0

Super League rugby league squad builder and career sim. Inspired by [82-0.com](https://82-0.com).

**Manager Mode** is the headline experience — run a club through league, cup, and play-offs. **Quick Mode** is the fast spin-and-simulate loop. Optional Supabase auth syncs stats, leaderboards, and club funds across devices.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Optional: configure Supabase env vars for online accounts (see `.env.example` if present).

## Game Modes

### Manager Mode (`/manager`)

- Take charge of any real club: 14 Super League sides (real 2026 squads) or 22 Championship sides
- Each round is one screen: pick a game plan, tap **Play**, or sim to the next big game
- Super League (26 rounds, top-4 play-offs, Grand Final) and Championship (21 rounds); Challenge Cup alongside
- Promotion, relegation and the **Million Pound Game** (Championship runners-up v Super League 13th)
- Off-season: ageing, academy intake, a prestige-gated transfer market and a simple wage bill
- **Season challenges**, club **prestige**, and cross-career **Legacy points** that unlock real legends in the **Legend Vault**
- Records (fastest Championship-to-Grand-Final climb, best season, most trophies) on the online leaderboard
- Engine: `src/lib/career/` (pure TypeScript, seeded RNG); tests: `npm run test:career`

### Quick Mode (`/play`)

- Build a XIII position-by-position from club/year spins
- Simulate a 27-round season and play-offs
- **Current** — 2026 squads · **Era** — historic team-years

## Two Economies

| Currency | Where | Purpose |
|----------|--------|---------|
| **Club funds** | Quick Mode | Earned per run; spend in **Store** on UI themes; syncs when logged in |
| **Manager finances** | Manager save only | Transfer budget, prize money and wages — stays in your career |

## Player Database

Real Super League players in `data/*.json`. Validate after edits:

```bash
npm run validate:players
```

## Local Storage

| Key | Contents |
|-----|----------|
| `27-0-career-v2-save` | Manager Mode career |
| `27-0-career-v2-legacy` | Manager Mode legacy (unlocked legends, records) |
| `27-0-stats` | Quick Mode career stats |
| `27-0-club-funds` | Meta currency for Store |

Manager careers and legacy sync to your account when signed in.

## Tech Stack

- Next.js 15 (App Router), TypeScript, Tailwind CSS
- JSON player database bundled at build time
- localStorage + optional Supabase (auth, leaderboards, cloud stats)
