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
/** Official Super League Fantasy player list (positions); snapshot in data/imports/fantasy-super-league-players-2026.md. */
const SL_FANTASY = "https://fantasy.superleague.co.uk/";

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
  "Huddersfield Giants": [
    LRL_ALL_CLUBS,
    "https://www.alloutrugbyleague.co.uk/news/huddersfield-giants-2026-squad-numbers-1520629",
    "https://rugbyleaguezone.com/2026-super-league-new-faces-new-roles-as-huddersfield-reveal-squad-numbers-423156/",
  ],
  "Hull FC": [
    LRL_ALL_CLUBS,
    "https://www.hullfc.com/blog/2025/11/29/hull-fc-confirm-2026-squad-numbers/",
  ],
  "Hull KR": [
    LRL_ALL_CLUBS,
    "https://www.loverugbyleague.com/post/hull-kr-confirm-2026-squad-numbers-as-new-recruit-handed-key-jersey",
  ],
  "Bradford Bulls": [LRL_ALL_CLUBS, "https://www.loverugbyleague.com/post/bradford-bulls-2026-squad-numbers"],
  "Catalans Dragons": [LRL_ALL_CLUBS],
  "Leeds Rhinos": [LRL_ALL_CLUBS],
  "Leigh Leopards": [LRL_ALL_CLUBS, "https://leighleopards.co.uk/2026-squad-numbers-revealed/"],
  "St Helens": [LRL_ALL_CLUBS, "https://www.saintsrlfc.com/?p=98971"],
  "Toulouse Olympique": [LRL_ALL_CLUBS, "https://www.loverugbyleague.com/post/toulouse-olympique-2026-squad-numbers"],
  "Castleford Tigers": [
    LRL_ALL_CLUBS,
    "https://www.alloutrugbyleague.co.uk/news/castleford-tigers-confirm-full-squad-1584671",
    "https://en.wikipedia.org/wiki/2026_Castleford_Tigers_season",
  ],
  "Wakefield Trinity": [
    LRL_ALL_CLUBS,
    "https://www.loverugbyleague.com/post/wakefield-trinity-2026-super-league-squad-numbers",
  ],
  "Wigan Warriors": [
    LRL_ALL_CLUBS,
    "https://www.wigantoday.net/sport/rugby-league/wigan-warriors-confirm-2026-squad-numbers-as-homegrown-talent-earns-starting-shirt-5462728",
  ],
  "Warrington Wolves": [
    LRL_ALL_CLUBS,
    "https://www.alloutrugbyleague.co.uk/news/warrington-wolves-squad-unpicked-new-1508041",
  ],
};

const ENGLISH_ACADEMY =
  "inferred: came through an English junior/academy pathway (source names English amateur/academy clubs); no other nationality recorded";
