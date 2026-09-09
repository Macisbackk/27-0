#!/usr/bin/env python3
"""Update Current Super League peak ratings from live Fantasy Super League 2026.

Peer-calibrates within position groups using this season's Fantasy Score totals,
then discounts / caps by live Super League table position so bottom clubs are
not inflated by volume stats in losing games.

Injury / low-availability players are not crushed for weak season totals.

Usage:
  python scripts/update-current-ratings-from-fantasy-2026.py
  npx tsx scripts/apply-player-attrs.ts --batch data/player-attr-batch.json
"""
from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FANTASY_MD = ROOT / "data" / "imports" / "fantasy-super-league-players-2026.md"
OUT_BATCH = ROOT / "data" / "player-attr-batch.json"
OUT_REPORT = ROOT / "data" / "fantasy-rating-live-update-2026-report.json"

ERA_26 = {
    "Bradford Bulls",
    "Castleford Tigers",
    "Catalans Dragons",
    "Huddersfield Giants",
    "Hull FC",
    "Hull KR",
    "Leeds Rhinos",
    "Leigh Leopards",
    "St Helens",
    "Toulouse Olympique",
    "Wakefield Trinity",
    "Warrington Wolves",
    "Wigan Warriors",
    "York Knights",
}

POS = sorted(
    [
        "Full Back",
        "Winger",
        "Centre",
        "Stand Off",
        "Scrum Half",
        "Prop",
        "Hooker",
        "Second Row",
        "Loose Forward",
    ],
    key=len,
    reverse=True,
)
POS_PAT = "|".join(re.escape(p) for p in POS)
POS_GROUP = {
    "FULLBACK": "OUTSIDE",
    "WING": "OUTSIDE",
    "CENTRE": "OUTSIDE",
    "STAND_OFF": "HALVES",
    "SCRUM_HALF": "HALVES",
    "HOOKER": "HOOKER",
    "PROP": "PROP",
    "SECOND_ROW": "BACKROW",
    "LOOSE_FORWARD": "BACKROW",
}

# Late-2026 season peer knots (Score → rating).
OUTSIDE_CURVE = [
    (0, 74),
    (300, 75),
    (500, 77),
    (700, 80),
    (850, 83),
    (963, 87),
    (1111, 87),
    (1180, 89),
    (1300, 91),
    (1450, 93),
]
HALVES_CURVE = [
    (0, 74),
    (300, 75),
    (500, 77),
    (700, 80),
    (900, 83),
    (973, 84),
    (1080, 90),
    (1220, 91),
    (1350, 93),
    (1500, 94),
]
GENERIC_CURVE = [
    (0, 74),
    (300, 75),
    (500, 77),
    (700, 80),
    (900, 83),
    (1100, 86),
    (1250, 88),
    (1400, 91),
    (1550, 93),
]
CURVE_MAP = {
    "OUTSIDE": OUTSIDE_CURVE,
    "HALVES": HALVES_CURVE,
    "HOOKER": GENERIC_CURVE,
    "PROP": GENERIC_CURVE,
    "BACKROW": GENERIC_CURVE,
    "OTHER": GENERIC_CURVE,
}

# Never overwrite these elite / intentional locks.
PROTECTED = {
    "wigan-cur-bevan-french",
    "hull-kr-cur-mikey-lewis",
    "wigan-cur-zach-eckersley",
    "warrington-cur-matty-ashton",
    "castleford-cur-daejarn-asi",
    "toulouse-cur-olly-ashall-bott",
}
MANUAL_LOCKS: dict[str, int] = {
    "bradford-cur-ryan-sutton": 84,
    "bradford-cur-loghan-lewis": 78,
    "toulouse-cur-olly-ashall-bott": 87,
}

# BBC Super League table — last updated 5 Sep 2026.
TABLE_POS: dict[str, int] = {
    "Wigan Warriors": 1,
    "Leeds Rhinos": 2,
    "Warrington Wolves": 3,
    "Wakefield Trinity": 4,
    "Leigh Leopards": 5,
    "Hull KR": 6,
    "St Helens": 7,
    "Toulouse Olympique": 8,
    "Catalans Dragons": 9,
    "York Knights": 10,
    "Castleford Tigers": 11,
    "Hull FC": 12,
    "Huddersfield Giants": 13,
    "Bradford Bulls": 14,
}

MIN_GAP = 3
MAX_STEP = 6


def table_pos(club: str) -> int:
    if club in TABLE_POS:
        return TABLE_POS[club]
    for name, pos in TABLE_POS.items():
        if norm(name) == norm(club):
            return pos
    return 10


def fantasy_score_factor(pos: int) -> float:
    """Bottom-table clubs rack up fantasy volume in losing games — discount it."""
    if pos <= 4:
        return 1.0
    if pos <= 7:
        return 0.95
    if pos <= 10:
        return 0.82
    return 0.70


def rating_ceiling(pos: int) -> int:
    if pos <= 4:
        return 94
    if pos <= 7:
        return 92
    if pos <= 10:
        return 88
    return 86


