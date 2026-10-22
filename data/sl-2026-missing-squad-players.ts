/**
 * Researched 2026 Super League squad players missing from current-squads.json.
 * Consumed by scripts/add-2026-missing-squad-players.ts.
 *
 * Rules: real players only, every row backed by a source URL, position from the
 * source. Unclear players go in UNVERIFIED instead of ADDITIONS.
 */
import type { Position } from "../src/lib/types";

const LRL_ALL_CLUBS =
  "https://www.loverugbyleague.com/post/2026-super-league-squad-numbers-by-club";

export type Addition = {
  club: string;
  name: string;
  /** Other spellings to treat as the same person when matching. */
  aliases?: string[];
  squadNumber?: number;
  position: Position;
  nationality: string;
  /** How nationality is known: "source" (stated) or an explicit inference note. */
  nationalityBasis: string;
  dateOfBirth?: string;
  birthYear?: number;
  yearsActive?: string;
  previousClubs?: string[];
  rating: number;
  /** squad-number list | mid-season signing | loan (parent club named in notes) */
  status: string;
  sources: string[];
  notes?: string;
};

export type Move = {
  name: string;
  fromId: string;
  toClub: string;
  reason: string;
  sources: string[];
};

export type Unverified = {
  club: string;
  name: string;
  squadNumber?: number;
  reason: string;
  sources: string[];
};

export type MoveNotApplied = {
  club: string;
  name: string;
  existingId: string;
  reason: string;
  sources: string[];
};

export const SQUAD_LIST_SOURCES: Record<string, string[]> = {
  "York Knights": [
    LRL_ALL_CLUBS,
    "https://www.loverugbyleague.com/post/york-knights-unveil-squad-numbers-with-seven-new-signings-in-starting-17",
    "https://rugbyleaguezone.com/york-knights-2026-squad-numbers-424266/",
    "https://en.wikipedia.org/wiki/2026_York_Knights_season",
  ],
};

const YORK_ENGLISH_ACADEMY =
  "inferred: came through English junior/academy pathway (source names English amateur/academy clubs); no other nationality recorded";

export const ADDITIONS: Addition[] = [
  // ── York Knights ──────────────────────────────────────────────────────────
  {
    club: "York Knights",
    name: "John Sagaga",
    squadNumber: 22,
    position: "PROP",
    nationality: "Australia",
    nationalityBasis: "source",
    dateOfBirth: "2003-06-10",
    previousClubs: ["Penrith Panthers"],
    rating: 80,
    status: "squad-number list",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.yorkrlfc.com/knights-squad-1/22",
      "https://www.loverugbyleague.com/post/york-sign-john-sagaga-ahead-of-2026",
    ],
    notes: "Club profile DOB 10/06/03; LRL (Nov 2025) called him a 21-year-old Australian prop.",
  },
  {
    club: "York Knights",
    name: "Jack Smith",
    squadNumber: 25,
    position: "WING",
    nationality: "England",
    nationalityBasis: YORK_ENGLISH_ACADEMY,
    dateOfBirth: "2005-04-29",
    previousClubs: ["Leeds Rhinos", "London Broncos"],
    rating: 80,
    status: "squad-number list",
    sources: [LRL_ALL_CLUBS, "https://www.yorkrlfc.com/knights-squad-1/25"],
    notes: "Ex-Featherstone Lions junior and Leeds Rhinos academy.",
  },
  {
    club: "York Knights",
    name: "Matty Foster",
    squadNumber: 27,
    position: "SECOND_ROW",
    nationality: "England",
    nationalityBasis: "source (born St Helens, England — Wikipedia)",
    dateOfBirth: "2001-06-25",
    yearsActive: "2020–Present",
    previousClubs: ["St Helens", "Salford Red Devils", "Oldham RLFC"],
    rating: 80,
    status: "squad-number list",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.yorkrlfc.com/knights-squad-1/27",
      "https://en.wikipedia.org/wiki/Matty_Foster",
    ],
  },
  {
    club: "York Knights",
    name: "Ryan Jackson",
    squadNumber: 28,
    position: "PROP",
    nationality: "Australia",
    nationalityBasis: "source (club profile: 'Australian forward')",
    dateOfBirth: "2004-01-16",
    previousClubs: ["Wynnum Manly Seagulls"],
    rating: 80,
    status: "squad-number list",
    sources: [LRL_ALL_CLUBS, "https://www.yorkrlfc.com/knights-squad-1/28"],
  },
  {
    club: "York Knights",
    name: "Will Roberts",
    squadNumber: 38,
    position: "SCRUM_HALF",
    nationality: "England",
    nationalityBasis: YORK_ENGLISH_ACADEMY,
    dateOfBirth: "2005-02-24",
    previousClubs: ["St Helens"],
    rating: 80,
    status: "squad-number list",
    sources: [LRL_ALL_CLUBS, "https://www.yorkrlfc.com/knights-squad-1/38"],
    notes: "Club profile: half-back, at St Helens from age 14.",
  },
  {
    club: "York Knights",
    name: "Taylor Pemberton",
    squadNumber: 40,
    position: "HOOKER",
    nationality: "England",
    nationalityBasis: YORK_ENGLISH_ACADEMY,
    dateOfBirth: "2003-04-17",
    previousClubs: ["St Helens"],
    rating: 80,
    status: "squad-number list",
    sources: [LRL_ALL_CLUBS, "https://www.yorkrlfc.com/knights-squad-1/40"],
  },
  {
    club: "York Knights",
    name: "Mitch Clark",
    squadNumber: 41,
    position: "PROP",
    nationality: "England",
    nationalityBasis: "source (born Pontefract, England — Wikipedia)",
    dateOfBirth: "1993-03-30",
    yearsActive: "2015–Present",
    previousClubs: ["Castleford Tigers", "Wigan Warriors", "Sheffield Eagles"],
    rating: 80,
    status: "squad-number list",
    sources: [
      LRL_ALL_CLUBS,
      "https://en.wikipedia.org/wiki/Mitch_Clark_(rugby_league)",
      "https://www.yorkrlfc.com/post/mitch-clark-becomes-a-knight",
    ],
    notes: "Spent part of 2026 on loan at Newcastle Thunder (Wikipedia).",
  },
  {
    club: "York Knights",
    name: "David Nofoaluma",
    squadNumber: 46,
    position: "WING",
    nationality: "Serbia",
    nationalityBasis: "source (Serbia international since 2024; York 2026 season page lists SRB)",
    dateOfBirth: "1993-11-28",
    yearsActive: "2013–Present",
    previousClubs: ["Wests Tigers", "Halifax Panthers"],
    rating: 81,
    status: "loan (Newcastle Thunder) — joined Feb 2026 after Halifax were liquidated",
    sources: [
      "https://en.wikipedia.org/wiki/David_Nofoaluma",
      "https://en.wikipedia.org/wiki/2026_York_Knights_season",
      "https://news.ssbcrack.com/york-knights-announce-21-player-squad-for-magic-weekend-clash-against-huddersfield-giants/",
    ],
  },
  {
    club: "York Knights",
    name: "King Vuniyayawa",
    position: "PROP",
    nationality: "Fiji",
    nationalityBasis: "source (Fiji international)",
    dateOfBirth: "1995-03-13",
    previousClubs: ["Featherstone Rovers", "Newcastle Thunder"],
    rating: 80,
    status: "loan (Newcastle Thunder) — 5 York appearances in 2026",
    sources: [
      "https://en.wikipedia.org/wiki/King_Vuniyayawa",
      "https://en.wikipedia.org/wiki/2026_York_Knights_season",
    ],
  },
  {
    club: "York Knights",
    name: "Cody Hunter",
    squadNumber: 37,
    position: "SCRUM_HALF",
    nationality: "Australia",
    nationalityBasis: "source (LRL: Australian half-back)",
    previousClubs: ["Sunshine Coast Falcons", "Newcastle Thunder"],
    rating: 80,
    status: "loan (Newcastle Thunder)",
    sources: [
      "https://news.ssbcrack.com/york-knights-announce-21-player-squad-for-magic-weekend-clash-against-huddersfield-giants/",
      "https://www.loverugbyleague.com/post/queensland-cup-star-cody-hunter-makes-championship-move-for-2026",
    ],
    notes: "No published date of birth found.",
  },
  {
    club: "York Knights",
    name: "Tom Inman",
    squadNumber: 48,
    position: "HOOKER",
    nationality: "England",
    nationalityBasis: "source (York 2026 season page lists ENG)",
    previousClubs: ["Warrington Wolves", "Halifax Panthers"],
    rating: 80,
    status: "loan (Newcastle Thunder) after Halifax were liquidated",
    sources: [
      "https://news.ssbcrack.com/york-knights-announce-21-player-squad-for-magic-weekend-clash-against-huddersfield-giants/",
      "https://en.wikipedia.org/wiki/2026_York_Knights_season",
      "https://www.yorkrlfc.com/post/inman-signs-permanent-deal-to-end-of-season",
    ],
    notes: "No published date of birth found.",
  },
];