const YORK_ENGLISH_ACADEMY = ENGLISH_ACADEMY;

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

  // ── Huddersfield Giants ───────────────────────────────────────────────────
  {
    club: "Huddersfield Giants",
    name: "Jacob Algar",
    squadNumber: 25,
    position: "PROP",
    nationality: "England",
    nationalityBasis: ENGLISH_ACADEMY,
    rating: 80,
    status: "squad-number list (academy graduate)",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.alloutrugbyleague.co.uk/news/huddersfield-giants-2026-squad-numbers-1520629",
      "https://giantsrl.com/article/9909/promising-youngster-signs-new-deal",
    ],
    notes: "Club: 'primarily a prop or back-rower', came through the Giants pathway; new three-year deal June 2026.",
  },
  {
    club: "Huddersfield Giants",
    name: "Marshall Land",
    squadNumber: 27,
    position: "SCRUM_HALF",
    nationality: "England",
    nationalityBasis: ENGLISH_ACADEMY,
    rating: 80,
    status: "squad-number list (academy)",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.alloutrugbyleague.co.uk/news/huddersfield-giants-2026-squad-numbers-1520629",
      "https://giantsrl.com/article/9934/promising-half-back-signs-extension",
    ],
    notes: "Club: half-back, two-year extension June 2026.",
  },

  // ── Hull FC ───────────────────────────────────────────────────────────────
  {
    club: "Hull FC",
    name: "Callum Kemp",
    squadNumber: 27,
    position: "SCRUM_HALF",
    nationality: "England",
    nationalityBasis: "source (club profile: born Hull, England)",
    dateOfBirth: "2006-09-18",
    yearsActive: "2024–Present",
    rating: 80,
    status: "squad-number list (academy)",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.hullfc.com/blog/2025/11/29/hull-fc-confirm-2026-squad-numbers/",
      "https://www.hullfc.com/team/first-team/callum-kemp",
    ],
  },
  {
    club: "Hull FC",
    name: "Joe Phillips",
    squadNumber: 28,
    position: "PROP",
    nationality: "England",
    nationalityBasis: ENGLISH_ACADEMY,
    previousClubs: ["Leeds Rhinos", "Goole Vikings"],
    rating: 80,
    status: "squad-number list",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.hullfc.com/blog/2025/11/29/hull-fc-confirm-2026-squad-numbers/",
      "https://www.alloutrugbyleague.co.uk/news/who-joe-phillips-meet-hull-1379871",
      "https://holderness-gazette.co.uk/new-signings-bolster-airlie-birds-squad/",
    ],
    notes: "Front-row forward; Siddal junior, Leeds Rhinos academy, Goole Vikings 2025. No published DOB.",
  },
  {
    club: "Hull FC",
    name: "Will Hutchinson",
    squadNumber: 29,
    position: "HOOKER",
    nationality: "England",
    nationalityBasis: "source (club profile: born Hull, England)",
    dateOfBirth: "2006-08-05",
    yearsActive: "2025–Present",
    rating: 80,
    status: "squad-number list (academy)",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.hullfc.com/blog/2025/11/29/hull-fc-confirm-2026-squad-numbers/",
      "https://www.hullfc.com/team/first-team/will-hutchinson",
    ],
  },
  {
    club: "Hull FC",
    name: "Will Kirby",
    squadNumber: 30,
    position: "SECOND_ROW",
    nationality: "England",
    nationalityBasis: ENGLISH_ACADEMY,
    dateOfBirth: "2006-02-22",
    yearsActive: "2024–Present",
    rating: 80,
    status: "squad-number list (academy)",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.hullfc.com/blog/2025/11/29/hull-fc-confirm-2026-squad-numbers/",
      "https://www.loverugbyleague.com/post/nextgen-hull-fc-will-kirby-super-league",
    ],
    notes: "Back-rower, Hull Wyke junior; Super League debut July 2024.",
  },
  {
    club: "Hull FC",
    name: "Lloyd Kemp",
    squadNumber: 32,
    position: "FULLBACK",
    nationality: "England",
    nationalityBasis: "source (club profile: born Hull, England)",
    dateOfBirth: "2006-09-18",
    yearsActive: "2025–Present",
    rating: 80,
    status: "squad-number list (academy)",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.hullfc.com/blog/2025/11/29/hull-fc-confirm-2026-squad-numbers/",
      "https://www.hullfc.com/team/first-team/lloyd-kemp",
    ],
    notes: "Club profile: fullback (Wikipedia list of Hull FC players: stand-off).",
  },
  {
    club: "Hull FC",
    name: "Joe Ward",
    squadNumber: 34,
    position: "WING",
    nationality: "England",
    nationalityBasis: "source (club profile: born Leeds, England)",
    dateOfBirth: "2005-12-12",
    rating: 80,
    status: "squad-number list (academy)",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.hullfc.com/blog/2025/11/29/hull-fc-confirm-2026-squad-numbers/",
      "https://www.hullfc.com/team/first-team/joe-ward",
    ],
  },
  {
    club: "Hull FC",
    name: "Ben Johnson",
    squadNumber: 35,
    position: "CENTRE",
    nationality: "England",
    nationalityBasis: "source (club profile: born Hull, England)",
    dateOfBirth: "2006-04-24",
    rating: 80,
    status: "squad-number list (academy); Super League debut May 2026",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.hullfc.com/blog/2025/11/29/hull-fc-confirm-2026-squad-numbers/",
      "https://www.hullfc.com/team/first-team/ben-johnson",
      "https://www.loverugbyleague.com/post/hull-fc-loan-19-06-2026",
    ],
  },

  // ── Hull KR ───────────────────────────────────────────────────────────────
  {
    club: "Hull KR",
    name: "Ryan Westerman",
    position: "CENTRE",
    nationality: "England",
    nationalityBasis: "source (England Academy international)",
    dateOfBirth: "2006-01-15",
    previousClubs: ["Hull FC"],
    rating: 80,
    status: "mid-season signing from Hull FC (2 June 2026); Hull FC squad number 31 at the start of 2026",
    sources: [
      "https://hullkr.co.uk/news/hull-kr-sign-young-outside-back-westerman",
      LRL_ALL_CLUBS,
      "https://www.rugby-league.com/article/62879/england-academy-call-up-for-hull-fc-centre--",
    ],
  },
  {
    club: "Hull KR",
    name: "Tom Whitehead",
    squadNumber: 29,
    position: "SECOND_ROW",
    nationality: "England",
    nationalityBasis: "source (born Oldham, England — LRL)",
    birthYear: 2002,
    previousClubs: ["Warrington Wolves"],
    rating: 80,
    status: "squad-number list",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.loverugbyleague.com/post/hull-kr-confirm-2026-squad-numbers-as-new-recruit-handed-key-jersey",
      "https://www.loverugbyleague.com/post/hull-kr-sign-tom-whitehead-ahead-of-2026",
    ],
    notes: "Back-rower; turned 23 in early November 2025 (born November 2002).",
  },
  {
    club: "Hull KR",
    name: "Cobie Wainhouse",
    squadNumber: 30,
    position: "PROP",
    nationality: "England",
    nationalityBasis: ENGLISH_ACADEMY,
    previousClubs: ["Hull FC"],
    rating: 80,
    status: "squad-number list",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.loverugbyleague.com/post/hull-kr-confirm-2026-squad-numbers-as-new-recruit-handed-key-jersey",
      "https://hullkr.co.uk/news/cobie-wainhouse-signs-with-the-robins",
    ],
    notes: "'Young front-rower' from the Bradford Bulls academy and Hull FC; no published DOB.",
  },
  {
    club: "Hull KR",
    name: "Declan Murphy",
    squadNumber: 31,
    position: "FULLBACK",
    nationality: "England",
    nationalityBasis: "source (club bio: born Wigan, England)",
    dateOfBirth: "2004-10-15",
    yearsActive: "2025–Present",
    previousClubs: ["Salford Red Devils"],
    rating: 80,
    status: "squad-number list",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.loverugbyleague.com/post/hull-kr-confirm-2026-squad-numbers-as-new-recruit-handed-key-jersey",
      "https://hullkr.co.uk/news/declan-murphy-signs-three-year-deal-with-hull-kr",
    ],
  },
  {
    club: "Hull KR",
    name: "Jumah Sambou",
    squadNumber: 32,
    position: "WING",
    nationality: "England",
    nationalityBasis: "source (born Warrington, England — Wikipedia)",
    dateOfBirth: "2001-11-21",
    yearsActive: "2022–Present",
    previousClubs: ["St Helens", "Oldham RLFC"],
    rating: 80,
    status: "squad-number list; season-long loan to Widnes Vikings in 2026",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.loverugbyleague.com/post/hull-kr-confirm-2026-squad-numbers-as-new-recruit-handed-key-jersey",
      "https://en.wikipedia.org/wiki/Jumah_Sambou",
    ],
  },
  {
    club: "Hull KR",
    name: "Frankie Dearlove",
    squadNumber: 33,
    position: "SECOND_ROW",
    nationality: "England",
    nationalityBasis: "source (club bio: born Kingston upon Hull)",
    dateOfBirth: "2007-04-20",
    rating: 80,
    status: "squad-number list (academy graduate)",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.loverugbyleague.com/post/hull-kr-confirm-2026-squad-numbers-as-new-recruit-handed-key-jersey",
      "https://hullkr.co.uk/news/academy-product-frankie-dearlove-signs-a-two-year-deal-at-hull-kr",
    ],
  },

  // ── Warrington Wolves ─────────────────────────────────────────────────────
  {
    club: "Warrington Wolves",
    name: "Zack Gardner",
    squadNumber: 29,
    position: "CENTRE",
    nationality: "England",
    nationalityBasis: ENGLISH_ACADEMY,
    birthYear: 2006,
    yearsActive: "2025–Present",
    rating: 80,
    status: "squad-number list",
    sources: [
      LRL_ALL_CLUBS,
      "https://en.wikipedia.org/wiki/List_of_Warrington_Wolves_players",
      "https://www.loverugbyleague.com/post/zack-gardner-injury-15-06-2026",
    ],
    notes: "Centre (heritage no. 1216, debut May 2025); turned 20 in April 2026; out for the season after shoulder surgery (June 2026).",
  },
  {
    club: "Warrington Wolves",
    name: "Tom McKinney",
    squadNumber: 30,
    position: "PROP",
    nationality: "England",
    nationalityBasis: "inferred: Cumbrian, Hensingham junior (club profile)",
    dateOfBirth: "2006-08-14",
    yearsActive: "2025–Present",
    rating: 80,
    status: "squad-number list",
    sources: [
      LRL_ALL_CLUBS,
      "https://warringtonwolves.com/players/70550",
      "https://www.loverugbyleague.com/post/tom-mckinney-oldham-loan-19-03-2026",
    ],
  },
  {
    club: "Warrington Wolves",
    name: "Ben Hartill",
    squadNumber: 31,
    position: "HOOKER",
    nationality: "England",
    nationalityBasis: ENGLISH_ACADEMY,
    birthYear: 2005,
    rating: 80,
    status: "squad-number list",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.loverugbyleague.com/post/sam-powell-hip-drop-ban-reaction-07-07-2026",
    ],
    notes: "Young Warrington-produced hooker; turns 21 in August 2026 (born August 2005).",
  },

  // ── Wigan Warriors ────────────────────────────────────────────────────────
  {
    club: "Wigan Warriors",
    name: "Abbas Miski",
    squadNumber: 16,
    position: "WING",
    nationality: "Lebanon",
    nationalityBasis: "source (Lebanon international — Wikipedia; born Penrith, Australia)",
    dateOfBirth: "1995-07-25",
    rating: 81,
    status:
      "squad-number list; injured at the start of 2026 and taken out of first-team contention in May 2026 for salary-cap reasons",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.wigantoday.net/sport/rugby-league/wigan-warriors-confirm-2026-squad-numbers-as-homegrown-talent-earns-starting-shirt-5462728",
      "https://en.wikipedia.org/wiki/Abbas_Miski",
      "https://www.loverugbyleague.com/post/abbas-miskis-next-possible-club-after-shock-wigan-exit-confirmed",
    ],
    notes: "Historic Wigan cards keep their own data; this Current card uses the sourced Lebanon nationality.",
  },
  {
    club: "Wigan Warriors",
    name: "Harvey Makin",
    squadNumber: 24,
    position: "PROP",
    nationality: "England",
    nationalityBasis: "source (born Wigan, England — Wikipedia)",
    dateOfBirth: "2003-11-17",
    yearsActive: "2023–Present",
    rating: 80,
    status: "squad-number list; loans at Oldham and Barrow in 2026",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.wigantoday.net/sport/rugby-league/wigan-warriors-confirm-2026-squad-numbers-as-homegrown-talent-earns-starting-shirt-5462728",
      "https://en.wikipedia.org/wiki/Harvey_Makin",
    ],
  },
  {
    club: "Wigan Warriors",
    name: "Lukas Mason",
    squadNumber: 27,
    position: "SECOND_ROW",
    nationality: "England",
    nationalityBasis: "source (born St Helens, England — Wikipedia)",
    dateOfBirth: "2005-12-22",
    yearsActive: "2025–Present",
    rating: 80,
    status: "squad-number list; Championship loans in 2026",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.wigantoday.net/sport/rugby-league/wigan-warriors-confirm-2026-squad-numbers-as-homegrown-talent-earns-starting-shirt-5462728",
      "https://en.wikipedia.org/wiki/Lukas_Mason",
    ],
  },
  {
    club: "Wigan Warriors",
    name: "Jonny Vaughan",
    squadNumber: 31,
    position: "SECOND_ROW",
    nationality: "England",
    nationalityBasis: "source (born St Helens, England — Wikipedia)",
    dateOfBirth: "2005-02-12",
    yearsActive: "2024–Present",
    previousClubs: ["St Helens"],
    rating: 80,
    status: "squad-number list; Championship loans in 2026",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.wigantoday.net/sport/rugby-league/wigan-warriors-confirm-2026-squad-numbers-as-homegrown-talent-earns-starting-shirt-5462728",
      "https://en.wikipedia.org/wiki/Jonny_Vaughan",
    ],
    notes:
      "Back-rower (Wigan Today). data/player-rating-overrides.ts already held an override for this id (75), which applies at runtime.",
  },
  {
    club: "Wigan Warriors",
    name: "George O'Loughlin",
    squadNumber: 33,
    position: "SECOND_ROW",
    nationality: "England",
    nationalityBasis: ENGLISH_ACADEMY,
    rating: 80,
    status: "squad-number list (academy graduate)",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.wigantoday.net/sport/rugby-league/matt-peet-offers-insight-into-wigan-warriors-homegrown-duo-after-first-team-promotion-5500871",
    ],
    notes: "Back-row or centre, aged 19 in February 2026; Orrell St James and Wigan St Judes junior; son of Sean O'Loughlin.",
  },
  {
    club: "Wigan Warriors",
    name: "Finlay Yeomans",
    squadNumber: 34,
    position: "CENTRE",
    nationality: "England",
    nationalityBasis: ENGLISH_ACADEMY,
    rating: 80,
    status: "squad-number list (academy graduate)",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.wigantoday.net/sport/rugby-league/matt-peet-offers-insight-into-wigan-warriors-homegrown-duo-after-first-team-promotion-5500871",
    ],
    notes: "Natural centre, aged 18 in February 2026; Woolston Rovers junior.",
  },
  {
    club: "Wigan Warriors",
    name: "Finn McMillan",
    squadNumber: 35,
    position: "PROP",
    nationality: "England",
    nationalityBasis: ENGLISH_ACADEMY,
    previousClubs: ["Barrow Raiders"],
    rating: 80,
    status: "squad-number list; stays at Barrow Raiders while training full-time with Wigan",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.loverugbyleague.com/post/wigan-warriors-land-surprises-transfer-deal-for-barrow-raiders-prop",
    ],
    notes: "Furness Raiders junior; no published DOB.",
  },

  // ── Castleford Tigers ─────────────────────────────────────────────────────
  {
    club: "Castleford Tigers",
    name: "Aiden Doolan",
    squadNumber: 20,
    position: "HOOKER",
    nationality: "England",
    nationalityBasis: "source (club: 'Englishman')",
    previousClubs: ["South Sydney Rabbitohs", "Barrow Raiders"],
    rating: 80,
    status: "squad-number list; Championship loans (Barrow, Hunslet, Widnes) in 2026",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.alloutrugbyleague.co.uk/news/castleford-tigers-confirm-full-squad-1584671",
      "https://castlefordtigers.com/article/85/tigers-sign-aiden-doolan-on-a-two-year-deal",
      "https://en.wikipedia.org/wiki/2026_Castleford_Tigers_season",
    ],
    notes: "Aged 22 at signing (November 2025); no published DOB.",
  },
  {
    club: "Castleford Tigers",
    name: "Alfie Lindsey",
    squadNumber: 26,
    position: "WING",
    nationality: "England",
    nationalityBasis: ENGLISH_ACADEMY,
    yearsActive: "2025–Present",
    rating: 80,
    status: "squad-number list; Championship loans (Halifax, Widnes) in 2026",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.alloutrugbyleague.co.uk/news/castleford-tigers-confirm-full-squad-1584671",
      "https://widnesvikings.co.uk/?p=38298",
      "https://castlefordtigers.com/article/46/dragons-38---tigers-4",
    ],
    notes: "Outside-back aged 19 (Widnes, Aug 2026); debuted on the wing (No. 2 slot) v Catalans, August 2025.",
  },
  {
    club: "Castleford Tigers",
    name: "George Hill",
    squadNumber: 28,
    position: "LOOSE_FORWARD",
    nationality: "England",
    nationalityBasis: "source (born Sheffield, England — Wikipedia)",
    dateOfBirth: "2004-07-29",
    yearsActive: "2023–Present",
    rating: 80,
    status: "squad-number list; season-long loan at Keighley (Jan–May 2026)",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.alloutrugbyleague.co.uk/news/castleford-tigers-confirm-full-squad-1584671",
      "https://en.wikipedia.org/wiki/George_Hill_(rugby_league)",
    ],
    notes: "Wikipedia: loose forward or hooker.",
  },

  // ── Wakefield Trinity ─────────────────────────────────────────────────────
  {
    club: "Wakefield Trinity",
    name: "Jordan Williams",
    squadNumber: 25,
    position: "PROP",
    nationality: "England",
    nationalityBasis: "source (born Stevenage, England — Wikipedia)",
    dateOfBirth: "1997-06-04",
    yearsActive: "2020–Present",
    previousClubs: ["London Broncos", "Featherstone Rovers"],
    rating: 80,
    status: "squad-number list; loan to Batley in July 2026",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.loverugbyleague.com/post/wakefield-trinity-2026-super-league-squad-numbers",
      "https://en.wikipedia.org/wiki/Jordan_Williams_(rugby_league)",
    ],
    notes: "Wikipedia: prop or second-row.",
  },
  {
    club: "Wakefield Trinity",
    name: "Noah High",
    squadNumber: 28,
    position: "LOOSE_FORWARD",
    nationality: "England",
    nationalityBasis: ENGLISH_ACADEMY,
    previousClubs: ["Warrington Wolves"],
    rating: 80,
    status: "squad-number list",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.loverugbyleague.com/post/wakefield-trinity-2026-super-league-squad-numbers",
      "https://wakefieldtrinity.com/noah-high-joins-trinity/",
      "https://totalrl.com/wakefield-trinity-snap-up-warrington-wolves-forward",
    ],
    notes: "Described as a 'middle/back-row forward' (filed as loose forward, the slot covering both); aged 20 in Feb 2025; ex-Warrington academy.",
  },
  {
    club: "Wakefield Trinity",
    name: "Ellis Lingard",
    squadNumber: 29,
    position: "PROP",
    nationality: "England",
    nationalityBasis: "source (Wikipedia: English)",
    dateOfBirth: "2006-10-22",
    yearsActive: "2025–Present",
    rating: 80,
    status: "squad-number list; loan to Dewsbury in 2026",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.loverugbyleague.com/post/wakefield-trinity-2026-super-league-squad-numbers",
      "https://en.wikipedia.org/wiki/Ellis_Lingard",
    ],
    notes: "Wikipedia: prop, second-row and loose forward.",
  },
  {
    club: "Wakefield Trinity",
    name: "Neil Tchamambe",
    squadNumber: 30,
    position: "WING",
    nationality: "England",
    nationalityBasis: "source (born Leeds; England Academy international — Wikipedia)",
    dateOfBirth: "2005-02-14",
    yearsActive: "2024–Present",
    previousClubs: ["Hull KR"],
    rating: 80,
    status: "squad-number list; season-long loan to London Broncos in 2026",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.loverugbyleague.com/post/wakefield-trinity-2026-super-league-squad-numbers",
      "https://en.wikipedia.org/wiki/Neil_Tchamambe",
    ],
  },
  {
    club: "Wakefield Trinity",
    name: "Kian McGann",
    squadNumber: 31,
    position: "FULLBACK",
    nationality: "England",
    nationalityBasis: ENGLISH_ACADEMY,
    previousClubs: ["St Helens"],
    rating: 80,
    status: "squad-number list",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.loverugbyleague.com/post/wakefield-trinity-2026-super-league-squad-numbers",
      "https://wakefieldtrinity.com/mcgann-joins-the-trin/",
    ],
    notes: "Club: 'a talented fullback or halfback', aged 18 when signed from St Helens' academy (Sept 2025).",
  },

  // ── Leeds Rhinos ──────────────────────────────────────────────────────────
  {
    club: "Leeds Rhinos",
    name: "Max Simpson",
    squadNumber: 18,
    position: "CENTRE",
    nationality: "England",
    nationalityBasis: "inferred: Kippax junior and Leeds academy (club profile); no other nationality recorded",
    dateOfBirth: "2004-07-24",
    rating: 80,
    status: "squad-number list",
    sources: [LRL_ALL_CLUBS, "https://www.therhinos.co.uk/teams/profile/389/max-simpson"],
  },

  // ── Leigh Leopards ────────────────────────────────────────────────────────
  {
    club: "Leigh Leopards",
    name: "Nathan Wilde",
    squadNumber: 26,
    position: "PROP",
    nationality: "England",
    nationalityBasis: "source (club profile: born Wigan)",
    birthYear: 1999,
    previousClubs: ["Wigan Warriors"],
    rating: 80,
    status: "squad-number list; loan to Salford RLFC in 2026",
    sources: [
      LRL_ALL_CLUBS,
      "https://leighleopards.co.uk/26-nathan-wilde/",
      "https://www.loverugbyleague.com/post/leigh-leopards-quartet-make-salford-loan-moves",
    ],
    notes: "Club profile: middle forward, 'former Wigan Warriors prop', born Wigan 1999.",
  },
  {
    club: "Leigh Leopards",
    name: "Ryan Brown",
    squadNumber: 28,
    position: "PROP",
    nationality: "England",
    nationalityBasis: "source (England Academy international, born Warrington — LRL)",
    previousClubs: ["Wigan Warriors"],
    rating: 80,
    status: "squad-number list; loan to Salford RLFC in 2026",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.loverugbyleague.com/post/leigh-leopards-sign-england-academy-ryan-brown-from-wigan-warriors",
      "https://www.loverugbyleague.com/post/leigh-leopards-quartet-make-salford-loan-moves",
    ],
    notes: "Aged 19 when signed (October 2024); no published DOB.",
  },
  {
    club: "Leigh Leopards",
    name: "Will Brough",
    squadNumber: 29,
    position: "CENTRE",
    nationality: "England",
    nationalityBasis: ENGLISH_ACADEMY,
    birthYear: 2006,
    previousClubs: ["Wakefield Trinity"],
    rating: 80,
    status: "squad-number list; Super League debut April 2026, later loaned out",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.loverugbyleague.com/post/will-brough-set-for-super-league-debut",
      "https://leighleopards.co.uk/?p=74449",
    ],
    notes: "Centre; 19 and turning 20 in July 2026 (born July 2006); Newsome Panthers/Emley Moor junior; son of Danny Brough.",
  },
  {
    club: "Leigh Leopards",
    name: "Oliver Polec",
    squadNumber: 30,
    position: "PROP",
    nationality: "England",
    nationalityBasis: ENGLISH_ACADEMY,
    previousClubs: ["St Helens"],
    rating: 80,
    status: "squad-number list; loans to Salford RLFC and Whitehaven in 2026",
    sources: [
      LRL_ALL_CLUBS,
      "https://leighleopards.co.uk/2026-squad-numbers-revealed/",
      "https://www.loverugbyleague.com/post/oliver-polec-whitehaven-loan-25-03-2026",
    ],
    notes: "Front-row forward aged 19 (March 2026); Woolston Rovers junior, ex-St Helens academy.",
  },

  // ── St Helens ─────────────────────────────────────────────────────────────
  {
    club: "St Helens",
    name: "Leon Cowen",
    squadNumber: 27,
    position: "LOOSE_FORWARD",
    nationality: "England",
    nationalityBasis: ENGLISH_ACADEMY,
    rating: 80,
    status: "squad-number list; loan to Swinton in 2026",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.saintsrlfc.com/teams/first-team/leon-cowen/",
      "https://www.loverugbyleague.com/post/leon-cowen-alfie-sinclair-join-swinton-on-loan-27-02-2026",
    ],
    notes: "Club profile: young forward who started at loose forward in the 2024 Reserves Grand Final; heritage no. 1,299.",
  },
  {
    club: "St Helens",
    name: "Alfie Sinclair",
    squadNumber: 29,
    position: "PROP",
    nationality: "England",
    nationalityBasis: ENGLISH_ACADEMY,
    rating: 80,
    status: "squad-number list; loan to Swinton in 2026",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.saintsrlfc.com/teams/first-team/alfie-sinclair/",
      "https://www.loverugbyleague.com/post/leon-cowen-alfie-sinclair-join-swinton-on-loan-27-02-2026",
    ],
    notes: "Club profile: prop forward from the Saints youth ranks, Ryland Sharks junior.",
  },

  // ── Toulouse Olympique ────────────────────────────────────────────────────
  {
    club: "Toulouse Olympique",
    name: "Trevor Chiffolleau",
    aliases: ["Trevor Chiffoleau"],
    squadNumber: 26,
    position: "PROP",
    nationality: "France",
    nationalityBasis: "inferred: grew up at Toulouse Olympique, French Junior Cup winner (club article)",
    dateOfBirth: "2005-07-28",
    rating: 80,
    status: "squad-number list; contract extended to end of 2027 (August 2026)",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.loverugbyleague.com/post/toulouse-olympique-2026-squad-numbers",
      "https://www.to13.com/non-classe/toulouse-olympique-extend-trevor-chiffolleaus-contract/",
    ],
  },
  {
    club: "Toulouse Olympique",
    name: "Mathieu Pons",
    squadNumber: 28,
    position: "WING",
    nationality: "France",
    nationalityBasis: "source (French international)",
    dateOfBirth: "2002-03-29",
    previousClubs: ["Saint-Gaudens", "Oldham RLFC"],
    rating: 80,
    status: "squad-number list; contract extended to end of 2027 (July 2026)",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.loverugbyleague.com/post/toulouse-olympique-2026-squad-numbers",
      "https://www.to13.com/actualites/mathieu-pons-to-remain-with-toulouse-olympique-until-2027/",
    ],
  },

  // ── Academy players positioned from the official Super League Fantasy list ─
  {
    club: "Huddersfield Giants",
    name: "Logan Blacker",
    squadNumber: 28,
    position: "FULLBACK",
    nationality: "England",
    nationalityBasis: "inferred: Huddersfield Giants academy product (club academy report); no other nationality recorded",
    rating: 80,
    status: "squad-number list (academy)",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.alloutrugbyleague.co.uk/news/huddersfield-giants-2026-squad-numbers-1520629",
      SL_FANTASY,
      "https://giantsrl.com/article/8787/academy-match-report-giants-34---10-hull-kr",
    ],
    notes: "Super League Fantasy: Full Back; listed first (No. 1 slot) in the Giants academy line-up, March 2024.",
  },
  {
    club: "Hull FC",
    name: "Roman Dawson",
    squadNumber: 33,
    position: "CENTRE",
    nationality: "England",
    nationalityBasis: "inferred: Hull FC academy product (club academy report); no other nationality recorded",
    rating: 80,
    status: "squad-number list (academy)",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.hullfc.com/blog/2025/11/29/hull-fc-confirm-2026-squad-numbers/",
      SL_FANTASY,
      "https://www.hullfc.com/blog/?p=17247",
    ],
    notes: "Super League Fantasy: Centre; club academy profile page is empty.",
  },
  {
    club: "Warrington Wolves",
    name: "Tommy Rhodes",
    squadNumber: 33,
    position: "SCRUM_HALF",
    nationality: "England",
    nationalityBasis: "inferred: Warrington Wolves academy player (U18 academy team list); no other nationality recorded",
    rating: 80,
    status: "squad-number list (academy)",
    sources: [
      LRL_ALL_CLUBS,
      SL_FANTASY,
      "https://therhinos.co.uk/match-report/1236",
    ],
    notes: "Super League Fantasy: Scrum Half; wore 6 for Warrington Academy, August 2026.",
  },
  {
    club: "Leigh Leopards",
    name: "Kavan Rothwell",
    squadNumber: 27,
    position: "SECOND_ROW",
    nationality: "England",
    nationalityBasis: "inferred: Wigan St Patricks junior and Wigan academy (Wigan Today); no other nationality recorded",
    previousClubs: ["Wigan Warriors", "Barrow Raiders"],
    rating: 80,
    status: "squad-number list",
    sources: [
      LRL_ALL_CLUBS,
      SL_FANTASY,
      "https://www.wigantoday.net/sport/rugby-league/limited-opportunities-sees-wigan-warriors-youngster-make-move-to-leigh-leopards-4373377",
    ],
    notes: "Super League Fantasy: Second Row (described himself as a back-rower turned middle in 2023).",
  },
  {
    club: "Bradford Bulls",
    name: "Cameron Bate",
    squadNumber: 29,
    position: "LOOSE_FORWARD",
    nationality: "England",
    nationalityBasis: "inferred: Bradford Bulls Elite Academy product (club); no other nationality recorded",
    rating: 80,
    status: "squad-number list (academy graduate)",
    sources: [
      LRL_ALL_CLUBS,
      SL_FANTASY,
      "https://www.bradfordbulls.co.uk/article/3028/bulls-sign-youngster-bate-on-first-team-contract",
    ],
    notes: "Super League Fantasy: Loose Forward; club calls him a young forward, aged 18 in April 2025.",
  },

  // ── Championship (Manager Mode only; hidden from Classic like the existing rows) ─
  {
    club: "Midlands Hurricanes",
    name: "Liam Sutcliffe",
    position: "CENTRE",
    nationality: "England",
    nationalityBasis: "source (England international — Wikipedia)",
    dateOfBirth: "1994-11-25",
    yearsActive: "2013–Present",
    previousClubs: ["Leeds Rhinos", "Hull FC", "Huddersfield Giants"],
    rating: 80,
    status:
      "mid-season move: Huddersfield squad number 19, released 23 July 2026 and joined Midlands Hurricanes until the end of 2026",
    sources: [
      "https://www.yorkshireeveningpost.co.uk/sport/rugby-league/ex-leeds-rhinos-grand-final-winner-finds-new-club-after-sudden-super-league-departure-8819827",
      "https://en.wikipedia.org/wiki/Liam_Sutcliffe",
      LRL_ALL_CLUBS,
      SL_FANTASY,
    ],
    notes: "Utility; Wikipedia: stand-off and centre, Super League Fantasy: Centre. Rated 80 like the other real Championship cards.",
  },
  {
    club: "Oldham RLFC",
    name: "Josh Simm",
    aliases: ["Joshua Simm"],
    position: "WING",
    nationality: "England",
    nationalityBasis: "source (born St Helens, England — Wikipedia)",
    dateOfBirth: "2001-02-27",
    yearsActive: "2019–Present",
    previousClubs: ["St Helens", "Castleford Tigers", "Catalans Dragons"],
    rating: 80,
    status:
      "mid-season move: Catalans squad number 22, released and joined Oldham for the rest of 2026 (1 August 2026)",
    sources: [
      "https://www.loverugbyleague.com/post/catalans-dragons-winger-joins-championship-club-after-immediate-release",
      "https://en.wikipedia.org/wiki/Josh_Simm",
      LRL_ALL_CLUBS,
      SL_FANTASY,
    ],
    notes: "Wikipedia: centre or winger; Super League Fantasy and LRL: winger.",
  },

  // ── York Knights (mid-season) ─────────────────────────────────────────────
  {
    club: "York Knights",
    name: "Tommy Doyle",
    aliases: ["Thomas Doyle"],
    position: "HOOKER",
    nationality: "England",
    nationalityBasis: "source (Wikipedia: English)",
    dateOfBirth: "1999-06-29",
    yearsActive: "2019–Present",
    previousClubs: ["Bradford Bulls", "Keighley Cougars", "Wakefield Trinity"],
    rating: 80,
    status:
      "mid-season signing: Wakefield squad number 22, released 13 August 2026 and signed by York the next day (deal to end of 2027)",
    sources: [
      LRL_ALL_CLUBS,
      "https://en.wikipedia.org/wiki/Thomas_Doyle_(rugby_league)",
      "https://www.yorkshireeveningpost.co.uk/sport/rugby-league/forward-released-by-wakefield-trinity-finds-new-club-thomas-doyle-could-make-debut-v-leeds-rhinos-8925808",
      "https://en.wikipedia.org/wiki/2026_York_Knights_season",
    ],
  },
];

