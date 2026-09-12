/**
 * Database initialization for Manager Mode.
 * Reads existing 27-0 player and club data and produces the canonical
 * ManagerState with zero duplicate sources of truth.
 */

import currentSquadsData from "../../../data/current-squads.json";
import championshipClubsData from "../../../data/championship-clubs.json";
import {
  CLUB_REPUTATION_BY_NAME,
  CHAMPIONSHIP_CLUB_REPUTATION_BY_NAME,
} from "../../../data/club-reputation";
import { PLAYER_POTENTIAL_OVERRIDES } from "../../../data/player-potential-overrides";
import { PLAYER_RATING_OVERRIDES } from "../../../data/player-rating-overrides";
import {
  STARTING_POSITIONS,
  CALENDAR_RULES,
  SALARY_CAP,
  calculateMarketWage,
} from "./rules";
import type {
  ManagerState,
  ManagerClub,
  ManagerPlayer,
  Position,
  SquadTier,
  CompetitionId,
  ClubLineup,
  ClubTactics,
  BoardObjective,
  ClubFinances,
  ClubFacilities,
} from "./types";
import { generateFixturesForCompetition } from "./competitions";

export const STADIUMS: Record<string, { name: string; capacity: number }> = {
  "Wigan Warriors": { name: "Brick Community Stadium", capacity: 25138 },
  "St Helens": { name: "Totally Wicked Stadium", capacity: 18000 },
  "Leeds Rhinos": { name: "AMT Headingley Stadium", capacity: 19700 },
  "Hull KR": { name: "Sewell Group Craven Park", capacity: 12225 },
  "Warrington Wolves": { name: "Halliwell Jones Stadium", capacity: 15300 },
  "Hull FC": { name: "MKM Stadium", capacity: 25586 },
  "Wakefield Trinity": { name: "DIY Kitchens Stadium", capacity: 9333 },
  "Catalans Dragons": { name: "Stade Gilbert Brutus", capacity: 13000 },
  "Leigh Leopards": { name: "Leigh Sports Village", capacity: 12000 },
  "Bradford Bulls": { name: "Odsal Stadium", capacity: 22000 },
  "Huddersfield Giants": { name: "John Smith's Stadium", capacity: 24121 },
  "Castleford Tigers": { name: "Mend-A-Hose Jungle", capacity: 10500 },
  "York Knights": { name: "LNER Community Stadium", capacity: 8500 },
  "Toulouse Olympique": { name: "Stade Ernest-Wallon", capacity: 19500 },
  "Salford RLFC": { name: "Salford Community Stadium", capacity: 12000 },
  "London Broncos": { name: "Plough Lane", capacity: 9215 },
  "Widnes Vikings": { name: "DCBL Stadium", capacity: 13350 },
  "Halifax Panthers": { name: "The Shay", capacity: 10400 },
  "Sheffield Eagles": { name: "Olympic Legacy Park", capacity: 3000 },
  "Oldham RLFC": { name: "Boundary Park", capacity: 13500 },
  "Doncaster RLFC": { name: "Eco-Power Stadium", capacity: 15231 },
  "Barrow Raiders": { name: "Matt Johnson Prestige Stadium", capacity: 6000 },
  "Batley Bulldogs": { name: "Fox's Biscuits Stadium", capacity: 7500 },
  "Newcastle Thunder": { name: "Kingston Park", capacity: 10200 },
  "Hunslet RLFC": { name: "South Leeds Stadium", capacity: 4000 },
  "Whitehaven RLFC": { name: "The Recreation Ground", capacity: 7500 },
};

