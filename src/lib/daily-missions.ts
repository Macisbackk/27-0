/**
 * Daily Missions: three small goals per UK day, the same for everyone (seeded by the UK date key,
 * like the Daily Challenge), each paying Club Funds, plus a bonus for clearing all three.
 *
 * Progress comes from events the game already has at the end of a run or puzzle:
 *   reportMissionEvent({ kind: "season", ... })   — GameBoard, after the regular season
 *   reportMissionEvent({ kind: "playoffs", ... }) — GameBoard, after the play-off bracket
 *   reportMissionEvent({ kind: "wordle", ... })   — WordleGame settle
 *   reportMissionEvent({ kind: "grid", ... })     — GridGame settle
 * (Season events are built from the squad by seasonMissionEvent in daily-missions-season.ts, which
 * keeps the player database out of this module so the home card stays light.)
 *
 * Payouts go through the Club Funds ledger (awardClubFundsLines), which is idempotent per run id:
 *   mission:<dateKey>:<missionId>   and   missions-all:<dateKey>
 * so a mission pays once per account, even across devices once the ledger syncs. Per-day progress
 * lives in localStorage (DAILY_MISSIONS_STORAGE_KEY, per account via account-owner.ts).
 */
import type { GameMode } from "./types";
import type { ClubFundsEarnedLine, ClubFundsPayoutResult } from "./club-funds";
import { mergeClubFundsPayouts } from "./club-funds";
import { awardClubFundsLines, getPaidRunIds } from "./storage/club-funds";
import { getLocalDateKey } from "./mini-games/date";
import { SHOW_DAILY_CHALLENGE_UI } from "./feature-flags";

export const DAILY_MISSIONS_STORAGE_KEY = "27-0-daily-missions";
/** Fired on window whenever mission progress or payouts change (detail: DailyMissionsChangedDetail). */
export const DAILY_MISSIONS_CHANGED_EVENT = "27-0-daily-missions-changed";
export const DAILY_MISSIONS_PER_DAY = 3;
export const DAILY_MISSIONS_ALL_BONUS = 40_000;

/** Classic squad slot indices (positions.ts SLOT_DEFINITIONS): fullback, stand off, scrum half, hooker. */
export const SPINE_SLOT_INDICES = [0, 5, 6, 8] as const;
/** Spine players from one club needed for the "spine" mission. */
export const SPINE_CLUB_TARGET = 2;
/** Players needed from the named club for the "club-players" mission. */
export const CLUB_PLAYERS_TARGET = 2;

// ---------------------------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------------------------

export type MissionEvent =
  | {
      /** A Classic / Era regular season finished (GameBoard finalizeRegularSeason). */
      kind: "season";
      mode: GameMode;
      era: boolean;
      daily: boolean;
      /** Joe Mellor / Super Sam hidden runs: never count. */
      hidden: boolean;
      wins: number;
      losses: number;
      leaguePosition: number;
      pointsDifference: number;
      chemistryLinks: number;
      /** Canonical club name (lower case) of the player in each slot index 0–12, null if empty. */
      clubsBySlot: (string | null)[];
    }
  | {
      /** The play-off bracket finished (GameBoard handlePlayoffBracketComplete). */
      kind: "playoffs";
      mode: GameMode;
      hidden: boolean;
      champion: boolean;
    }
  | { kind: "wordle"; won: boolean }
  | {
      /** A grid finished. Only today's daily grid counts. */
      kind: "grid";
      daily: boolean;
      /** Correct cells (0–9). */
      score: number;
    };

type SeasonEvent = Extract<MissionEvent, { kind: "season" }>;

function countedSeason(event: MissionEvent): SeasonEvent | null {
  return event.kind === "season" && event.mode === "CLASSIC" && !event.hidden ? event : null;
}

// ---------------------------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------------------------

export type MissionCategory = "result" | "squad" | "puzzle" | "play";
export type MissionParam = number | string | null;

