import json
from collections import Counter, defaultdict

a = json.load(open("data/player-database-unknown-audit.json", encoding="utf-8"))
cur = json.load(open("data/current-squads.json", encoding="utf-8"))
hist = json.load(open("data/historic-players.json", encoding="utf-8"))
leg = json.load(open("data/legends.json", encoding="utf-8"))
by_id = {p["id"]: p for p in cur + hist + leg}
SL = set(json.load(open("data/sl-2026-registered-squads.json")))

rows = []
for i in a["issues"]:
    p = by_id.get(i["id"], {})
    club = p.get("club") or p.get("displayClub") or ""
    avail = p.get("availableInGame")
    if i["file"] == "current-squads.json" and avail is not False and club in SL:
        pool = "current-sl-playable"
    elif i["file"] == "current-squads.json":
        pool = "current-hidden"
    elif i["file"] == "historic-players.json":
        pool = "historic"
    else:
        pool = "legends"
    rows.append(
        {
            "id": i["id"],
            "name": i["name"],
            "file": i["file"],
            "field": i["field"],
            "value": i["value"],
            "club": club,
            "category": p.get("category"),
            "availableInGame": avail,
            "pool": pool,
        }
    )

for p in cur:
    if str(p.get("nationality", "")).lower() != "unknown":
        continue
    if any(r["id"] == p["id"] and r["field"] == "nationality" for r in rows):
        continue
    club = p.get("club") or ""
    rows.append(
        {
            "id": p["id"],
            "name": p["name"],
            "file": "current-squads.json",
            "field": "nationality",
            "value": p.get("nationality"),
            "club": club,
            "category": p.get("category"),
            "availableInGame": p.get("availableInGame"),
            "pool": "current-hidden"
            if p.get("availableInGame") is False
            else "current-other",
        }
    )

by_player: dict[str, set[str]] = defaultdict(set)
for r in rows:
    by_player[r["id"]].add(r["field"])

listing = []
for pid, fields in by_player.items():
    p = by_id.get(pid, {})
    club = p.get("club") or ""
    if pid in {x["id"] for x in cur}:
        pool = (
            "current-sl-playable"
            if p.get("availableInGame") is not False and club in SL
            else "current-hidden"
        )
    else:
        pool = "historic"
    listing.append(
        {
            "id": pid,
            "name": p.get("name") or pid,
            "club": club,
            "pool": pool,
            "unknownFields": sorted(fields),
        }
    )

listing.sort(key=lambda r: (r["pool"], r["name"], r["id"]))

bank = {
    "generatedAt": a.get("generatedAt"),
    "summary": {
        "totalUnknownFieldHits": len(rows),
        "uniquePlayers": len(listing),
        "byField": dict(Counter(r["field"] for r in rows)),
        "byPool": dict(Counter(r["pool"] for r in listing)),
    },
    "uniquePlayerList": listing,
    "fieldHits": sorted(
        rows, key=lambda r: (r["pool"], r["field"], r["name"], r["id"])
    ),
}

out = "data/unknown-player-data-bank.json"
with open(out, "w", encoding="utf-8") as f:
    json.dump(bank, f, indent=2, ensure_ascii=False)
    f.write("\n")

txt = "data/unknown-player-data-bank.txt"
with open(txt, "w", encoding="utf-8") as f:
    f.write("UNKNOWN PLAYER DATA BANK\n")
    f.write(f"Generated: {bank['generatedAt']}\n")
    f.write(f"Unique players: {bank['summary']['uniquePlayers']}\n")
    f.write(f"Field hits: {bank['summary']['totalUnknownFieldHits']}\n")
    f.write(f"By field: {bank['summary']['byField']}\n")
    f.write(f"By pool: {bank['summary']['byPool']}\n\n")

    f.write("=== CURRENT SL PLAYABLE ===\n")
    cur_sl = [r for r in listing if r["pool"] == "current-sl-playable"]
    if not cur_sl:
        f.write("(none)\n")
    for r in cur_sl:
        f.write(
            f"{r['name']} | {r['club']} | {', '.join(r['unknownFields'])} | {r['id']}\n"
        )

    f.write("\n=== CURRENT HIDDEN ===\n")
    for r in listing:
        if r["pool"] != "current-hidden":
            continue
        f.write(
            f"{r['name']} | {r['club']} | {', '.join(r['unknownFields'])} | {r['id']}\n"
        )

    f.write("\n=== HISTORIC (Unknown nationality) ===\n")
    for r in listing:
        if r["pool"] != "historic":
            continue
        f.write(f"{r['name']} | {r['club']} | {r['id']}\n")

print("BANKED", out)
print("TEXT", txt)
print("summary", bank["summary"])
print("\n=== CURRENT SL PLAYABLE ===")
for r in listing:
    if r["pool"] == "current-sl-playable":
        print(
            r["name"],
            "|",
            r["club"],
            "|",
            ", ".join(r["unknownFields"]),
            "|",
            r["id"],
        )
print("\n=== CURRENT HIDDEN ===")
for r in listing:
    if r["pool"] == "current-hidden":
        print(
            r["name"],
            "|",
            r["club"],
            "|",
            ", ".join(r["unknownFields"]),
            "|",
            r["id"],
        )
hist_n = sum(1 for r in listing if r["pool"] == "historic")
print("\n=== HISTORIC count:", hist_n, "===")
for r in listing:
    if r["pool"] == "historic":
        print(r["name"], "|", r["club"], "|", r["id"])
