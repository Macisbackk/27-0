# 27-0 Player Database

All game players come from these JSON files. **No fictional names.**

## Files

| File | Contents |
|------|----------|
| `clubs.json` | Club branding (colours, badges) for current and historic SL clubs |
| `current-squads.json` | Players registered to current Super League clubs |
| `historic-players.json` | Retired notable players from SL history |
| `legends.json` | Rugby League legends — rare, high-value reveals |

## Player Schema

```json
{
  "id": "club-cur-player-slug",
  "name": "Full Real Name",
  "position": "FULLBACK | WING | CENTRE | ... | LOOSE_FORWARD | Utility",
  "primaryPosition": "CENTRE",
  "club": "Club Name (must match clubs.json or alias)",
  "nationality": "Country",
  "era": "SUPER_LEAGUE_ORIGINS | EARLY_DOMINANCE | MODERN_ERA | CONTEMPORARY_ERA",
  "yearsActive": "1996–2010",
  "category": "current | historic | legend",
  "peakRating": 85,
  "value": 750000,
  "appearances": 200,
  "tries": 80,
  "intlCaps": 10,
  "hallOfFame": false,
  "clubLegend": false,
  "manOfSteel": false,
  "challengeCupWinner": false,
  "superLeagueWinner": false
}
```

Position strings like `"Scrum-half"` are auto-normalized on load.

**Utility players:** Set `"position": "Utility"` and optionally `"primaryPosition": "CENTRE"` for an explicit mapping. Without `primaryPosition`, the loader infers the best squad slot from career stats (e.g. Graeme Horne → Centre). Utility never causes validation errors.

## Adding Players

1. Edit the appropriate JSON file
2. Run `npm run validate:players` to validate
3. No game logic changes required

## Reveal Rates

- **80%** current squad players
- **20%** historic (including ~35% legend chance within historic pool)