export interface DailyMissionTemplate {
  id: string;
  category: MissionCategory;
  /** Parameter options; one is picked per day. [null] for templates without a parameter. */
  params: readonly MissionParam[];
  title: (param: MissionParam) => string;
  reward: (param: MissionParam) => number;
  target: (param: MissionParam) => number;
  /** "max": best single event counts. "sum": events add up over the day. */
  accumulate: "max" | "sum";
  /** Progress this event earns (null when the event is irrelevant). */
  measure: (event: MissionEvent, param: MissionParam) => number | null;
  enabled?: boolean;
}

const num = (p: MissionParam) => (typeof p === "number" ? p : 0);
const str = (p: MissionParam) => (typeof p === "string" ? p : "");
const flag = (b: boolean) => (b ? 1 : 0);

/** Clubs for "field N players from X": sides present in both the Current and Era spin pools. */
export const MISSION_CLUBS = [
  "Wigan Warriors",
  "St Helens",
  "Leeds Rhinos",
  "Warrington Wolves",
  "Hull FC",
  "Hull KR",
  "Catalans Dragons",
  "Castleford Tigers",
  "Huddersfield Giants",
  "Wakefield Trinity",
] as const;

export const DAILY_MISSION_TEMPLATES: readonly DailyMissionTemplate[] = [
  // --- Results -------------------------------------------------------------------------------
  {
    id: "win-games",
    category: "result",
    params: [18, 21, 24],
    title: (p) => `Win ${num(p)} games in a Classic season`,
    reward: (p) => (num(p) >= 24 ? 30_000 : num(p) >= 21 ? 20_000 : 15_000),
    target: () => 1,
    accumulate: "max",
    measure: (e, p) => {
      const s = countedSeason(e);
      return s ? flag(s.wins >= num(p)) : null;
    },
  },
  {
    id: "top-table",
    category: "result",
    params: [null],
    title: () => "Finish top of the table",
    reward: () => 25_000,
    target: () => 1,
    accumulate: "max",
    measure: (e) => {
      const s = countedSeason(e);
      return s ? flag(s.leaguePosition === 1) : null;
    },
  },
  {
    id: "grand-final",
    category: "result",
    params: [null],
    title: () => "Win the Grand Final",
    reward: () => 30_000,
    target: () => 1,
    accumulate: "max",
    measure: (e) =>
      e.kind === "playoffs" && e.mode === "CLASSIC" && !e.hidden ? flag(e.champion) : null,
  },
  {
    id: "make-playoffs",
    category: "result",
    params: [null],
    title: () => "Finish in the top six",
    reward: () => 15_000,
    target: () => 1,
    accumulate: "max",
    measure: (e) => {
      const s = countedSeason(e);
      return s ? flag(s.leaguePosition <= 6) : null;
    },
  },
  {
    id: "few-losses",
    category: "result",
    params: [5, 3],
    title: (p) => `Lose ${num(p)} or fewer games in a season`,
    reward: (p) => (num(p) <= 3 ? 25_000 : 20_000),
    target: () => 1,
    accumulate: "max",
    measure: (e, p) => {
      const s = countedSeason(e);
      return s ? flag(s.losses <= num(p)) : null;
    },
  },
  {
    id: "points-diff",
    category: "result",
    params: [300, 450],
    title: (p) => `Finish a season +${num(p)} on points difference`,
    reward: (p) => (num(p) >= 450 ? 25_000 : 20_000),
    target: () => 1,
    accumulate: "max",
    measure: (e, p) => {
      const s = countedSeason(e);
      return s ? flag(s.pointsDifference >= num(p)) : null;
    },
  },
  // --- Squad -----------------------------------------------------------------------------------
  {
    id: "chemistry",
    category: "squad",
    params: [1, 2, 3],
    title: (p) => `Get ${num(p)} chemistry link${num(p) === 1 ? "" : "s"} in a season`,
    reward: (p) => (num(p) >= 3 ? 30_000 : num(p) === 2 ? 20_000 : 15_000),
    target: (p) => num(p),
    accumulate: "max",
    measure: (e) => countedSeason(e)?.chemistryLinks ?? null,
  },
  {
    id: "spine",
    category: "squad",
    params: [null],
    title: () => `Field ${SPINE_CLUB_TARGET} of your spine (FB, halves, hooker) from one club`,
    reward: () => 25_000,
    target: () => SPINE_CLUB_TARGET,
    accumulate: "max",
    measure: (e) => {
      const s = countedSeason(e);
      if (!s) return null;
      const counts = new Map<string, number>();
      for (const slot of SPINE_SLOT_INDICES) {
        const club = s.clubsBySlot[slot];
        if (club) counts.set(club, (counts.get(club) ?? 0) + 1);
      }
      return Math.max(0, ...counts.values());
    },
  },
  {
    id: "club-players",
    category: "squad",
    params: MISSION_CLUBS,
    title: (p) => `Field ${CLUB_PLAYERS_TARGET} ${str(p)} players in a season`,
    reward: () => 20_000,
    target: () => CLUB_PLAYERS_TARGET,
    accumulate: "max",
    measure: (e, p) => {
      const s = countedSeason(e);
      if (!s) return null;
      const want = str(p).toLowerCase();
      return s.clubsBySlot.filter((c) => c === want).length;
    },
  },
  // --- Puzzles ---------------------------------------------------------------------------------
  {
    id: "wordle-win",
    category: "puzzle",
    params: [null],
    title: () => "Win a Rugby League Wordle",
    reward: () => 15_000,
    target: () => 1,
    accumulate: "max",
    measure: (e) => (e.kind === "wordle" ? flag(e.won) : null),
  },
  {
    id: "grid-finish",
    category: "puzzle",
    params: [null],
    title: () => "Finish today's Rugby League Grid",
    reward: () => 15_000,
    target: () => 1,
    accumulate: "max",
    measure: (e) => (e.kind === "grid" && e.daily ? 1 : null),
  },
  {
    id: "grid-score",
    category: "puzzle",
    params: [6, 8],
    title: (p) => `Fill ${num(p)} squares on today's Grid`,
    reward: (p) => (num(p) >= 8 ? 25_000 : 20_000),
    target: (p) => num(p),
    accumulate: "max",
    measure: (e) => (e.kind === "grid" && e.daily ? e.score : null),
  },
  // --- Play --------------------------------------------------------------------------------------
  {
    id: "daily-challenge",
    category: "play",
    params: [null],
    title: () => "Play today's Daily Challenge",
    reward: () => 15_000,
    target: () => 1,
    accumulate: "max",
    measure: (e) => {
      const s = countedSeason(e);
      return s ? flag(s.daily) : null;
    },
    enabled: SHOW_DAILY_CHALLENGE_UI,
  },
  {
    id: "era-run",
    category: "play",
    params: [null],
    title: () => "Finish an Era Classic season",
    reward: () => 15_000,
    target: () => 1,
    accumulate: "max",
    measure: (e) => {
      const s = countedSeason(e);
      return s ? flag(s.era) : null;
    },
  },
  {
    id: "seasons-played",
    category: "play",
    params: [2, 3],
    title: (p) => `Finish ${num(p)} Classic seasons`,
    reward: (p) => (num(p) >= 3 ? 20_000 : 15_000),
    target: (p) => num(p),
    accumulate: "sum",
    measure: (e) => (countedSeason(e) ? 1 : null),
  },
];