export const CLUB_COLORS: Record<string, { primary: string; secondary: string; accent: string; text: string }> = {
  "Wigan Warriors": { primary: "#8B1538", secondary: "#FFFFFF", accent: "#D4AF37", text: "#FFFFFF" },
  "St Helens": { primary: "#E30613", secondary: "#FFFFFF", accent: "#111111", text: "#FFFFFF" },
  "Leeds Rhinos": { primary: "#0066B3", secondary: "#FDB913", accent: "#FFFFFF", text: "#FFFFFF" },
  "Hull KR": { primary: "#D31145", secondary: "#FFFFFF", accent: "#0A1633", text: "#FFFFFF" },
  "Warrington Wolves": { primary: "#FDB913", secondary: "#0066B3", accent: "#FFFFFF", text: "#111111" },
  "Hull FC": { primary: "#111111", secondary: "#FFFFFF", accent: "#888888", text: "#FFFFFF" },
  "Wakefield Trinity": { primary: "#C8102E", secondary: "#002B49", accent: "#FFFFFF", text: "#FFFFFF" },
  "Catalans Dragons": { primary: "#8B1538", secondary: "#F5A623", accent: "#FFFFFF", text: "#FFFFFF" },
  "Leigh Leopards": { primary: "#B01B2E", secondary: "#FFFFFF", accent: "#111111", text: "#FFFFFF" },
  "Bradford Bulls": { primary: "#000000", secondary: "#E30613", accent: "#F5A623", text: "#FFFFFF" },
  "Huddersfield Giants": { primary: "#6B1D2F", secondary: "#C9A227", accent: "#FFFFFF", text: "#FFFFFF" },
  "Castleford Tigers": { primary: "#E87722", secondary: "#000000", accent: "#FFFFFF", text: "#111111" },
  "York Knights": { primary: "#0A2540", secondary: "#F5A623", accent: "#FFFFFF", text: "#FFFFFF" },
  "Toulouse Olympique": { primary: "#002B49", secondary: "#FFFFFF", accent: "#C8102E", text: "#FFFFFF" },
  "Salford RLFC": { primary: "#C8102E", secondary: "#FFFFFF", accent: "#111111", text: "#FFFFFF" },
  "London Broncos": { primary: "#000000", secondary: "#B01B2E", accent: "#F5A623", text: "#FFFFFF" },
  "Widnes Vikings": { primary: "#000000", secondary: "#FFFFFF", accent: "#888888", text: "#FFFFFF" },
  "Halifax Panthers": { primary: "#002B49", secondary: "#0080FF", accent: "#FFFFFF", text: "#FFFFFF" },
  "Sheffield Eagles": { primary: "#C8102E", secondary: "#F5A623", accent: "#111111", text: "#FFFFFF" },
  "Oldham RLFC": { primary: "#C8102E", secondary: "#FFFFFF", accent: "#002B49", text: "#FFFFFF" },
  "Doncaster RLFC": { primary: "#0A2540", secondary: "#C9A227", accent: "#FFFFFF", text: "#FFFFFF" },
  "Barrow Raiders": { primary: "#1E4D9B", secondary: "#FFFFFF", accent: "#0B2A5B", text: "#FFFFFF" },
  "Batley Bulldogs": { primary: "#C2185B", secondary: "#D2B48C", accent: "#FFFFFF", text: "#FFFFFF" },
  "Newcastle Thunder": { primary: "#111111", secondary: "#5BC2E7", accent: "#FFFFFF", text: "#FFFFFF" },
  "Hunslet RLFC": { primary: "#0B5C3B", secondary: "#FFFFFF", accent: "#F15A29", text: "#FFFFFF" },
  "Whitehaven RLFC": { primary: "#1E4D9B", secondary: "#FFFFFF", accent: "#0B2A5B", text: "#FFFFFF" },
};

const FIRST_NAMES = [
  "Liam", "Jack", "Harry", "Oliver", "George", "Noah", "Charlie", "Jacob", "Alfie", "Freddie",
  "Sam", "Ben", "Joe", "Tom", "Will", "Dan", "Luke", "Alex", "Matty", "Brad",
  "Callum", "Cameron", "Lewis", "Josh", "Morgan", "Jordan", "Connor", "Tyler", "Kieran", "Ellis",
  "Mason", "Harvey", "Ethan", "Archie", "Oscar", "Lucas", "James", "Max", "Leo", "Logan",
  "Tevita", "Junior", "Sione", "Kelepi", "Kavalo", "Maika", "Siua", "Paul", "Jean", "Mathieu"
];