def max_step_for(pos: int, upward: bool) -> int:
    if not upward:
        return MAX_STEP
    if pos <= 7:
        return MAX_STEP
    if pos <= 10:
        return 4
    return 3


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", s)).strip()


def interp(score: float, knots: list[tuple[int, float]]) -> float:
    if score <= knots[0][0]:
        return float(knots[0][1])
    if score >= knots[-1][0]:
        return float(knots[-1][1])
    for i in range(1, len(knots)):
        x0, y0 = knots[i - 1]
        x1, y1 = knots[i]
        if x0 <= score <= x1:
            return y0 + (score - x0) / max(1e-9, x1 - x0) * (y1 - y0)
    return float(knots[-1][1])


def clamp(cur: int, tgt: int, cap: int = MAX_STEP) -> int:
    d = tgt - cur
    if d > cap:
        return cur + cap
    if d < -cap:
        return cur - cap
    return tgt


def parse_price(raw: str) -> int | None:
    m = re.search(r"([\d.]+)\s*k", raw or "", re.I)
    if not m:
        return None
    try:
        return int(float(m.group(1)) * 1000)
    except ValueError:
        return None


def parse_fantasy(text: str) -> list[dict]:
    out: list[dict] = []
    for line in text.splitlines():
        if not line.startswith("|"):
            continue
        parts = [p.strip() for p in line.strip().strip("|").split("|")]
        if len(parts) < 12:
            continue
        name_cell = parts[1]
        if name_cell in ("Name", "---") or parts[0] == "Team":
            continue
        m = re.match(rf"^(.+?)({POS_PAT})$", name_cell)
        name = m.group(1).strip() if m else name_cell
        try:
            last_rd = int(parts[-2].replace(",", ""))
            score = int(parts[-1].replace(",", ""))
        except ValueError:
            continue
        # Team | Name | Pos# | Price | M | ...
        price_raw = parts[3] if len(parts) > 3 else ""
        try:
            metres = int(parts[4].replace(",", ""))
        except (ValueError, IndexError):
            metres = 0
        out.append(
            {
                "name": name,
                "norm": norm(name),
                "priceRaw": price_raw,
                "price": parse_price(price_raw),
                "metres": metres,
                "lastRd": last_rd,
                "score": score,
            }
        )
    return out


def expected_floor(price: int | None) -> int:
    if not price:
        return 200
    if price >= 150_000:
        return 700
    if price >= 130_000:
        return 550
    if price >= 110_000:
        return 400
    if price >= 90_000:
        return 250
    return 100


def availability(live: dict) -> str:
    score = int(live.get("score") or 0)
    last_rd = int(live.get("lastRd") or 0)
    metres = int(live.get("metres") or 0)
    price = live.get("price")
    floor = expected_floor(price)
    if last_rd == 0 and (price or 0) >= 110_000 and score < floor:
        return "injured_out"
    if metres < 40 and (price or 0) >= 110_000 and score < floor * 0.7:
        return "injured_out"
    if last_rd == 0 and (price or 0) >= 100_000:
        return "limited"
    return "available"