// ---------------------------------------------------------------------------------------------
// Daily selection
// ---------------------------------------------------------------------------------------------

export interface DailyMission {
  /** Template id (unique within a day). */
  id: string;
  templateId: string;
  category: MissionCategory;
  param: MissionParam;
  title: string;
  reward: number;
  target: number;
  accumulate: "max" | "sum";
}

export function buildDailyMission(template: DailyMissionTemplate, param: MissionParam): DailyMission {
  return {
    id: template.id,
    templateId: template.id,
    category: template.category,
    param,
    title: template.title(param),
    reward: template.reward(param),
    target: Math.max(1, template.target(param)),
    accumulate: template.accumulate,
  };
}

const SELECTION_SALT = "27-0-missions-v1";

function hashString(value: string): number {
  const seeded = `${SELECTION_SALT}:${value}`;
  let h = 2166136261;
  for (let i = 0; i < seeded.length; i++) {
    h ^= seeded.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rngFor(dateKey: string): () => number {
  let state = hashString(dateKey) || 1;
  return () => {
    // xorshift32, same family as the Daily Challenge rotation.
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/**
 * Today's three missions: three different categories (results / squad / puzzle / play), one
 * template from each, parameters picked from the template's options. Pure function of the date key.
 */
export function getDailyMissions(dateKey: string = getLocalDateKey()): DailyMission[] {
  const rng = rngFor(dateKey);
  const enabled = DAILY_MISSION_TEMPLATES.filter((t) => t.enabled !== false);
  const categories = shuffle(
    [...new Set(enabled.map((t) => t.category))],
    rng
  ).slice(0, DAILY_MISSIONS_PER_DAY);
  return categories.map((category) => {
    const options = enabled.filter((t) => t.category === category);
    const template = options[Math.floor(rng() * options.length)]!;
    const param = template.params[Math.floor(rng() * template.params.length)] ?? null;
    return buildDailyMission(template, param);
  });
}

export function getMissionTemplate(id: string): DailyMissionTemplate | undefined {
  return DAILY_MISSION_TEMPLATES.find((t) => t.id === id);
}

/** Progress this event earns towards `mission` (null when irrelevant). */
export function measureMission(mission: DailyMission, event: MissionEvent): number | null {
  const template = getMissionTemplate(mission.templateId);
  if (!template) return null;
  const value = template.measure(event, mission.param);
  return value === null || !Number.isFinite(value) ? null : Math.max(0, value);
}

/** Progress after `event` (clamped to the target). */
export function applyMissionEvent(mission: DailyMission, current: number, event: MissionEvent): number {
  const value = measureMission(mission, event);
  if (value === null) return current;
  const next = mission.accumulate === "sum" ? current + value : Math.max(current, value);
  return Math.min(mission.target, next);
}

export const missionRunId = (dateKey: string, missionId: string) => `mission:${dateKey}:${missionId}`;
export const missionsAllRunId = (dateKey: string) => `missions-all:${dateKey}`;

// ---------------------------------------------------------------------------------------------
// Storage + payouts
// ---------------------------------------------------------------------------------------------

interface StoredProgress {
  dateKey: string;
  progress: Record<string, number>;
}

function loadProgress(dateKey: string): StoredProgress {
  const empty: StoredProgress = { dateKey, progress: {} };
  if (typeof window === "undefined") return empty;
  try {
    const raw = localStorage.getItem(DAILY_MISSIONS_STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<StoredProgress>;
    if (parsed.dateKey !== dateKey || !parsed.progress || typeof parsed.progress !== "object") {
      return empty;
    }
    const progress: Record<string, number> = {};
    for (const [id, value] of Object.entries(parsed.progress)) {
      if (typeof value === "number" && Number.isFinite(value) && value > 0) progress[id] = value;
    }
    return { dateKey, progress };
  } catch {
    return empty;
  }
}

function saveProgress(state: StoredProgress): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DAILY_MISSIONS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked: the ledger still stops a double pay */
  }
}

export interface DailyMissionStatus extends DailyMission {
  progress: number;
  complete: boolean;
  paid: boolean;
}

export interface DailyMissionsView {
  dateKey: string;
  missions: DailyMissionStatus[];
  bonus: { amount: number; complete: boolean; paid: boolean };
}

export function getDailyMissionsView(now: Date = new Date()): DailyMissionsView {
  const dateKey = getLocalDateKey(now);
  const state = loadProgress(dateKey);
  const paidIds = new Set(getPaidRunIds());
  const missions = getDailyMissions(dateKey).map((mission) => {
    const paid = paidIds.has(missionRunId(dateKey, mission.id));
    const progress = paid ? mission.target : Math.min(mission.target, state.progress[mission.id] ?? 0);
    return { ...mission, progress, paid, complete: paid || progress >= mission.target };
  });
  return {
    dateKey,
    missions,
    bonus: {
      amount: DAILY_MISSIONS_ALL_BONUS,
      complete: missions.every((m) => m.complete),
      paid: paidIds.has(missionsAllRunId(dateKey)),
    },
  };
}

export interface MissionCompletion {
  missionId: string;
  title: string;
  reward: number;
}

export interface DailyMissionsChangedDetail {
  dateKey: string;
  /** Missions paid by this report (empty when only progress moved). */
  completed: MissionCompletion[];
  /** All-three bonus paid by this report (0 when not). */
  bonus: number;
}

export interface MissionReportResult {
  completed: MissionCompletion[];
  bonus: number;
  /** Lines paid by this report, ready to merge into a ClubFundsEarned payout (null when none). */
  payout: ClubFundsPayoutResult | null;
}

/**
 * Pay every finished-but-unpaid mission for the day, then the all-three bonus. Safe to call any
 * time: the ledger refuses a run id it has already paid.
 */
function settleMissions(dateKey: string): MissionReportResult {
  const view = getDailyMissionsView(dateFromKey(dateKey));
  const payouts: ClubFundsPayoutResult[] = [];
  const completed: MissionCompletion[] = [];
  for (const mission of view.missions) {
    if (mission.paid || mission.progress < mission.target) continue;
    const line: ClubFundsEarnedLine = {
      id: `mission-${mission.id}`,
      label: `Daily mission: ${mission.title}`,
      amount: mission.reward,
    };
    const payout = awardClubFundsLines(missionRunId(dateKey, mission.id), [line]);
    if (payout.awarded) {
      payouts.push(payout);
      completed.push({ missionId: mission.id, title: mission.title, reward: mission.reward });
    }
  }
  let bonus = 0;
  const paidIds = new Set(getPaidRunIds());
  const allPaid = view.missions.every((m) => paidIds.has(missionRunId(dateKey, m.id)));
  if (allPaid && !paidIds.has(missionsAllRunId(dateKey))) {
    const payout = awardClubFundsLines(missionsAllRunId(dateKey), [
      { id: "missions-all", label: "Daily missions: all three done", amount: DAILY_MISSIONS_ALL_BONUS },
    ]);
    if (payout.awarded) {
      payouts.push(payout);
      bonus = DAILY_MISSIONS_ALL_BONUS;
    }
  }
  return { completed, bonus, payout: mergeClubFundsPayouts(...payouts) };
}

/** Noon UTC on the key's date: always inside that UK day, whatever the clocks are doing. */
function dateFromKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 12));
}

/**
 * Record a finished run / puzzle against today's missions and pay anything it completes.
 * Never throws: missions are a bonus and must not break the end of a run.
 */
export function reportMissionEvent(event: MissionEvent, now: Date = new Date()): MissionReportResult {
  const none: MissionReportResult = { completed: [], bonus: 0, payout: null };
  if (typeof window === "undefined") return none;
  try {
    const dateKey = getLocalDateKey(now);
    const state = loadProgress(dateKey);
    let moved = false;
    for (const mission of getDailyMissions(dateKey)) {
      const before = state.progress[mission.id] ?? 0;
      const after = applyMissionEvent(mission, before, event);
      if (after !== before) {
        state.progress[mission.id] = after;
        moved = true;
      }
    }
    if (moved) saveProgress(state);
    const result = settleMissions(dateKey);
    if (moved || result.completed.length > 0 || result.bonus > 0) {
      const detail: DailyMissionsChangedDetail = {
        dateKey,
        completed: result.completed,
        bonus: result.bonus,
      };
      window.dispatchEvent(new CustomEvent(DAILY_MISSIONS_CHANGED_EVENT, { detail }));
    }
    return result;
  } catch (error) {
    console.error("[missions] report failed", error);
    return none;
  }
}
