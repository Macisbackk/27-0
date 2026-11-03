/**
 * End-of-season awards: Man of Steel (best player), Young Player of the Year (21 and under) and
 * the top try scorer for Super League (and the Championship when the user played there), plus
 * the user's own Player of the Season. Worked out before promotion and relegation move clubs.
 */
import { DIVISION_LABEL } from "./clubs";
import type { AwardId, CareerPlayer, CareerState, Division, SeasonAward } from "./types";

export const AWARD_LABEL: Record<AwardId, string> = {
  "man-of-steel": "Man of Steel",
  "young-player": "Young Player of the Year",
  "top-try-scorer": "Top try scorer",
  "club-player": "Player of the Season",
  "clive-churchill": "Clive Churchill Medal",
};

/** The NRL's names for its awards (v1.65). */
const NRL_AWARD_LABEL: Record<AwardId, string> = {
  "man-of-steel": "Dally M Medal",
  "young-player": "NRL Young Player of the Year",
  "top-try-scorer": "NRL top try scorer",
  "club-player": "Player of the Season",
  "clive-churchill": "Clive Churchill Medal",
};

/** "Man of Steel", or "Championship Player of the Year" for the second tier. */
export function awardLabel(a: Pick<SeasonAward, "id" | "division">): string {
  if (a.division === "nrl") return NRL_AWARD_LABEL[a.id];
  if (a.division === "championship" && a.id !== "club-player") {
    return a.id === "man-of-steel" ? "Championship Player of the Year" : `${DIVISION_LABEL.championship} ${AWARD_LABEL[a.id].toLowerCase()}`;
  }
  return AWARD_LABEL[a.id];
}

/** Legacy points when one of your players is Man of Steel (or wins the Dally M Medal). */
export const MAN_OF_STEEL_LEGACY = 15;

/** Games a player needs to be in the running for the big awards. */
const MIN_APPS = 10;
const MIN_APPS_YOUNG = 6;
const YOUNG_AGE = 21;

/** Rating first, then tries and games played, plus a nudge for players at clubs high in the table. */
function playerScore(p: CareerPlayer, tableBonus: number): number {
  return p.rating + p.tries * 0.35 + Math.min(p.apps, 30) * 0.1 + tableBonus;
}

function detail(p: CareerPlayer): string {
  return `${p.apps} ${p.apps === 1 ? "game" : "games"}, ${p.tries} ${p.tries === 1 ? "try" : "tries"}`;
}

function award(state: CareerState, id: AwardId, division: Division, p: CareerPlayer, clubId: string, line?: string): SeasonAward {
  return { id, division, playerId: p.id, name: p.name, clubId, clubName: state.clubs[clubId]?.name ?? "", detail: line ?? detail(p) };
}

function best<T>(list: T[], score: (x: T) => number, tie: (x: T) => string): T | undefined {
  return [...list].sort((a, b) => score(b) - score(a) || tie(a).localeCompare(tie(b)))[0];
}

/** Awards for one division (clubs as they stand before promotion and relegation). */
function divisionAwards(state: CareerState, division: Division): SeasonAward[] {
  const rows = state.tables[division] ?? [];
  const sorted = [...rows].sort((a, b) => b.pts - a.pts || b.pf - b.pa - (a.pf - a.pa) || b.pf - a.pf || a.clubId.localeCompare(b.clubId));
  const size = Math.max(2, sorted.length);
  const bonus = new Map(sorted.map((r, i) => [r.clubId, 2 * (1 - i / (size - 1))]));
  const pool: Array<{ p: CareerPlayer; clubId: string }> = [];
  for (const club of Object.values(state.clubs)) {
    if (club.division !== division) continue;
    for (const id of club.squad) {
      const p = state.players[id];
      if (p && p.apps > 0) pool.push({ p, clubId: club.id });
    }
  }
  if (!pool.length) return [];
  const score = (x: { p: CareerPlayer; clubId: string }) => playerScore(x.p, bonus.get(x.clubId) ?? 0);
  const tie = (x: { p: CareerPlayer }) => x.p.id;
  const out: SeasonAward[] = [];
  const regulars = pool.filter((x) => x.p.apps >= MIN_APPS);
  const mos = best(regulars.length ? regulars : pool, score, tie);
  if (mos) out.push(award(state, "man-of-steel", division, mos.p, mos.clubId));
  const kids = pool.filter((x) => x.p.age <= YOUNG_AGE && x.p.apps >= MIN_APPS_YOUNG);
  const young = best(kids, score, tie);
  if (young) out.push(award(state, "young-player", division, young.p, young.clubId));
  // Most tries; ties go to fewer games, then the higher rating.
  const top = best(pool, (x) => x.p.tries * 1000 - x.p.apps + x.p.rating / 100, tie);
  if (top && top.p.tries > 0) out.push(award(state, "top-try-scorer", division, top.p, top.clubId, `${top.p.tries} tries in ${top.p.apps} games`));
  return out;
}

/** The user's Player of the Season: games played count for more than in the league awards. */
function clubAward(state: CareerState): SeasonAward | undefined {
  const club = state.clubs[state.userClubId];
  if (!club) return undefined;
  const squad = club.squad.map((id) => state.players[id]).filter((p): p is CareerPlayer => !!p && p.apps > 0);
  const regulars = squad.filter((p) => p.apps >= 5);
  const pick = best(regulars.length ? regulars : squad, (p) => p.rating + p.tries * 0.4 + Math.min(p.apps, 30) * 0.15, (p) => p.id);
  return pick ? award(state, "club-player", club.division, pick, club.id) : undefined;
}

/** Every award for the season just finished. Call before clubs change division. */
export function computeSeasonAwards(state: CareerState): SeasonAward[] {
  const mine = state.clubs[state.userClubId]?.division;
  const divisions: Division[] = mine === "nrl" ? ["nrl"] : mine === "championship" ? ["super-league", "championship"] : ["super-league"];
  const out = divisions.flatMap((d) => divisionAwards(state, d));
  // The NRL Grand Final's player of the match: the Clive Churchill Medal.
  if (mine === "nrl") {
    const gf = state.calendar.flatMap((m) => m.fixtures).find((f) => f.kind === "nrl-gf" && f.result);
    const motm = gf?.result?.motm ? state.players[gf.result.motm] : undefined;
    if (gf && motm) {
      const clubId = [gf.home, gf.away].find((id) => state.clubs[id]?.squad.includes(motm.id)) ?? gf.home;
      const r = gf.result!;
      out.push(award(state, "clive-churchill", "nrl", motm, clubId, `NRL Grand Final, ${r.homeScore}–${r.awayScore}`));
    }
  }
  const club = clubAward(state);
  if (club) out.push(club);
  return out;
}

/** True when one of the user's players won Super League's Man of Steel (or the NRL's Dally M Medal). */
export function userWonManOfSteel(state: Pick<CareerState, "userClubId">, awards: readonly SeasonAward[]): SeasonAward | undefined {
  return awards.find((a) => a.id === "man-of-steel" && (a.division === "super-league" || a.division === "nrl") && a.clubId === state.userClubId);
}