const LAST_NAMES = [
  "Smith", "Jones", "Taylor", "Brown", "Williams", "Wilson", "Johnson", "Davies", "Robinson", "Wright",
  "Thompson", "Evans", "Walker", "White", "Roberts", "Green", "Hall", "Wood", "Jackson", "Clarke",
  "Clark", "Turnbull", "Hastings", "Hardaker", "Burgess", "Sinfield", "Farrell", "Lomax", "Newman", "Field",
  "French", "Welsby", "Percival", "Makinson", "Walmsley", "Leeming", "Gale", "Sneyd", "Ackers", "Doro",
  "Fulton", "Milnes", "Okunbor", "Ryan", "Blake", "Roby", "Cunningham", "Radford", "Peacock", "Sculthorpe"
];

export function toClubId(clubName: string): string {
  return clubName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function normalizePosition(pos: string): Position {
  const p = (pos || "").toUpperCase();
  if (p.includes("FULL") || p === "FB") return "FULLBACK";
  if (p.includes("WING") || p === "WG") return "WING";
  if (p.includes("CENT") || p === "CE") return "CENTRE";
  if (p.includes("STAND") || p === "SO" || p.includes("FIVE")) return "STAND_OFF";
  if (p.includes("SCRUM") || p === "SH" || p.includes("HALF")) return "SCRUM_HALF";
  if (p.includes("PROP") || p === "PR" || p === "PF") return "PROP";
  if (p.includes("HOOK") || p === "HK") return "HOOKER";
  if (p.includes("SECOND") || p === "SR") return "SECOND_ROW";
  if (p.includes("LOOSE") || p === "LF" || p.includes("LOCK")) return "LOOSE_FORWARD";
  return "PROP";
}

let uniqueGenCounter = 1;
export function generateUniquePlayerId(prefix = "gen"): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).substring(2, 6);
  const count = (uniqueGenCounter++).toString(36);
  return `${prefix}_${ts}_${count}_${rnd}`;
}

