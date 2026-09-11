"""Apply user-supplied nationalities to Unknown players by exact name match."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

# Exact name → nationality (user-verified)
NATS: dict[str, str] = {
    "Aaron Smith": "England",
    "Adam Maher": "England",
    "Adrian Belle": "England",
    "Alex Gerrard": "England",
    "Alex Wilkinson": "England",
    "Andrew Brocklehurst": "England",
    "Andrew Dixon": "England",
    "Andrew Schick": "England",
    "Andy Cheetham": "England",
    "Andy Fisher": "England",
    "Andy Hay": "England",
    "Andy Hodgson": "England",
    "Andy Ireland": "England",
    "Andy Northey": "England",
    "Andy Smith": "England",
    "Anthony England": "England",
    "Anthony Stewart": "England",
    "Barry Ward": "England",
    "Ben Cooper": "England",
    "Ben Davies": "England",
    "Ben Sammut": "Malta",
    "Bobbie Goulding": "England",
    "Bobby Thompson": "England",
    "Brad Davis": "England",
    "Bradley O'Neill": "England",
    "Brandon Costin": "Australia",
    "Bureta Faraimo": "USA",
    "Chris Giles": "England",
    "Chris Ryan": "England",
    "Craig Makin": "England",
    "Craig Poucher": "England",
    "Craig Randall": "England",
    "Craig Smith": "England",
    "Craig Wilson": "England",
    "Dale Cardoza": "England",
    "Dan Norman": "England",
    "Dan Potter": "England",
    "Danny Russell": "England",
    "Darren Abram": "England",
    "Darren Brown": "England",
    "Darren Fleary": "England",
    "Darren Smith": "England",
    "Darren Turner": "England",
    "Darryl Cardiss": "England",
    "Dave Bradbury": "England",
    "Dave Watson": "New Zealand",
    "David Atkins": "England",
    "David Baildon": "England",
    "David Berthezene": "France",
    "David Boyle": "England",
    "David Chapman": "England",
    "David Fa'alogo": "New Zealand",
    "David Hulme": "England",
    "David King": "England",
    "David March": "England",
    "David Stephenson": "England",
    "David Wrench": "England",
    "Dean Hanger": "England",
    "Dean Sampson": "England",
    "Dec Patton": "England",
    "Ellis Robson": "England",
    "Fereti Tuilagi": "Samoa",
    "Fili Seru": "Fiji",
    "Francis Cummins": "England",
    "Francis Maloney": "England",
    "Frank Watene": "Tonga",
    "Gael Tallec": "France",
    "Gareth Owen": "England",
    "Gary Chambers": "England",
    "Gary Lester": "England",
    "Gary Lord": "England",
    "Gary Price": "England",
    "George Mann": "New Zealand",
    "Graham Steadman": "England",
    "Greg Fleming": "England",
    "Howard Hill": "England",
    "Ian Tonks": "England",
    "Jacob Jones": "England",
    "James Cunningham": "England",
    "James Lowes": "England",
    "Jamie Smith": "England",
    "Jason Roach": "England",
    "Jason Sands": "England",
    "Jeff Hardy": "England",
    "Jim Leatham": "England",
    "Jimmy Smith": "England",
    "Joe Berry": "England",
    "Joe Faimalo": "Samoa",
    "Joey Hayes": "England",
    "John Clarke": "England",
    "John Duffy": "England",
    "John Wilson": "England",
    "Jon Molloy": "England",
    "Jonathan Scales": "England",
    "Jordan Cox": "England",
    "Josh White": "England",
    "Kai Morgan": "England",
    "Kevin Iro": "New Zealand",
    "Lee Greenwood": "England",
    "Lee Jackson": "England",
    "Leroy Rivett": "England",
    "Logan Campbell": "England",
    "Lokeni Savelio": "Tonga",
    "Marcus Vassilakopoulos": "England",
    "Mark Field": "England",
    "Mark Forster": "England",
    "Mark Hilton": "England",
    "Mark Johnson": "England",
    "Mark Lee": "England",
    "Mark Moxon": "England",
    "Mark Smith": "England",
    "Martin Crompton": "England",
    "Martin Wood": "England",
    "Matt Gardner": "England",
    "Matt Schultz": "England",
    "Matt Sturm": "England",
    "Matthew Whitaker": "England",
    "Michael Jackson": "England",
    "Mike Ford": "England",
    "Mike Forshaw": "England",
    "Mitch Stringer": "England",
    "Muizz Mustapha": "England",
    "Nathan Connell": "England",
    "Nathan Wood": "England",
    "Neil Baynes": "England",
    "Neil Harmon": "England",
    "Neil Law": "England",
    "Paul Carr": "England",
    "Paul Davidson": "England",
    "Paul Devlin": "England",
    "Paul Forber": "England",
    "Paul Loughlin": "England",
    "Paul March": "England",
    "Paul Noone": "England",
    "Paul Parker": "England",
    "Paul Rowley": "England",
    "Paul Smith": "England",
    "Paul Topping": "England",
    "Paul White": "England",
    "Peter Gill": "England",
    "Phil Cantillon": "England",
    "Phil Hassan": "England",
    "Richard Fletcher": "England",
    "Richard Gay": "England",
    "Richard Marshall": "England",
    "Richard Mckell": "England",
    "Richard Moore": "England",
    "Richard Russell": "England",
    "Richie Barnett": "England",
    "Richie Blackmore": "New Zealand",
    "Richie Mathers": "England",
    "Rob Nolan": "England",
    "Robert Butler": "England",
    "Robert Relf": "England",
    "Ryan Clayton": "England",
    "Ryan Sheridan": "England",
    "Sam Davis": "England",
    "Scott Martin": "England",
    "Scott Naylor": "England",
    "Scott Wilson": "England",
    "Sean Hoppe": "New Zealand",
    "Sean Richardson": "England",
    "Sean Rutgerson": "England",
    "Sean Ryan": "England",
    "Simon Booth": "England",
    "Simon Haughton": "England",
    "Solomon Haumono": "New Zealand",
    "Stephen Holgate": "England",
    "Stephen Nash": "England",
    "Steve Barrow": "England",
    "Steve Collins": "England",
    "Steve Craven": "England",
    "Steve Hall": "England",
    "Steve Mccurrie": "England",
    "Steve Molloy": "England",
    "Tawera Nikau": "New Zealand",
    "Tom Holmes": "England",
    "Tommy Haughey": "England",
    "Tony Kemp": "New Zealand",
    "Tony Smith": "England",
    "Warren Stevens": "England",
    "Wayne Mcdonald": "New Zealand",
    "Whetu Taewa": "New Zealand",
    "Will Robinson": "England",
    "Willie Poching": "New Zealand",
}

FILES = [
    DATA / "historic-players.json",
    DATA / "current-squads.json",
    DATA / "legends.json",
]


def apply(path: Path) -> tuple[int, list[str]]:
    players = json.loads(path.read_text(encoding="utf-8"))
    updated = 0
    misses: list[str] = []
    for p in players:
        if str(p.get("nationality", "")).lower() != "unknown":
            continue
        name = p.get("name")
        nat = NATS.get(name)
        if not nat:
            misses.append(f"{name} ({p.get('id')})")
            continue
        p["nationality"] = nat
        updated += 1
    path.write_text(json.dumps(players, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return updated, misses


def main() -> None:
    total = 0
    all_misses: list[str] = []
    for path in FILES:
        if not path.exists():
            continue
        n, misses = apply(path)
        total += n
        all_misses.extend(misses)
        print(f"{path.name}: updated {n}")
    unused = sorted(set(NATS) - {
        p["name"]
        for path in FILES
        if path.exists()
        for p in json.loads(path.read_text(encoding="utf-8"))
    })
    print(f"Total cards updated: {total}")
    if all_misses:
        print(f"Still Unknown (no mapping): {len(all_misses)}")
        for m in all_misses[:30]:
            print(" ", m)
    if unused:
        print(f"Mapped names with no Unknown cards: {len(unused)}")


if __name__ == "__main__":
    main()