export const MOVES: Move[] = [
  {
    name: "Oliver Leyland",
    fromId: "london-cur-oliver-leyland",
    toClub: "Warrington Wolves",
    reason:
      "Warrington squad number 28 for 2026 (at Warrington since 2025); the Current card was still on his old London Broncos club (hidden Championship card). Moved and made playable; rating untouched.",
    sources: [LRL_ALL_CLUBS, "https://en.wikipedia.org/wiki/Oliver_Leyland"],
  },
  {
    name: "Arthur Romano",
    fromId: "catalans-cur-arthur-romano",
    toClub: "Hull FC",
    reason: "Signed a two-year deal with Hull FC from Catalans for 2026 (Hull FC squad number 21).",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.hullfc.com/blog/2025/11/29/hull-fc-confirm-2026-squad-numbers/",
      "https://holderness-gazette.co.uk/new-signings-bolster-airlie-birds-squad/",
    ],
  },
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

export type DuplicateRow = {
  club: string;
  removeId: string;
  keepId: string;
  /** Correct display name for the kept row, when the spelling was wrong. */
  keepName?: string;
  reason: string;
  sources: string[];
};

/** Same person stored twice under different spellings — keep one card. */
export const DUPLICATE_ROWS: DuplicateRow[] = [
  {
    club: "Catalans Dragons",
    removeId: "catalans-cur-romain-navarrete",
    keepId: "catalans-cur-romain-navarette",
    keepName: "Romain Navarrete",
    reason:
      "Romain Navarrete was stored twice (\"Navarette\" from the 2026 ratings import and \"Navarrete\" added later by sync-2026-sl-player-pool). Kept the ratings-import card (id unchanged, rating untouched) and corrected its name spelling; removed the later duplicate, which was in no pool and had no overrides.",
    sources: [LRL_ALL_CLUBS],
  },
  {
    club: "Toulouse Olympique",
    removeId: "london-cur-robert-butler",
    keepId: "toulouse-cur-rob-butler",
    reason:
      "Rob Butler (prop, born 1998) had a playable Toulouse card and a hidden London Broncos card (\"Robert Butler\", whose own club history lists Toulouse). Toulouse squad number 17 for 2026, so the stale London card was removed; Manager Mode no longer puts him in two squads.",
    sources: [LRL_ALL_CLUBS, "https://www.loverugbyleague.com/post/toulouse-olympique-2026-squad-numbers"],
  },
];

