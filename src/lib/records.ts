/**
 * Records page (/records): pure derivation from lifetime stats (cloud-synced buckets), the local
 * run history (storage/run-history.ts) and the Squad Book. Tests: scripts/test-social.ts.
 */
import type { UserStatsData } from "./types";
import type { SquadBookState } from "./squad-book";

export type RunHistoryVariant = "classic" | "era" | "daily" | "weekly" | "ballKnower";

export interface RunHistoryCard {
  slot: number;
  label: string;
  id: string;
  name: string;
  club: string;
  year: number | null;
  rating: number;
}

export interface RunHistoryEntry {
  id: string;
  /** Finished (epoch ms). */
  at: number;
  variant: RunHistoryVariant;
  wins: number;
  losses: number;
  position: number;
  perfect: boolean;
  /** Longest regular-season win streak. */
  winStreak: number;
  playoffWins: number;
  playoffLosses: number;
  /** Play-off finish label; null until the play-offs are done (or when missed). */
  finish: string | null;
  /** Average squad rating. */
  rating: number;
  squad: RunHistoryCard[];
}

export const RUN_HISTORY_LIMIT = 60;

const FINISH_RANK: Record<string, number> = {
  "Super League Champions": 4,
  "Grand Final Runner-Up": 3,
  "Eliminated in Semi-Final": 2,
  "Eliminated in Eliminator": 1,
};

export function finishRank(finish: string | null | undefined): number {
  return finish ? (FINISH_RANK[finish] ?? 0) : 0;
}

/** Best result first: title > deeper play-off run > more wins > higher finish > better squad. */
export function compareRunsByResult(a: RunHistoryEntry, b: RunHistoryEntry): number {
  return (
    finishRank(b.finish) - finishRank(a.finish) ||
    b.wins - a.wins ||
    a.position - b.position ||
    b.rating - a.rating ||
    a.at - b.at
  );
}

export function compareRunsByRating(a: RunHistoryEntry, b: RunHistoryEntry): number {
  return b.rating - a.rating || compareRunsByResult(a, b);
}

/**
 * Add or update one run (pure). The history keeps the most recent runs plus the best-result and
 * highest-rated ones, so the records survive a long losing streak of new entries.
 */
export function upsertRunHistory(
  history: readonly RunHistoryEntry[],
  entry: RunHistoryEntry,
  limit = RUN_HISTORY_LIMIT
): RunHistoryEntry[] {
  const existing = history.find((h) => h.id === entry.id);
  const merged = existing ? { ...existing, ...entry, squad: entry.squad.length ? entry.squad : existing.squad } : entry;
  const rest = history.filter((h) => h.id !== entry.id);
  const all = [...rest, merged].sort((a, b) => a.at - b.at);
  if (all.length <= limit) return all;
  const keep = new Set<string>([
    ...[...all].sort(compareRunsByResult).slice(0, 5).map((h) => h.id),
    ...[...all].sort(compareRunsByRating).slice(0, 5).map((h) => h.id),
  ]);
  const recent = all.filter((h) => !keep.has(h.id)).slice(-(limit - keep.size));
  return all.filter((h) => keep.has(h.id) || recent.includes(h));
}

/** Tolerant parse of the stored history (anything malformed is dropped). */
export function normalizeRunHistory(raw: unknown): RunHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: RunHistoryEntry[] = [];
  const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const variants: RunHistoryVariant[] = ["classic", "era", "daily", "weekly", "ballKnower"];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const e = r as Partial<RunHistoryEntry>;
    if (typeof e.id !== "string" || !e.id) continue;
    const squad = Array.isArray(e.squad)
      ? e.squad
          .filter((c): c is RunHistoryCard => Boolean(c && typeof c === "object" && typeof c.id === "string" && typeof c.name === "string"))
          .map((c) => ({
            slot: num(c.slot),
            label: typeof c.label === "string" ? c.label : "",
            id: c.id,
            name: c.name,
            club: typeof c.club === "string" ? c.club : "",
            year: typeof c.year === "number" ? c.year : null,
            rating: num(c.rating),
          }))
      : [];
    out.push({
      id: e.id,
      at: num(e.at),
      variant: variants.includes(e.variant as RunHistoryVariant) ? (e.variant as RunHistoryVariant) : "classic",
      wins: num(e.wins),
      losses: num(e.losses),
      position: num(e.position, 12),
      perfect: e.perfect === true,
      winStreak: num(e.winStreak),
      playoffWins: num(e.playoffWins),
      playoffLosses: num(e.playoffLosses),
      finish: typeof e.finish === "string" ? e.finish : null,
      rating: num(e.rating),
      squad,
    });
  }
  return out;
}

export interface RecordLine {
  wins: number;
  losses: number;
  playoffWins: number;
  playoffLosses: number;
  seasons: number;
}

