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
import { assignGoalKicking, pickBestGoalKicker } from "./goal-kicking";
import {
  STARTING_POSITIONS,
  CALENDAR_RULES,
  SALARY_CAP,
  CHAMPIONSHIP_ECONOMY,
  DEVELOPMENT_SQUAD_SIZE,
  calculateMarketWage,
} from "./rules";
import { FIRST_NAMES, LAST_NAMES, generateRandomPlayerName } from "./names";
export { FIRST_NAMES, LAST_NAMES, generateRandomPlayerName };
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
  "Featherstone Rovers": { name: "Millennium Stadium", capacity: 9850 },
  "Dewsbury Rams": { name: "Flair Stadium", capacity: 5100 },
  "Swinton Lions": { name: "Heywood Road", capacity: 3387 },
  "Keighley Cougars": { name: "Cougar Park", capacity: 7800 },
  "Rochdale Hornets": { name: "Crown Oil Arena", capacity: 10249 },
  "Workington Town": { name: "Derwent Park", capacity: 10000 },
  "Midlands Hurricanes": { name: "Alexander Stadium", capacity: 18000 },
  "North Wales Crusaders": { name: "Stadiwm CSM", capacity: 5500 },
  "Goole Vikings": { name: "Victoria Pleasure Ground", capacity: 3000 },
  "Cornwall RLFC": { name: "The Memorial Ground", capacity: 4000 },
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
  "Featherstone Rovers": { primary: "#0B2A5B", secondary: "#FFFFFF", accent: "#D4AF37", text: "#FFFFFF" },
  "Dewsbury Rams": { primary: "#C8102E", secondary: "#F5A623", accent: "#111111", text: "#FFFFFF" },
  "Swinton Lions": { primary: "#1E4D9B", secondary: "#FFFFFF", accent: "#0B2A5B", text: "#FFFFFF" },
  "Keighley Cougars": { primary: "#C8102E", secondary: "#1B7A3E", accent: "#FFFFFF", text: "#FFFFFF" },
  "Rochdale Hornets": { primary: "#C8102E", secondary: "#FFFFFF", accent: "#1E4D9B", text: "#FFFFFF" },
  "Workington Town": { primary: "#1E5AA8", secondary: "#FFFFFF", accent: "#0B2A5B", text: "#FFFFFF" },
  "Midlands Hurricanes": { primary: "#5B2C8A", secondary: "#F5C518", accent: "#111111", text: "#FFFFFF" },
  "North Wales Crusaders": { primary: "#C8102E", secondary: "#FFFFFF", accent: "#1B7A3E", text: "#FFFFFF" },
  "Goole Vikings": { primary: "#B71C1C", secondary: "#111111", accent: "#FFFFFF", text: "#FFFFFF" },
  "Cornwall RLFC": { primary: "#111111", secondary: "#D4AF37", accent: "#FFFFFF", text: "#FFFFFF" },
};

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
  competitionId: CompetitionId = "championship",
  overrideNationality?: string
): ManagerPlayer {
  const id = generateUniquePlayerId(clubId ? clubId.slice(0, 4) : "fa");
  const birthYear = 2026 - age;
  const month = Math.floor(Math.random() * 12) + 1;
  const day = Math.floor(Math.random() * 28) + 1;
  const dob = `${birthYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const clampedRating = Math.max(40, Math.min(99, Math.round(rating)));
  const clampedPot = Math.max(clampedRating, Math.min(99, Math.round(potential)));
  const wage = calculateMarketWage(clampedRating, age, competitionId);

  const defaultNat = Math.random() < 0.85 ? "England" : (Math.random() < 0.5 ? "Australia" : "New Zealand");

  return {
    id,
    name,
    dob,
    age,
    nationality: overrideNationality || defaultNat,
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
    academyProductOfClubId: squadTier === "academy" && clubId ? clubId : null,
    goalKicking: assignGoalKicking(id, pos, false),
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
  // Canonical 14 Championship clubs (26-round regular season)
  const defaultChampClubNames = [
    "Salford RLFC",
    "London Broncos",
    "Featherstone Rovers",
    "Widnes Vikings",
    "Halifax Panthers",
    "Sheffield Eagles",
    "Oldham RLFC",
    "Doncaster RLFC",
    "Barrow Raiders",
    "Batley Bulldogs",
    "Dewsbury Rams",
    "Swinton Lions",
    "Hunslet RLFC",
    "Whitehaven RLFC",
  ];

  let champClubNames = [...defaultChampClubNames];
  // If user chose a Championship club outside the default 14, include them in the league!
  const chosenChampName = Object.keys(CHAMPIONSHIP_CLUB_REPUTATION_BY_NAME).find(
    (name) => toClubId(name) === chosenClubId
  );
  if (chosenChampName && !champClubNames.includes(chosenChampName)) {
    champClubNames[champClubNames.length - 1] = chosenChampName;
  }

  // Helper to init club record
  function initClub(name: string, compId: CompetitionId, stars: number): ManagerClub {
    const id = toClubId(name);
    const stadium = STADIUMS[name] || { name: `${name} Stadium`, capacity: 10000 };
    const colors = CLUB_COLORS[name] || { primary: "#1E4D9B", secondary: "#FFFFFF", accent: "#111111", text: "#FFFFFF" };
    const shortName = name.split(" ")[0];
    const abbreviation = (name.split(" ").map(w => w[0]).join("") + "RL").slice(0, 3).toUpperCase();

    const isSL = compId === "super-league";
    const baseBudget = isSL
      ? stars >= 4
        ? 350000
        : 150000
      : stars === 3
        ? CHAMPIONSHIP_ECONOMY.STARTING_BALANCE_TOP
        : CHAMPIONSHIP_ECONOMY.STARTING_BALANCE_DEFAULT;
    const wageCap = isSL ? SALARY_CAP["super-league"].weeklyCap : SALARY_CAP["championship"].weeklyCap;

    const finances: ClubFinances = {
      balance: baseBudget,
      wageBudgetWeekly: wageCap,
      transferBudget: Math.round(baseBudget * (isSL ? 0.7 : 0.4)),
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
      medical: Math.min(5, Math.max(1, stars)),
      performance: Math.min(5, Math.max(1, stars)),
      analytics: Math.min(5, Math.max(1, isSL ? stars : stars - 1 || 1)),
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
      goalKicking: assignGoalKicking(raw.id, pos, true),
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

  // 3. Ensure every club has a complete squad across First Team (20+), Reserves (5), and Academy (5)
  // All real players imported from current-squads.json are senior First Team squad members.
  for (const [clubId, club] of Object.entries(clubs)) {
    const isSL = club.competitionId === "super-league";
    const baseStrength = isSL ? (club.reputation >= 4 ? 78 : 72) : (club.reputation === 3 ? 68 : 62);

    // All real players imported from current-squads.json are senior First Team squad members
    const clubFirstTeam = clubPlayersMap[clubId] || [];

    // Ensure First Team has at least 20 players (for Championship or clubs with small imported squads)
    if (clubFirstTeam.length < 20) {
      const neededFirst = 20 - clubFirstTeam.length;
      for (let i = 0; i < neededFirst; i++) {
        const pos = STARTING_POSITIONS[i % STARTING_POSITIONS.length];
        const age = Math.floor(Math.random() * 8) + 21;
        const rating = Math.max(55, Math.round(baseStrength - 2 + (Math.random() * 6 - 3)));
        const potential = Math.min(94, Math.max(rating, rating + Math.floor(Math.random() * 4)));

        const { fullName, nationality } = generateRandomPlayerName(clubId);
        const genPlayer = createGeneratedPlayer(
          fullName,
          pos,
          age,
          rating,
          potential,
          clubId,
          "first",
          club.competitionId,
          nationality
        );

        players[genPlayer.id] = genPlayer;
        clubFirstTeam.push(genPlayer);
      }
    }

    // Every club starts with a full Reserves grade (17 players, ages 20-25)
    for (let i = 0; i < 17; i++) {
      const pos = STARTING_POSITIONS[(i + 3) % STARTING_POSITIONS.length];
      const age = Math.floor(Math.random() * 6) + 20;
      const rating = Math.max(50, Math.round(baseStrength - 6 + (Math.random() * 6 - 3)));
      const potential = Math.min(88, Math.round(rating + Math.random() * 6));

      const { fullName, nationality } = generateRandomPlayerName(clubId);
      const genReserve = createGeneratedPlayer(
        fullName,
        pos,
        age,
        rating,
        potential,
        clubId,
        "reserves",
        club.competitionId,
        nationality
      );

      players[genReserve.id] = genReserve;
    }

    // Every club starts with a full Academy grade (17 players, ages 17-19, high upside)
    for (let i = 0; i < 17; i++) {
      const pos = STARTING_POSITIONS[(i + 5) % STARTING_POSITIONS.length];
      const age = Math.floor(Math.random() * 3) + 17;
      const rating = Math.max(48, Math.round(baseStrength - 13 + (Math.random() * 6 - 3)));
      const potential = Math.min(94, Math.round(rating + 14 + Math.random() * 10));

      const { fullName, nationality } = generateRandomPlayerName(clubId);
      const genAcademy = createGeneratedPlayer(
        fullName,
        pos,
        age,
        rating,
        potential,
        clubId,
        "academy",
        club.competitionId,
        nationality
      );

      players[genAcademy.id] = genAcademy;
    }

    // Generate initial matchday lineup for this club from First Team
    const firstTeam = Object.values(players).filter(p => p.clubId === clubId && p.squadTier === "first");
    club.lineup = buildBestLineup(firstTeam);

    // Auto-select goal kicker (best hidden goal-kicking ability; never props)
    const bestKicker = pickBestGoalKicker(firstTeam);
    if (bestKicker) {
      club.tactics.primaryGoalKickerId = bestKicker.id;
    }
  }

  // 4. Seed initial Free Agents market (18 free agents across positions)
  for (let i = 0; i < 18; i++) {
    const pos = STARTING_POSITIONS[i % STARTING_POSITIONS.length];
    const age = Math.floor(Math.random() * 12) + 21;
    const rating = Math.floor(Math.random() * 18) + 64; // 64 - 82 rating
    const pot = Math.max(rating, Math.min(88, rating + (age < 24 ? 6 : 1)));
    const { fullName, nationality } = generateRandomPlayerName(null);
    const fa = createGeneratedPlayer(fullName, pos, age, rating, pot, null, null, "super-league", nationality);
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
      pendingLoanOffers: [],
    },
    seasonHistory: [],
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

  return ensureClubSquadDepth(state);
}

/**
 * Guarantees healthy squad depth across First Team, Reserves, and Academy (17 each).
 * Short development grades are auto-filled so both can field a full matchday 17.
 */
export function ensureClubSquadDepth(
  state: ManagerState,
  targetClubId?: string
): ManagerState {
  const clubsToInspect = targetClubId
    ? [state.clubs[targetClubId]].filter(Boolean)
    : Object.values(state.clubs);

  let newPlayers = { ...state.players };
  let updatedAny = false;

  for (const club of clubsToInspect) {
    const clubId = club.id;
    const isSL = club.competitionId === "super-league";
    const baseStrength = isSL
      ? (club.reputation >= 4 ? 78 : 72)
      : (club.reputation === 3 ? 68 : 62);

    const clubPlayers = Object.values(newPlayers).filter(
      (p) => p.clubId === clubId && !p.isRetired
    );

    // 0. Sanitize any displaced first-teamers mistakenly placed in academy or reserves
    for (const p of clubPlayers) {
      if (p.squadTier === "academy") {
        // Adult (>21) or player with first_team/star contract or high senior rating in academy
        if (
          p.age > 21 ||
          p.contract?.role === "star" ||
          p.contract?.role === "first_team" ||
          (isSL ? p.rating >= 76 : p.rating >= 68)
        ) {
          newPlayers[p.id] = { ...p, squadTier: "first" };
          updatedAny = true;
        }
      } else if (p.squadTier === "reserves") {
        // Senior star or key first_team player in reserves from previous bad tier slice
        if (
          p.contract?.role === "star" ||
          p.contract?.role === "first_team" ||
          (isSL ? p.rating >= 78 : p.rating >= 72)
        ) {
          newPlayers[p.id] = { ...p, squadTier: "first" };
          updatedAny = true;
        }
      }
    }

    const currentClubPlayers = Object.values(newPlayers).filter(
      (p) => p.clubId === clubId && !p.isRetired
    );

    const firstTeam = currentClubPlayers.filter((p) => p.squadTier === "first");
    const reserves = currentClubPlayers.filter((p) => p.squadTier === "reserves");
    const academy = currentClubPlayers.filter((p) => p.squadTier === "academy");

    // 1. Ensure First Team has at least 17 players (can field a full matchday 17)
    if (firstTeam.length < DEVELOPMENT_SQUAD_SIZE) {
      const needed = DEVELOPMENT_SQUAD_SIZE - firstTeam.length;
      for (let i = 0; i < needed; i++) {
        const pos = STARTING_POSITIONS[i % STARTING_POSITIONS.length];
        const age = Math.floor(Math.random() * 8) + 21;
        const rating = Math.max(55, Math.round(baseStrength - 2 + (Math.random() * 6 - 3)));
        const potential = Math.min(94, Math.max(rating, rating + Math.floor(Math.random() * 4)));
        const { fullName, nationality } = generateRandomPlayerName(clubId);
        const p = createGeneratedPlayer(
          fullName,
          pos,
          age,
          rating,
          potential,
          clubId,
          "first",
          club.competitionId,
          nationality
        );
        newPlayers[p.id] = p;
        updatedAny = true;
      }
    }

    // 2. Ensure Reserves has a full grade of 17
    if (reserves.length < DEVELOPMENT_SQUAD_SIZE) {
      const needed = DEVELOPMENT_SQUAD_SIZE - reserves.length;
      for (let i = 0; i < needed; i++) {
        const pos = STARTING_POSITIONS[(i + 3) % STARTING_POSITIONS.length];
        const age = Math.floor(Math.random() * 6) + 20;
        const rating = Math.max(52, Math.round(baseStrength - 5 + (Math.random() * 6 - 3)));
        const potential = Math.min(90, Math.round(rating + Math.random() * 5));
        const { fullName, nationality } = generateRandomPlayerName(clubId);
        const p = createGeneratedPlayer(
          fullName,
          pos,
          age,
          rating,
          potential,
          clubId,
          "reserves",
          club.competitionId,
          nationality
        );
        newPlayers[p.id] = p;
        updatedAny = true;
      }
    }

    // 3. Ensure Academy has a full grade of 17
    if (academy.length < DEVELOPMENT_SQUAD_SIZE) {
      const needed = DEVELOPMENT_SQUAD_SIZE - academy.length;
      for (let i = 0; i < needed; i++) {
        const pos = STARTING_POSITIONS[(i + 5) % STARTING_POSITIONS.length];
        const age = Math.floor(Math.random() * 3) + 17;
        const rating = Math.max(48, Math.round(baseStrength - 12 + (Math.random() * 6 - 3)));
        const potential = Math.min(94, Math.round(rating + 14 + Math.random() * 10));
        const { fullName, nationality } = generateRandomPlayerName(clubId);
        const p = createGeneratedPlayer(
          fullName,
          pos,
          age,
          rating,
          potential,
          clubId,
          "academy",
          club.competitionId,
          nationality
        );
        newPlayers[p.id] = p;
        updatedAny = true;
      }
    }
  }

  // Backfill academy graduate flags for current academy members (legacy saves)
  for (const [id, p] of Object.entries(newPlayers)) {
    if (p.squadTier === "academy" && p.clubId && !p.academyProductOfClubId) {
      newPlayers[id] = { ...p, academyProductOfClubId: p.clubId };
      updatedAny = true;
    }
    if (typeof p.goalKicking !== "number") {
      newPlayers[id] = {
        ...newPlayers[id],
        goalKicking: assignGoalKicking(id, p.position, true),
      };
      updatedAny = true;
    }
  }

  if (!updatedAny) return state;

  return {
    ...state,
    players: newPlayers,
  };
}
