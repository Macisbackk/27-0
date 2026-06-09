# 27-0

Build the most valuable Super League rugby team from random player offers. Inspired by [82-0.com](https://82-0.com), built for English Super League fans.

**Runs entirely client-side** — no database, no authentication, no environment variables required.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). That's it.

## Gameplay

- Receive one real Super League player at a time
- **Sign** them to your XIII (if their position slot is open) or **Skip** them forever
- Fill all 13 positions to complete your run
- Your score = total transfer value of your squad
- Leaderboard and stats saved in **localStorage** on this device

### Squad Positions (13)

| Position | Count |
|----------|-------|
| Fullback | 1 |
| Wing | 2 |
| Centre | 2 |
| Stand Off | 1 |
| Scrum Half | 1 |
| Prop | 2 |
| Hooker | 1 |
| Second Row | 2 |
| Loose Forward | 1 |

## Tech Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **JSON player database** (bundled at build time)
- **localStorage** for leaderboard & statistics

## Player Database

All players are real — stored in `data/*.json`:

```
data/
├── clubs.json
├── current-squads.json
├── historic-players.json
└── legends.json
```

Validate after editing:

```bash
npm run validate:players
```

**Reveal logic:** 80% current players, 20% historic (with rare legend appearances).

See `data/README.md` for the player schema.

## Local Storage

| Key | Contents |
|-----|----------|
| `27-0-username` | Display name for leaderboard |
| `27-0-stats` | Career statistics |
| `27-0-leaderboard` | Daily / weekly / monthly / all-time scores |

Data is per-browser. Clear site data to reset.

## Project Structure

```
data/                     # Player database (source of truth)
scripts/validate-players.ts
src/
├── app/                  # Pages (no API routes)
├── components/           # UI
└── lib/
    ├── players/          # JSON loader & normalizer
    ├── game/             # Engine & generator
    └── storage/          # localStorage (stats, leaderboard, user)
```

## Deploy

Static-friendly Next.js app — deploy to Vercel with zero configuration:

```bash
npm run build
```

No `DATABASE_URL` or secrets needed.

## License

MIT
