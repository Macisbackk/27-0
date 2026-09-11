"""Audit historic player achievement mappings for orphans, gaps, and inconsistencies."""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def load(name: str):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def main() -> None:
    hist = load("historic-players.json")
    leg = load("legends.json")
    cur = load("current-squads.json")
    players = hist + leg + cur
    by_id = {p["id"]: p for p in players}
    by_name = defaultdict(list)
    for p in players:
        by_name[str(p.get("name", "")).lower()].append(p)

    maps = {
        "mos": load("man-of-steel-winners.json"),
        "dream": load("dream-team-years.json"),
        "gb": load("golden-boot-years.json"),
        "lls": load("league-leaders-years.json"),
        "slc": load("super-league-champion-years.json"),
        "cc": load("challenge-cup-years.json"),
    }
    lt = set(load("lance-todd-winners.json"))

    report: dict = {
        "historicCards": len(hist),
        "legends": len(leg),
        "orphans": {},
        "coverage": {},
        "flagWithoutYears": {"superLeague": [], "challengeCup": []},
        "yearsWithoutFlag": {"superLeague": [], "challengeCup": []},
        "yearCardInheritanceGaps": [],
        "nameCollisionRisks": [],
        "unmatchedKnownWinnersInDb": {},
    }

    print(f"historic cards: {len(hist)} legends: {len(leg)}")

    for label, m in maps.items():
        orphans = [k for k in m if k not in by_id]
        report["orphans"][label] = orphans
        print(f"{label}: keys={len(m)} orphans={len(orphans)}")
        for k in orphans[:10]:
            print(f"  orphan {k}")

    lt_orph = sorted(i for i in lt if i not in by_id)
    report["orphans"]["lanceTodd"] = lt_orph
    print(f"lance-todd: keys={len(lt)} orphans={len(lt_orph)}")

    cov = Counter()
    for p in hist:
        pid = p["id"]
        if maps["mos"].get(pid):
            cov["mos"] += 1
        if pid in lt:
            cov["lt"] += 1
        if maps["dream"].get(pid):
            cov["dream"] += 1
        if maps["gb"].get(pid):
            cov["gb"] += 1
        if maps["lls"].get(pid):
            cov["lls"] += 1
        if maps["slc"].get(pid) or p.get("superLeagueWinner"):
            cov["sl"] += 1
        if maps["cc"].get(pid) or p.get("challengeCupWinner"):
            cov["cc"] += 1
        if (
            maps["mos"].get(pid)
            or pid in lt
            or maps["dream"].get(pid)
            or maps["gb"].get(pid)
            or maps["lls"].get(pid)
            or maps["slc"].get(pid)
            or p.get("superLeagueWinner")
            or maps["cc"].get(pid)
            or p.get("challengeCupWinner")
        ):
            cov["any"] += 1
    report["coverage"] = dict(cov)
    print("historic coverage", dict(cov))

    for p in hist:
        pid = p["id"]
        row = {
            "id": pid,
            "name": p.get("name"),
            "club": p.get("club"),
            "year": p.get("year") or p.get("cardYear"),
        }
        if p.get("superLeagueWinner") and not maps["slc"].get(pid):
            report["flagWithoutYears"]["superLeague"].append(row)
        if p.get("challengeCupWinner") and not maps["cc"].get(pid):
            report["flagWithoutYears"]["challengeCup"].append(row)
        if maps["slc"].get(pid) and not p.get("superLeagueWinner"):
            report["yearsWithoutFlag"]["superLeague"].append(
                {**row, "years": maps["slc"][pid]}
            )
        if maps["cc"].get(pid) and not p.get("challengeCupWinner"):
            report["yearsWithoutFlag"]["challengeCup"].append(
                {**row, "years": maps["cc"][pid]}
            )

    print(
        "SL flag no years",
        len(report["flagWithoutYears"]["superLeague"]),
        "CC flag no years",
        len(report["flagWithoutYears"]["challengeCup"]),
    )
    print(
        "SL years no flag",
        len(report["yearsWithoutFlag"]["superLeague"]),
        "CC years no flag",
        len(report["yearsWithoutFlag"]["challengeCup"]),
    )

    # Year-card base inheritance: base has honour, year card missing it
    year_suffix = re.compile(r"-\d{4}$")
    for p in hist:
        pid = p["id"]
        if not year_suffix.search(pid):
            continue
        base = p.get("basePlayerId") or year_suffix.sub("", pid)
        if base == pid or base not in by_id:
            continue
        gaps = []
        for label, m in maps.items():
            if m.get(base) and not m.get(pid):
                # Only flag if year-card year overlaps honour years on base
                y = p.get("year") or p.get("cardYear")
                years = m.get(base) or []
                if y is None or y in years:
                    gaps.append({"map": label, "baseYears": years, "cardYear": y})
        if base in lt and pid not in lt:
            gaps.append({"map": "lanceTodd", "baseYears": True, "cardYear": p.get("year")})
        if gaps:
            report["yearCardInheritanceGaps"].append(
                {
                    "id": pid,
                    "base": base,
                    "name": p.get("name"),
                    "gaps": gaps,
                }
            )

    print("year-card inheritance gaps", len(report["yearCardInheritanceGaps"]))

    # Known individual honour winners that should exist in DB
    known = {
        "lanceTodd": [
            "Robbie Paul",
            "Joe Lydon",
            "Dean Bell",
            "Brett Kenny",
            "Kevin Sinfield",
            "Rob Burrow",
            "Paul Wellens",
            "Sean Long",
            "Tommy Makinson",
            "Lachlan Lam",
        ],
        "manOfSteel": [
            "James Roby",
            "Jake Connor",
            "Bevan French",
            "Daryl Clark",
            "Sam Tomkins",
            "Ben Flower",
            "Jamie Peacock",
            "Paul Sculthorpe",
            "Andy Farrell",
            "Ellery Hanley",
        ],
    }

    # Resolve MoS map names
    mos_names = {by_id[i]["name"] for i in maps["mos"] if i in by_id}
    lt_names = {by_id[i]["name"] for i in lt if i in by_id}
    for name in known["lanceTodd"]:
        in_db = bool(by_name.get(name.lower()))
        has = name in lt_names
        if in_db and not has:
            report["unmatchedKnownWinnersInDb"].setdefault("lanceTodd", []).append(name)
    for name in known["manOfSteel"]:
        in_db = bool(by_name.get(name.lower()))
        has = name in mos_names
        if in_db and not has:
            report["unmatchedKnownWinnersInDb"].setdefault("manOfSteel", []).append(name)

    # Honour report unmatched lance still in DB?
    honour_report = DATA / "honour-achievements-report.json"
    if honour_report.exists():
        hr = json.loads(honour_report.read_text(encoding="utf-8"))
        still = []
        for name in hr.get("unmatchedLance", []):
            hits = by_name.get(name.lower(), [])
            if hits:
                still.append(
                    {
                        "name": name,
                        "ids": [p["id"] for p in hits],
                        "categories": sorted({p.get("category") for p in hits}),
                    }
                )
        report["unmatchedLanceStillInDb"] = still
        print("unmatched Lance Todd still in DB", len(still))

    # Dream team years outside career / year card year wildly wrong
    suspicious_dream = []
    for pid, years in maps["dream"].items():
        p = by_id.get(pid)
        if not p or p.get("category") not in ("historic", "legend", "current"):
            continue
        card_y = p.get("year") or p.get("cardYear")
        for y in years:
            if card_y and abs(int(card_y) - int(y)) > 25:
                suspicious_dream.append(
                    {
                        "id": pid,
                        "name": p.get("name"),
                        "cardYear": card_y,
                        "dreamYear": y,
                    }
                )
    report["suspiciousDreamYearDistance"] = suspicious_dream[:50]
    print("suspicious dream year distance sample", len(suspicious_dream))

    out = DATA / "historic-achievements-audit.json"
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("Wrote", out)

    # Print high-signal issues
    print("\n=== HIGH SIGNAL ===")
    print("Known LT missing:", report["unmatchedKnownWinnersInDb"].get("lanceTodd"))
    print("Known MoS missing:", report["unmatchedKnownWinnersInDb"].get("manOfSteel"))
    for row in report.get("unmatchedLanceStillInDb", [])[:20]:
        print("LT unmatched but in DB:", row)
    for row in report["flagWithoutYears"]["superLeague"][:20]:
        print("SL flag-only:", row)
    for row in report["flagWithoutYears"]["challengeCup"][:20]:
        print("CC flag-only:", row)
    for row in report["yearCardInheritanceGaps"][:25]:
        print("year-card gap:", row["name"], row["id"], "<-", row["base"], row["gaps"])


if __name__ == "__main__":
    main()