def main() -> None:
    if not FANTASY_MD.exists():
        raise SystemExit(f"Missing Fantasy dump: {FANTASY_MD}")

    fantasy = parse_fantasy(FANTASY_MD.read_text(encoding="utf-8", errors="replace"))
    live_by: dict[str, dict] = {}
    for row in fantasy:
        prev = live_by.get(row["norm"])
        if not prev or row["score"] > prev["score"]:
            live_by[row["norm"]] = row

    squads = json.loads((ROOT / "data" / "current-squads.json").read_text(encoding="utf-8"))
    if isinstance(squads, dict):
        raise SystemExit("Unexpected current-squads.json shape")
    era = [p for p in squads if (p.get("club") or p.get("team")) in ERA_26]

    ov = json.loads((ROOT / "data" / "player-rating-overrides.json").read_text(encoding="utf-8"))
    pot_ov = {k: int(v) for k, v in (ov.get("potentialOverrides") or {}).items()}

    ratings: dict[str, int] = {}
    pots: dict[str, int] = {}
    changes: list[dict] = []
    skipped: list[dict] = []
    unmatched = 0

    for p in era:
        pid = p["id"]
        name = p["name"]
        cur = int(p["peakRating"])
        live = live_by.get(norm(name))
        if not live:
            # soft name contains match
            for k, v in live_by.items():
                if norm(name) in k or k in norm(name):
                    live = v
                    break
        if not live:
            unmatched += 1
            skipped.append({"id": pid, "name": name, "reason": "no fantasy row"})
            continue

        if pid in MANUAL_LOCKS:
            lock = MANUAL_LOCKS[pid]
            if cur != lock:
                ratings[pid] = lock
                changes.append(
                    {
                        "id": pid,
                        "name": name,
                        "from": cur,
                        "to": lock,
                        "fantasyScore": live["score"],
                        "reason": f"manual lock {lock}",
                    }
                )
            else:
                skipped.append({"id": pid, "name": name, "reason": "manual lock"})
            continue

        if pid in PROTECTED:
            skipped.append(
                {
                    "id": pid,
                    "name": name,
                    "reason": f"protected elite ({live['score']} fantasy)",
                    "fantasyScore": live["score"],
                }
            )
            continue

        avail = availability(live)
        score = int(live["score"])
        if score <= 0:
            skipped.append(
                {
                    "id": pid,
                    "name": name,
                    "reason": "zero fantasy — leave current",
                    "fantasyScore": 0,
                }
            )
            continue

        if avail == "injured_out":
            skipped.append(
                {
                    "id": pid,
                    "name": name,
                    "reason": "injured/out — skip crush",
                    "fantasyScore": score,
                    "lastRd": live["lastRd"],
                }
            )
            continue

        club = p.get("club") or p.get("team") or ""
        pos = table_pos(club)
        factor = fantasy_score_factor(pos)
        adj_score = score * factor
        group = POS_GROUP.get(p.get("position") or "", "OTHER")
        implied_raw = interp(score, CURVE_MAP[group])
        implied = interp(adj_score, CURVE_MAP[group])
        ceiling = rating_ceiling(pos)
        target = min(int(round(implied)), ceiling)
        gap = abs(cur - target)
        if gap < MIN_GAP:
            skipped.append(
                {
                    "id": pid,
                    "name": name,
                    "reason": (
                        f"within +/-{MIN_GAP - 1} of table-adj peer ~{implied:.1f} "
                        f"(pos {pos}, raw ~{implied_raw:.1f})"
                    ),
                    "fantasyScore": score,
                    "tablePos": pos,
                }
            )
            continue

        # Soften cuts when limited availability.
        if avail == "limited" and target < cur:
            target = max(target, cur - 2)

        # Don't crush low-volume players on sparse season totals.
        if target < cur and score < 250:
            skipped.append(
                {
                    "id": pid,
                    "name": name,
                    "reason": f"low volume ({score}) — skip cut",
                    "fantasyScore": score,
                    "tablePos": pos,
                }
            )
            continue

        # Bottom clubs: only big fantasy outliers get upward moves.
        if target > cur and pos >= 11 and score < 1000:
            skipped.append(
                {
                    "id": pid,
                    "name": name,
                    "reason": f"bottom-table (pos {pos}) — need 1000+ fantasy to boost",
                    "fantasyScore": score,
                    "tablePos": pos,
                }
            )
            continue

        step = max_step_for(pos, upward=target > cur)
        to = clamp(cur, target, step)
        if to == cur:
            continue

        ratings[pid] = to
        by = p.get("birthYear") or 0
        pot = pot_ov.get(pid)
        if by >= 2002:
            pot = max(pot or 0, to + 2)
        elif pot is not None:
            pot = max(pot, to)
        if pot is not None:
            pots[pid] = pot

        changes.append(
            {
                "id": pid,
                "name": name,
                "club": club,
                "from": cur,
                "to": to,
                "peerImpliedRaw": round(implied_raw, 1),
                "peerImplied": round(implied, 1),
                "tablePos": pos,
                "scoreFactor": factor,
                "ceiling": ceiling,
                "fantasyScore": score,
                "lastRd": live["lastRd"],
                "availability": avail,
                "group": group,
                "reason": (
                    f"FSL {score} x{factor:.2f} (table {pos}) → peer ~{implied:.1f} "
                    f"cap {ceiling} ({avail}; step +/-{step})"
                ),
            }
        )

    for pid, r in list(ratings.items()):
        if pid in pots:
            pots[pid] = max(pots[pid], r)

    changes.sort(key=lambda c: (-abs(c["to"] - c["from"]), c["name"]))
    batch = {"ratings": ratings, "potentials": pots}
    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": str(FANTASY_MD),
        "tableSource": "BBC Super League table (5 Sep 2026)",
        "tablePos": TABLE_POS,
        "fantasyRows": len(fantasy),
        "eraPlayers": len(era),
        "unmatched": unmatched,
        "ratingChanges": len(ratings),
        "potentialSets": len(pots),
        "minGap": MIN_GAP,
        "maxStep": MAX_STEP,
        "changes": changes,
        "skippedSample": skipped[:40],
        "skippedCount": len(skipped),
    }
    OUT_BATCH.write_text(json.dumps(batch, indent=2) + "\n", encoding="utf-8")
    OUT_REPORT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    print(f"Fantasy rows: {len(fantasy)} | Era players: {len(era)}")
    print(f"Rating changes: {len(ratings)} | Potentials: {len(pots)} | Skipped: {len(skipped)}")
    print("\nName                         From   To   d  Fant  Reason")
    for c in changes[:60]:
        d = c["to"] - c["from"]
        name = c["name"].encode("ascii", "replace").decode("ascii")
        reason = c["reason"][:70].encode("ascii", "replace").decode("ascii")
        print(f"{name[:28]:28} {c['from']:4} {c['to']:4} {d:+3} {c['fantasyScore']:5}  {reason}")
    if len(changes) > 60:
        print(f"... +{len(changes) - 60} more")
    print("\nWrote", OUT_BATCH)
    print("Wrote", OUT_REPORT)


if __name__ == "__main__":
    main()