export const NOT_APPLIED_MOVES: MoveNotApplied[] = [
  {
    club: "Warrington Wolves",
    name: "James Bentley",
    existingId: "leeds-cur-james-bentley",
    reason:
      "Warrington squad number 20 for 2026 (joined from Leeds), but his Current card is in Leeds Rhinos' 16-man 2026 Classic pool, which cannot drop below 16 — left at Leeds pending a pool replacement.",
    sources: [LRL_ALL_CLUBS, "https://www.alloutrugbyleague.co.uk/news/warrington-wolves-squad-unpicked-new-1508041"],
  },
  {
    club: "Warrington Wolves",
    name: "Kelepi Tanginoa",
    existingId: "hull-kr-cur-kelepi-tanginoa",
    reason:
      "Warrington squad number 34 for 2026, but his Current card is in Hull KR's 16-man 2026 Classic pool — left at Hull KR pending a pool replacement.",
    sources: [LRL_ALL_CLUBS],
  },
  {
    club: "Hull KR",
    name: "Jordan Dezaria",
    existingId: "catalans-cur-jordan-dezaria",
    reason:
      "Hull KR squad number 20 for 2026, but his Current card is in Catalans Dragons' 2026 Classic pool (16 after Arthur Romano's move) — left at Catalans pending a pool replacement.",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.loverugbyleague.com/post/hull-kr-confirm-2026-squad-numbers-as-new-recruit-handed-key-jersey",
    ],
  },
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
    club: "Huddersfield Giants",
    name: "Liam Sutcliffe",
    squadNumber: 19,
    reason:
      "Huddersfield squad number 19, but released on 23 July 2026 and joined Midlands Hurricanes (Championship) until the end of 2026 — added at Midlands Hurricanes instead (see championship section), not as a Huddersfield card.",
    sources: [
      LRL_ALL_CLUBS,
      "https://giantsrl.com/article/10009/sutcliffe-to-depart-giants",
      "https://www.yorkshireeveningpost.co.uk/sport/rugby-league/ex-leeds-rhinos-grand-final-winner-finds-new-club-after-sudden-super-league-departure-8819827",
    ],
  },
  {
    club: "Warrington Wolves",
    name: "Ewan Smith",
    squadNumber: 32,
    reason:
      "On the 2026 squad-number list and listed as a second-rower in Super League Fantasy, but no source for his background or nationality was found.",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.alloutrugbyleague.co.uk/news/warrington-wolves-squad-unpicked-new-1508041",
      SL_FANTASY,
    ],
  },
  {
    club: "Warrington Wolves",
    name: "Matt Dufty",
    squadNumber: 24,
    reason:
      "Given squad number 24 but released in January 2026 before playing (joined South Sydney on a NSW Cup deal) — not a 2026 Warrington player, not added.",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.loverugbyleague.com/post/matt-dufty-handed-nrl-lifeline-after-warrington-wolves-release",
    ],
  },
  {
    club: "York Knights",
    name: "Myles Harrison",
    reason:
      "Listed as a loan from Newcastle Thunder on the York 2026 season page, but no York appearance, squad number or position found.",
    sources: ["https://en.wikipedia.org/wiki/2026_York_Knights_season"],
  },
  {
    club: "Bradford Bulls",
    name: "Ronan Michael",
    squadNumber: 26,
    reason:
      "Bradford squad number 26, but released in April 2026 (Keighley loan, then Northern Pride in Queensland) — not a Bradford player for most of 2026, not added. A historic Bradford card already exists.",
    sources: [LRL_ALL_CLUBS, "https://en.wikipedia.org/wiki/Ronan_Michael"],
  },
  {
    club: "Catalans Dragons",
    name: "Josh Simm",
    squadNumber: 22,
    reason:
      "Catalans squad number 22, but released on 1 August 2026 and joined Oldham (Championship) for the rest of 2026 — added at Oldham instead (see championship section), not as a Catalans card.",
    sources: [
      LRL_ALL_CLUBS,
      "https://www.loverugbyleague.com/post/catalans-dragons-winger-joins-championship-club-after-immediate-release",
    ],
  },
  {
    club: "Castleford Tigers",
    name: "Ramon Silva",
    squadNumber: 29,
    reason:
      "On the January 2026 squad-number list, but released by Castleford in December 2025 — not a 2026 Castleford player, not added.",
    sources: [LRL_ALL_CLUBS, "https://www.rugbyleaguehub.com/?p=311910"],
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

export const CHAMPIONSHIP_NOTE = [
  "Manager Mode builds Championship squads from the real rows for that club (availableInGame:false is ignored for the Championship) and tops each club up to the 24-man SQUAD_TEMPLATE with generated players at the club's strength (about 70–79). Adding a real player simply replaces one generated depth player, so nothing in the generated-squad logic breaks.",
  "Only the two players already researched for this task who moved to Championship clubs mid-2026 were added (Liam Sutcliffe → Midlands Hurricanes, Josh Simm → Oldham), rated 80 like the existing real Championship cards. One stale London Broncos card was moved (Oliver Leyland → Warrington) and one duplicate removed (Robert Butler = Toulouse's Rob Butler).",
  "Full Championship squads (London Broncos, Sheffield, Oldham, Midlands, Widnes, Barrow) were not researched. Before doing that the owner should choose a Championship rating scale: the existing real Championship cards are stored on the Super League 80+ scale (validate-players also rejects Current cards below 75), while generated Championship players top out at 78, so a whole real squad at 80+ would make that club far stronger than the rest of the Championship in Manager Mode.",
];

export const MANAGER_MODE_NOTE = [
  "Manager Mode (src/lib/career/world.ts) puts every real Current row into its club's starting squad, and SQUAD_MAX is 34 (scripts/test-career.ts checks it). With academy players added, York and Hull FC have 35 real players and Wigan's real players plus template depth also run past 34.",
  "world.ts now starts such clubs at SQUAD_MAX by leaving out their lowest-rated, then youngest, real players in over-stocked positions (currently 1–2 academy players at Hull FC, Wigan and York; run bun scripts/check-career-squad-sizes.ts to see who). The players stay in the database and in every other mode. Raising SQUAD_MAX instead would keep them all in Manager Mode but changes the transfer-window rules, so it was left for the owner to decide.",
];

export const PRE_EXISTING_ISSUES = [
  "Same person with two playable Current cards, left in place because the stale card sits in a 16/17-man 2026 Classic pool that cannot lose a player without a replacement: Liam Hood and Renouf Atoni (stale Wakefield cards; both Castleford for 2026), Oliver Wilson (stale Huddersfield card; Wigan No. 21), Sam Lisone (stale Leeds card; Hull FC No. 16), Justin Sangaré (stale Toulouse card; York No. 16), Bayley Sironen (Catalans card; left for Wynnum Manly). Darnell McIntosh also has a hidden stale Leigh card (Castleford for 2026).",
  "Current cards not on any 2026 squad-number list (possibly left before 2026; not removed): Morgan Knowles (St Helens), Morgan Gannon (Leeds), Kai O'Donnell (Leigh), Matty Nicholson (Warrington), Eloi Pelissier and John Toleafoa (Toulouse), Paul Séguier (Catalans). César Rougé is Toulouse No. 29 but his card is at Catalans; Ethan O'Neill is Leeds No. 16 (now listed on Hull FC's site) but his card is at Leigh; Leon Ruan appears on both the Bradford (No. 30) and Hull KR (No. 27) lists and his card is at Bradford.",
  "Warrington's Josh Smith is stored as England, but the club profile says he was born in Echuca, Victoria (Australia). Not changed.",
  "data/team-year-rosters.json Leigh 2026 still lists Darnell McIntosh where current-team-year-squads-2026.json has Josh Charnley (regenerate with generate-team-year-rosters.ts; pre-existing).",
  "scripts/audit-duplicate-players.ts is not a read-only audit: it rewrites current-squads.json, historic-players.json and legends.json, deleting every same-name card except one (it removed 202 current and 1,374 historic rows when run). It was run once for this task and the changes were reverted.",
  "scripts/merge-player-additions.ts would re-add ids from data/player-additions.json that have since been moved or removed (including london-cur-robert-butler and london-cur-oliver-leyland).",
];