export const MOVES: Move[] = [
  {
    name: "Danny Richardson",
    fromId: "hull-kr-cur-danny-richardson",
    toClub: "York Knights",
    reason:
      "Permanent move from Hull KR to York for 2026 (York squad number 19); loaned to Widnes from June 2026.",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.loverugbyleague.com/post/danny-richardsons-first-words-as-permanent-york-move-confirmed",
      "https://en.wikipedia.org/wiki/2026_York_Knights_season",
    ],
  },
];

export const NOT_APPLIED_MOVES: MoveNotApplied[] = [
  {
    club: "Huddersfield Giants",
    name: "Matty English",
    existingId: "huddersfield-cur-matty-english",
    reason:
      "Left Huddersfield for York on 29 July 2026 for the rest of the season. Kept at Huddersfield (his club for most of 2026 and part of their 16-man 2026 Classic pool, which cannot drop below 16).",
    sources: [
      "https://www.giantsrl.com/article/10027/english-departs",
      "https://en.wikipedia.org/wiki/2026_York_Knights_season",
    ],
  },
];

export const UNVERIFIED: Unverified[] = [
  {
    club: "York Knights",
    name: "Myles Harrison",
    reason:
      "Listed as a loan from Newcastle Thunder on the York 2026 season page, but no York appearance, squad number or position found.",
    sources: ["https://en.wikipedia.org/wiki/2026_York_Knights_season"],
  },
  {
    club: "York Knights",
    name: "Thomas Doyle",
    reason:
      "York 2026 season page lists a Thomas Doyle signing from Castleford (August, two-year deal); could not confirm identity/position or whether this is Wakefield's Tommy Doyle.",
    sources: ["https://en.wikipedia.org/wiki/2026_York_Knights_season"],
  },
  {
    club: "York Knights",
    name: "Harvey Reynolds",
    reason: "Mentioned as injured in a York squad article; no squad number, position or contract source found.",
    sources: [
      "https://news.ssbcrack.com/york-knights-announce-21-player-squad-for-magic-weekend-clash-against-huddersfield-giants/",
    ],
  },
];
