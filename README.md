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

- Choose a Super League club and manage a multi-season career
- Squad, tactics, contracts, transfers, reserves, inbox, friendlies
- Challenge Cup and top-six play-offs
- **Three save slots** on this device — **export/import JSON** from the landing screen to back up careers
- Manager finances (transfer budget, wages, gate income) are separate from Quick Mode club funds

### Quick Mode (`/play`)

- Build a XIII position-by-position from club/year spins
- Simulate a 27-round season and play-offs
- **Current** — 2026 squads · **Era** — historic team-years

## Two Economies

| Currency | Where | Purpose |
|----------|--------|---------|
| **Club funds** | Quick Mode | Earned per run; spend in **Store** on UI themes; syncs when logged in |
| **Manager finances** | Manager save only | Transfer budget, wages, gate receipts — stays in your career file |

## Player Database

Real Super League players in `data/*.json`. Validate after edits:

```bash
npm run validate:players
```

## Local Storage

| Key | Contents |
|-----|----------|
| `27-0-manager-career-slot-0/1/2` | Manager careers |
| `27-0-stats` | Quick Mode career stats |
| `27-0-club-funds` | Meta currency for Store |
| `27-0-manager-stats` | Manager lifetime stats (local) |

Export manager saves regularly — careers are not cloud-synced yet.

## Tech Stack

- Next.js 15 (App Router), TypeScript, Tailwind CSS
- JSON player database bundled at build time
- localStorage + optional Supabase (auth, leaderboards, cloud stats)
