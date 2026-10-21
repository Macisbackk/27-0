import { legendById } from "./legends";
import type { CareerLegacy, CareerState, SeasonOutcome, TrophyId } from "./types";

export const EMPTY_TROPHIES: Record<TrophyId, number> = {
  "grand-final": 0,
  "league-leaders": 0,
  "challenge-cup": 0,
  "championship-title": 0,
  promotion: 0,
  "million-pound-game": 0,
  "perfect-season": 0,
};

export function emptyLegacy(): CareerLegacy {
  return {
    version: 1,
    legacyPoints: 0,
    lifetimeLegacyPoints: 0,
    unlockedLegends: [],
    careersStarted: 0,
    trophies: { ...EMPTY_TROPHIES },
    perfectSeasons: 0,
    updatedAt: 0,
  };
}

export function normalizeLegacy(raw: Partial<CareerLegacy> | null | undefined): CareerLegacy {
  const base = emptyLegacy();
  if (!raw || typeof raw !== "object") return base;
  return {
    ...base,
    ...raw,
    trophies: { ...EMPTY_TROPHIES, ...(raw.trophies ?? {}) },
    unlockedLegends: Array.isArray(raw.unlockedLegends) ? raw.unlockedLegends : [],
  };
}

/** Records the season actually broke, for the review screen. */
export interface RecordBreaks {
  fastestGlory?: number;
  bestSeason?: boolean;
  biggestWin?: boolean;
  perfect?: boolean;
}

/** Bank a finished season into the cross-career legacy. Idempotent per career+year via `bankedKey`. */
export function bankSeason(
  legacy: CareerLegacy,
  state: CareerState,
  outcome: SeasonOutcome
): { legacy: CareerLegacy; breaks: RecordBreaks } {
  const next: CareerLegacy = structuredClone(legacy);
  const breaks: RecordBreaks = {};
  next.legacyPoints += outcome.legacyEarned;
  next.lifetimeLegacyPoints += outcome.legacyEarned;
  for (const t of outcome.trophies) next.trophies[t] = (next.trophies[t] ?? 0) + 1;

  const club = state.clubs[state.userClubId]!;
  if (outcome.trophies.includes("perfect-season")) {
    next.perfectSeasons += 1;
    breaks.perfect = true;
  }
  if (outcome.division === "super-league") {
    const best = next.bestSeason;
    const better = !best || outcome.won > best.wins || (outcome.won === best.wins && outcome.lost < best.losses);
    if (better) {
      next.bestSeason = { wins: outcome.won, losses: outcome.lost, drawn: outcome.drawn, year: outcome.year, clubName: club.name };
      breaks.bestSeason = true;
    }
  }
  if (state.startDivision === "championship" && outcome.trophies.includes("grand-final")) {
    const seasons = state.seasonNumber;
    if (next.fastestGlorySeasons == null || seasons < next.fastestGlorySeasons) {
      next.fastestGlorySeasons = seasons;
      breaks.fastestGlory = seasons;
    }
  }
  const margin = state.seasonTrack.biggestWinMargin;
  if (margin > 0 && (!next.biggestWin || margin > next.biggestWin.margin)) {
    // Find the fixture for the score line.
    const f = state.calendar
      .flatMap((m) => m.fixtures)
      .find((x) => {
        if (!x.result) return false;
        const home = x.home === state.userClubId;
        if (!home && x.away !== state.userClubId) return false;
        const us = home ? x.result.homeScore : x.result.awayScore;
        const them = home ? x.result.awayScore : x.result.homeScore;
        return us - them === margin;
      });
    if (f?.result) {
      const home = f.home === state.userClubId;
      const us = home ? f.result.homeScore : f.result.awayScore;
      const them = home ? f.result.awayScore : f.result.homeScore;
      next.biggestWin = {
        margin,
        score: `${us}–${them}`,
        opponent: state.clubs[home ? f.away : f.home]?.name ?? "",
        year: outcome.year,
      };
      breaks.biggestWin = true;
    }
  }
  next.updatedAt = Date.now();
  return { legacy: next, breaks };
}

export function unlockLegend(legacy: CareerLegacy, legendId: string): { legacy: CareerLegacy; error?: "points" | "unknown" | "owned" } {
  const card = legendById(legendId);
  if (!card) return { legacy, error: "unknown" };
  if (legacy.unlockedLegends.includes(legendId)) return { legacy, error: "owned" };
  if (legacy.legacyPoints < card.unlockCost) return { legacy, error: "points" };
  return {
    legacy: {
      ...legacy,
      legacyPoints: legacy.legacyPoints - card.unlockCost,
      unlockedLegends: [...legacy.unlockedLegends, legendId],
      updatedAt: Date.now(),
    },
  };
}

export function totalMajorTrophies(legacy: CareerLegacy): number {
  const t = legacy.trophies;
  return t["grand-final"] + t["league-leaders"] + t["challenge-cup"] + t["championship-title"] + t["million-pound-game"];
}
