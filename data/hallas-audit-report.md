# Hallas Player Audit

Generated: 2026-06-10

## Summary

**Harvey Hallas is not a duplicate of Sam Hallas.** They are separate players in the Hallas rugby league family.

| Player | ID | Club in DB | Verdict |
| --- | --- | --- | --- |
| Sam Hallas | `bradford-cur-sam-hallas` | Bradford Bulls | Correct — hooker/loose forward at Bradford (Super League) |
| Harvey Hallas | `bradford-cur-harvey-hallas` | Bradford Bulls (was) | **Removed** — incorrect club assignment |
| Graeme Hallas | `hull-kr-hist-graeme-hallas` | Hull KR (historic) | Correct — separate historic player |

## Findings

### Sam Hallas
- Wikipedia: [Sam Hallas](https://en.wikipedia.org/wiki/Sam_Hallas) — born 18 October 1996, plays for Bradford Bulls.
- Son of Steven Hallas; nephew of Graeme Hallas.
- **Kept** as the canonical Bradford Hallas record.

### Harvey Hallas
- Listed on [Hunslet R.L.F.C. Wikipedia squad](https://en.wikipedia.org/wiki/Hunslet_R.L.F.C.) — prop, born ~1997.
- Plays for **Hunslet RLFC** (Championship), not Bradford Bulls.
- Was incorrectly added to `current-squads.json` as a Bradford current player (likely confused with Sam when Sam re-joined Bradford in 2024).
- **Removed** from `current-squads.json` and Bradford `team-year-rosters.json` entries.
- Not merged into Sam Hallas — different person, different career path.

### Super Sam Hallas easter egg
- Hidden `ssh-sam-hallas-group` records were **not modified**.

## Actions taken
1. Removed `bradford-cur-harvey-hallas` from `data/current-squads.json`
2. Removed `bradford-cur-harvey-hallas` from Bradford entries in `data/team-year-rosters.json`
3. Added Wikipedia-verified DOB for Sam Hallas (`1996-10-18`)