export function createGeneratedPlayer(
  name: string,
  pos: Position,
  age: number,
  rating: number,
  potential: number,
  clubId: string | null,
  squadTier: SquadTier | null,
  competitionId: CompetitionId = "championship"
): ManagerPlayer {
  const id = generateUniquePlayerId(clubId ? clubId.slice(0, 4) : "fa");
  const birthYear = 2026 - age;
  const month = Math.floor(Math.random() * 12) + 1;
  const day = Math.floor(Math.random() * 28) + 1;
  const dob = `${birthYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const clampedRating = Math.max(40, Math.min(99, Math.round(rating)));
  const clampedPot = Math.max(clampedRating, Math.min(99, Math.round(potential)));
  const wage = calculateMarketWage(clampedRating, age, competitionId);

  return {
    id,
    name,
    dob,
    age,
    nationality: Math.random() < 0.85 ? "England" : (Math.random() < 0.5 ? "Australia" : "New Zealand"),
    position: pos,
    rating: clampedRating,
    potential: clampedPot,
    form: 7.0,
    morale: 80,
    fitness: 100,
    fatigue: 0,
    injury: null,
    suspension: null,
    clubId,
    squadTier,
    loan: null,
    contract: clubId ? {
      wageWeekly: wage,
      expiresSeason: 2026 + (age < 21 ? 3 : Math.floor(Math.random() * 2) + 1),
      role: squadTier === "first" ? (clampedRating >= 80 ? "star" : "first_team") : (squadTier === "reserves" ? "rotation" : "youth"),
    } : null,
    trainingFocus: "balanced",
    stats: {
      apps: 0,
      tries: 0,
      goals: 0,
      dropGoals: 0,
      points: 0,
      motm: 0,
      avgRating: 7.0,
      matchRatings: [],
    },
    careerStats: {
      apps: 0,
      tries: 0,
      goals: 0,
      dropGoals: 0,
      points: 0,
      motm: 0,
    },
  };
}

/** Builds the full starting lineup for a club based on its first team players */
export function buildBestLineup(players: ManagerPlayer[]): ClubLineup {
  const available = players.filter((p) => !p.injury && !p.suspension);
  const starting13: (string | null)[] = new Array(13).fill(null);
  const usedIds = new Set<string>();

  // Slot 0..12 corresponding to STARTING_POSITIONS
  STARTING_POSITIONS.forEach((pos, slotIdx) => {
    const candidate = available
      .filter((p) => !usedIds.has(p.id) && p.position === pos)
      .sort((a, b) => b.rating - a.rating)[0];

    if (candidate) {
      starting13[slotIdx] = candidate.id;
      usedIds.add(candidate.id);
    }
  });

  // Fallback for empty starting slots
  STARTING_POSITIONS.forEach((pos, slotIdx) => {
    if (!starting13[slotIdx]) {
      const fallback = available
        .filter((p) => !usedIds.has(p.id))
        .sort((a, b) => b.rating - a.rating)[0];
      if (fallback) {
        starting13[slotIdx] = fallback.id;
        usedIds.add(fallback.id);
      }
    }
  });

  // Bench: top 4 remaining available players
  const bench: (string | null)[] = new Array(4).fill(null);
  const remaining = available
    .filter((p) => !usedIds.has(p.id))
    .sort((a, b) => b.rating - a.rating);

  for (let i = 0; i < 4; i++) {
    if (remaining[i]) {
      bench[i] = remaining[i].id;
      usedIds.add(remaining[i].id);
    }
  }

  return { starting13, bench };
}

/**
 * Initializes the entire Manager Mode universe with Super League, Championship,
 * and canonical players.
 */
export function initializeManagerDatabase(chosenClubId: string, managerName = "Coach"): ManagerState {
  const players: Record<string, ManagerPlayer> = {};
  const clubs: Record<string, ManagerClub> = {};

  const slClubNames = Object.keys(CLUB_REPUTATION_BY_NAME);
  // Canonical 12 Championship clubs
  const champClubNames = [
    "Salford RLFC",
    "London Broncos",
    "Widnes Vikings",
    "Halifax Panthers",
    "Sheffield Eagles",
    "Oldham RLFC",
    "Doncaster RLFC",
    "Barrow Raiders",
    "Batley Bulldogs",
    "Newcastle Thunder",
    "Hunslet RLFC",
    "Whitehaven RLFC",
  ];

  // Helper to init club record
  function initClub(name: string, compId: CompetitionId, stars: number): ManagerClub {
    const id = toClubId(name);
    const stadium = STADIUMS[name] || { name: `${name} Stadium`, capacity: 10000 };
    const colors = CLUB_COLORS[name] || { primary: "#1E4D9B", secondary: "#FFFFFF", accent: "#111111", text: "#FFFFFF" };
    const shortName = name.split(" ")[0];
    const abbreviation = (name.split(" ").map(w => w[0]).join("") + "RL").slice(0, 3).toUpperCase();

    const isSL = compId === "super-league";
    const baseBudget = isSL ? (stars >= 4 ? 350000 : 150000) : (stars === 3 ? 100000 : 40000);
    const wageCap = isSL ? SALARY_CAP["super-league"].weeklyCap : SALARY_CAP["championship"].weeklyCap;

    const finances: ClubFinances = {
      balance: baseBudget,
      wageBudgetWeekly: wageCap,
      transferBudget: Math.round(baseBudget * 0.7),
      seasonRevenue: 0,
      seasonExpenses: 0,
      history: [
        {
          id: `init_${id}`,
          season: 2026,
          week: 1,
          amount: baseBudget,
          category: "misc",
          description: "Initial Season Operating Balance",
        },
      ],
    };

    const facilities: ClubFacilities = {
      training: Math.min(5, Math.max(1, stars)),
      youth: Math.min(5, Math.max(1, isSL ? stars : stars + 1)),
      stadiumCapacity: stadium.capacity,
    };

    const tactics: ClubTactics = {
      formation: "standard",
      style: "balanced",
      kickingFocus: "territory",
      trainingIntensity: "normal",
    };

    const boardObjectives: BoardObjective[] = [
      {
        id: `${id}_league_target`,
        title: isSL
          ? (stars >= 4 ? "Compete for the Grand Final" : (stars >= 3 ? "Reach the Top 6 Playoffs" : "Avoid Relegation"))
          : (stars === 3 ? "Gain Promotion to Super League" : (stars === 2 ? "Reach Championship Playoffs" : "Consolidate Championship Status")),
        description: "Achieve the board's seasonal league expectation.",
        category: "league",
        targetValue: isSL ? (stars >= 4 ? 4 : (stars >= 3 ? 6 : 13)) : (stars === 3 ? 1 : (stars === 2 ? 6 : 10)),
        currentValue: 1,
        isCompleted: false,
        isFailed: false,
        importance: "high",
      },
      {
        id: `${id}_cup_target`,
        title: "Challenge Cup Progress",
        description: isSL ? "Reach at least the Quarter Finals" : "Reach at least Round 5",
        category: "cup",
        targetValue: isSL ? "Quarter Finals" : "Round 5",
        currentValue: "Round 1",
        isCompleted: false,
        isFailed: false,
        importance: "medium",
      },
      {
        id: `${id}_youth_target`,
        title: "Youth Development",
        description: "Give at least 5 first-team appearances to Academy graduates.",
        category: "youth",
        targetValue: 5,
        currentValue: 0,
        isCompleted: false,
        isFailed: false,
        importance: "medium",
      },
    ];

    return {
      id,
      name,
      shortName,
      abbreviation,
      competitionId: compId,
      reputation: stars,
      primaryColor: colors.primary,
      secondaryColor: colors.secondary,
      accentColor: colors.accent,
      textColour: colors.text,
      finances,
      facilities,
      coachingQuality: Math.min(5, Math.max(1, stars)),
      boardConfidence: 75,
      boardObjectives,
      tactics,
      lineup: { starting13: new Array(13).fill(null), bench: new Array(4).fill(null) },
      stadiumName: stadium.name,
    };
  }

  // 1. Populate clubs
  for (const name of slClubNames) {
    const stars = CLUB_REPUTATION_BY_NAME[name] || 3;
    const club = initClub(name, "super-league", stars);
    clubs[club.id] = club;
  }
  for (const name of champClubNames) {
    const stars = CHAMPIONSHIP_CLUB_REPUTATION_BY_NAME[name] || 2;
    const club = initClub(name, "championship", stars);
    clubs[club.id] = club;
  }

  // 2. Import real players from data/current-squads.json
  const clubPlayersMap: Record<string, ManagerPlayer[]> = {};
  for (const raw of currentSquadsData as any[]) {
    const clubName = raw.club || raw.currentClub || raw.team;
    if (!clubName) continue;
    const clubId = toClubId(clubName);
    if (!clubs[clubId]) continue; // ignore non-SL / non-Champ

    const pos = normalizePosition(raw.position || raw.primaryPosition);
    const ratingOverride = PLAYER_RATING_OVERRIDES[raw.id] || raw.peakRating || 75;
    const rating = Math.max(40, Math.min(99, ratingOverride));

    const potentialOverride = PLAYER_POTENTIAL_OVERRIDES[raw.id];
    let potential = potentialOverride ?? (raw.potential || (rating + (raw.birthYear && (2026 - raw.birthYear) <= 23 ? 8 : 2)));
    potential = Math.max(rating, Math.min(99, potential));

    const age = raw.birthYear ? (2026 - raw.birthYear) : 25;
    const dob = raw.dateOfBirth || `${2026 - age}-01-01`;
    const wage = calculateMarketWage(rating, age, clubs[clubId].competitionId);

    const player: ManagerPlayer = {
      id: raw.id,
      name: raw.name,
      dob,
      age,
      nationality: raw.nationality || "England",
      position: pos,
      rating,
      potential,
      form: 7.0,
      morale: 80,
      fitness: 100,
      fatigue: 0,
      injury: null,
      suspension: null,
      clubId,
      squadTier: "first", // will be adjusted during squad sorting below
      loan: null,
      contract: {
        wageWeekly: wage,
        expiresSeason: 2026 + (Math.random() < 0.4 ? 1 : 2),
        role: rating >= 82 ? "star" : (rating >= 76 ? "first_team" : "rotation"),
      },
      trainingFocus: "balanced",
      stats: {
        apps: 0,
        tries: 0,
        goals: 0,
        dropGoals: 0,
        points: 0,
        motm: 0,
        avgRating: 7.0,
        matchRatings: [],
      },
      careerStats: {
        apps: raw.appearances || 0,
        tries: raw.tries || 0,
        goals: 0,
        dropGoals: 0,
        points: (raw.tries || 0) * 4,
        motm: 0,
      },
    };

    players[player.id] = player;
    if (!clubPlayersMap[clubId]) clubPlayersMap[clubId] = [];
    clubPlayersMap[clubId].push(player);
  }

  // 3. Ensure every club has a complete squad across First Team (17-21), Reserves (5-6), and Academy (4-6)
  // For Championship clubs or Super League clubs with gaps, synthesize realistic players to ensure depth.
  for (const [clubId, club] of Object.entries(clubs)) {
    const existing = clubPlayersMap[clubId] || [];
    const isSL = club.competitionId === "super-league";
    const targetSize = 28; // standard healthy squad size

    // If squad needs more players, generate them
    if (existing.length < targetSize) {
      const needed = targetSize - existing.length;
      const baseStrength = isSL ? (club.reputation >= 4 ? 78 : 72) : (club.reputation === 3 ? 68 : 62);

      for (let i = 0; i < needed; i++) {
        const pos = STARTING_POSITIONS[i % STARTING_POSITIONS.length];
        const isAcademyAge = i >= (needed - 5);
        const age = isAcademyAge ? Math.floor(Math.random() * 3) + 17 : Math.floor(Math.random() * 10) + 21;
        const ratingVariation = (Math.random() * 8) - 4;
        const rating = isAcademyAge
          ? Math.max(50, Math.round(baseStrength - 12 + ratingVariation))
          : Math.max(55, Math.round(baseStrength - 4 + ratingVariation));
        const potential = isAcademyAge
          ? Math.min(92, Math.round(rating + 14 + Math.random() * 10))
          : Math.min(90, Math.round(rating + Math.random() * 4));

        const fn = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
        const ln = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
        const genPlayer = createGeneratedPlayer(
          `${fn} ${ln}`,
          pos,
          age,
          rating,
          potential,
          clubId,
          isAcademyAge ? "academy" : "reserves",
          club.competitionId
        );

        players[genPlayer.id] = genPlayer;
        existing.push(genPlayer);
      }
    }

    // Sort squad by rating descending
    existing.sort((a, b) => b.rating - a.rating);

    // Assign tiers: Top 18 -> First Team, Next 6 -> Reserves, Remainder -> Academy
    existing.forEach((p, idx) => {
      if (idx < 18) {
        p.squadTier = "first";
      } else if (idx < 24) {
        p.squadTier = "reserves";
      } else {
        p.squadTier = "academy";
      }
    });

    // Generate initial matchday lineup for this club
    const firstTeam = existing.filter(p => p.squadTier === "first");
    club.lineup = buildBestLineup(firstTeam);

    // Auto-select goal kicker (highest rated back)
    const kickers = firstTeam
      .filter(p => ["SCRUM_HALF", "STAND_OFF", "FULLBACK", "WING"].includes(p.position))
      .sort((a, b) => b.rating - a.rating);
    if (kickers[0]) {
      club.tactics.primaryGoalKickerId = kickers[0].id;
    }
  }

  // 4. Seed initial Free Agents market (18 free agents across positions)
  for (let i = 0; i < 18; i++) {
    const pos = STARTING_POSITIONS[i % STARTING_POSITIONS.length];
    const age = Math.floor(Math.random() * 12) + 21;
    const rating = Math.floor(Math.random() * 18) + 64; // 64 - 82 rating
    const pot = Math.max(rating, Math.min(88, rating + (age < 24 ? 6 : 1)));
    const fn = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const ln = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const fa = createGeneratedPlayer(`${fn} ${ln}`, pos, age, rating, pot, null, null, "super-league");
    players[fa.id] = fa;
  }

  // 5. Initialize competitions
  const slClubIds = slClubNames.map(toClubId);
  const champClubIds = champClubNames.map(toClubId);

  const superLeagueComp = generateFixturesForCompetition("super-league", "Super League", 1, slClubIds, 2026);
  const championshipComp = generateFixturesForCompetition("championship", "Championship", 2, champClubIds, 2026);
  const challengeCupComp = generateFixturesForCompetition("challenge-cup", "Challenge Cup", 0, [...slClubIds, ...champClubIds], 2026);
  const friendliesComp = generateFixturesForCompetition("friendlies", "Pre-Season Friendlies", 0, [chosenClubId], 2026);

  // 6. Assemble state
  const state: ManagerState = {
    version: 1,
    manager: {
      name: managerName,
      clubId: chosenClubId,
      reputation: 3,
      appointedSeason: 2026,
      trophiesWon: [],
      managerOfTheYearAwards: 0,
    },
    calendar: {
      currentSeason: 2026,
      currentWeek: 1,
      totalWeeks: CALENDAR_RULES.TOTAL_WEEKS,
      phase: "pre_season",
      processedWeekKeys: [],
    },
    clubs,
    players,
    competitions: {
      "super-league": superLeagueComp,
      "championship": championshipComp,
      "challenge-cup": challengeCupComp,
      "friendlies": friendliesComp,
    },
    transfers: {
      listedPlayerIds: [],
      activeBids: [],
      completedTransfers: [],
      activeLoans: [],
    },
    inbox: {
      messages: [
        {
          id: "welcome_board_msg",
          season: 2026,
          week: 1,
          dateStr: "1 Feb 2026",
          sender: "Board of Directors",
          subject: `Welcome to ${clubs[chosenClubId]?.name || "the Club"}`,
          body: `The board is delighted to confirm your appointment as Head Coach. We expect competitive performances and strict financial discipline under the salary cap. Good luck for the season ahead!`,
          category: "board",
          isRead: false,
        },
        {
          id: "preseason_prep_msg",
          season: 2026,
          week: 1,
          dateStr: "1 Feb 2026",
          sender: "Assistant Coach",
          subject: "Pre-Season Preparations & Squad Status",
          body: "Squad training is underway. You can adjust individual training focuses in the Training tab and test combinations in our pre-season friendlies over the next 2 weeks.",
          category: "general",
          isRead: false,
        },
      ],
      unreadCount: 2,
    },
    settings: {
      soundEnabled: true,
      autoSaveEnabled: true,
      currencySymbol: "£",
      matchSimulationSpeed: "normal",
    },
  };

  return state;
}