export interface MostDraftedPlayer {
  id: string;
  name: string;
  club: string;
  year: number | null;
  times: number;
}

export interface RecordsSummary {
  /** Classic + Era + Ball Knower (Daily / Weekly runs are kept out of lifetime stats). */
  allTime: RecordLine;
  byMode: { classic: RecordLine; era: RecordLine; ballKnower: RecordLine };
  bestSeason: { wins: number; losses: number } | null;
  longestWinStreak: number;
  perfectSeasons: number;
  titles: number;
  leagueLeaders: number;
  mostDrafted: MostDraftedPlayer[];
  bestRun: RunHistoryEntry | null;
  highestRatedRun: RunHistoryEntry | null;
  runsTracked: number;
}

type StatsLike = Partial<UserStatsData> | null | undefined;

/** A stored stat as a safe non-negative number (storage can be hand-edited / corrupted). */
function n(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
}

function line(s: StatsLike): RecordLine {
  return {
    wins: n(s?.regularSeasonWins),
    losses: n(s?.regularSeasonLosses),
    playoffWins: n(s?.playoffWins),
    playoffLosses: n(s?.playoffLosses),
    seasons: n(s?.totalSeasonsSimulated),
  };
}

function addLines(...lines: RecordLine[]): RecordLine {
  return lines.reduce(
    (a, b) => ({
      wins: a.wins + b.wins,
      losses: a.losses + b.losses,
      playoffWins: a.playoffWins + b.playoffWins,
      playoffLosses: a.playoffLosses + b.playoffLosses,
      seasons: a.seasons + b.seasons,
    }),
    { wins: 0, losses: 0, playoffWins: 0, playoffLosses: 0, seasons: 0 }
  );
}

export function deriveRecords(input: {
  stats: { normal?: StatsLike; eraNormal?: StatsLike; hard?: StatsLike };
  history: readonly RunHistoryEntry[];
  squadBook: Pick<SquadBookState, "cards"> | null;
  mostDraftedLimit?: number;
}): RecordsSummary {
  const buckets = [input.stats.normal, input.stats.eraNormal, input.stats.hard];
  const byMode = {
    classic: line(input.stats.normal),
    era: line(input.stats.eraNormal),
    ballKnower: line(input.stats.hard),
  };

  // Best regular-season record: most wins, then fewest losses (stats first, history as backup).
  let bestSeason: { wins: number; losses: number } | null = null;
  const consider = (wins: number, losses: number) => {
    if (wins + losses <= 0) return;
    if (!bestSeason || wins > bestSeason.wins || (wins === bestSeason.wins && losses < bestSeason.losses)) {
      bestSeason = { wins, losses };
    }
  };
  for (const s of buckets) {
    if (s && n(s.totalSeasonsSimulated) > 0) consider(n(s.bestRecordWins), n(s.bestRecordLosses));
  }
  for (const h of input.history) consider(h.wins, h.losses);

  const longestWinStreak = Math.max(
    0,
    ...buckets.map((s) => n(s?.longestUnbeatenRun)),
    ...input.history.map((h) => h.winStreak)
  );
  const perfectFromStats = buckets.reduce((sum, s) => sum + n(s?.totalPerfectSeasons), 0);
  // Daily / Weekly 27-0s aren't in the lifetime buckets; count them from the history.
  const perfectSpecial = input.history.filter((h) => h.perfect && (h.variant === "daily" || h.variant === "weekly")).length;

  const mostDrafted: MostDraftedPlayer[] = Object.entries(input.squadBook?.cards ?? {})
    .map(([id, c]) => ({ id, name: c.name, club: c.club, year: c.year, times: n(c.times) }))
    .filter((c) => c.times > 0)
    .sort((a, b) => b.times - a.times || a.name.localeCompare(b.name))
    .slice(0, input.mostDraftedLimit ?? 10);

  const withSquads = input.history.filter((h) => h.squad.length > 0);
  return {
    allTime: addLines(byMode.classic, byMode.era, byMode.ballKnower),
    byMode,
    bestSeason,
    longestWinStreak,
    perfectSeasons: perfectFromStats + perfectSpecial,
    titles: buckets.reduce((sum, s) => sum + n(s?.superLeagueTitles), 0),
    leagueLeaders: buckets.reduce((sum, s) => sum + n(s?.leagueTitlesWon), 0),
    mostDrafted,
    bestRun: [...withSquads].sort(compareRunsByResult)[0] ?? null,
    highestRatedRun: [...withSquads].sort(compareRunsByRating)[0] ?? null,
    runsTracked: input.history.length,
  };
}

export function formatWinPct(wins: number, losses: number): string {
  const games = wins + losses;
  return games > 0 ? `${Math.round((wins / games) * 100)}%` : "–";
}
