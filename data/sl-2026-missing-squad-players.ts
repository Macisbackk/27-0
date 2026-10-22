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
    name: "Oli Leyland",
    aliases: ["Oliver Leyland"],
    squadNumber: 28,
    position: "STAND_OFF",
    nationality: "England",
    nationalityBasis: "source (born Maidstone, England — Wikipedia)",
    dateOfBirth: "2001-05-17",
    yearsActive: "2021–Present",
    previousClubs: ["London Broncos"],
    rating: 80,
    status: "squad-number list",
    sources: [LRL_ALL_CLUBS, "https://en.wikipedia.org/wiki/Oliver_Leyland"],
  },
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
];

export const MOVES: Move[] = [
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
    name: "Logan Blacker",
    squadNumber: 28,
    reason: "On the 2026 squad-number list, but no source found for his position or background.",
    sources: [LRL_ALL_CLUBS, "https://www.alloutrugbyleague.co.uk/news/huddersfield-giants-2026-squad-numbers-1520629"],
  },
  {
    club: "Huddersfield Giants",
    name: "Liam Sutcliffe",
    squadNumber: 19,
    reason:
      "Huddersfield squad number 19, but released on 23 July 2026 and joined Midlands Hurricanes (Championship) until the end of 2026 — not added as a Huddersfield Current card (see Championship section).",
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
    reason: "On the 2026 squad-number list, but no source found for his position or background.",
    sources: [LRL_ALL_CLUBS, "https://www.alloutrugbyleague.co.uk/news/warrington-wolves-squad-unpicked-new-1508041"],
  },
  {
    club: "Warrington Wolves",
    name: "Tommy Rhodes",
    squadNumber: 33,
    reason: "On the 2026 squad-number list, but no source found for his position or background.",
    sources: [LRL_ALL_CLUBS, "https://www.alloutrugbyleague.co.uk/news/warrington-wolves-squad-unpicked-new-1508041"],
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
    club: "Hull FC",
    name: "Roman Dawson",
    squadNumber: 33,
    reason: "On the 2026 squad-number list, but his club profile is empty and no source gives his position.",
    sources: [LRL_ALL_CLUBS, "https://www.hullfc.com/blog/2025/11/29/hull-fc-confirm-2026-squad-numbers/"],
  },
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
