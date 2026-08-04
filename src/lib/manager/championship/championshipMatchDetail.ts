import seedrandom from "seedrandom";
import { FORMATION_SLOT_POSITIONS } from "../../positions";
import { allocateMatchTries } from "../../game/try-allocation";
import { POSITION_TRY_WEIGHT } from "../../game/try-weights";
import { decomposeRLScore, type ScoreBreakdown } from "../../game/rl-scores";
import type {
  FixtureKicking,
  FixtureTryScorer,
  TeamScoringDetail,
} from "../../game/season-simulation";
import type { Position } from "../../types";
import type {
  ChampionshipGeneratedPlayer,
  ChampionshipSquadState,
} from "./championshipSquads";
import { getChampionshipClubByName } from "../../clubs/championship-clubs";

export interface ChampionshipMatchEvent {
  id: string;
  minute: number;
  type:
    | "try"
    | "conversion"
    | "missed_conversion"
    | "penalty"
    | "drop_goal"
    | "half_time"
    | "full_time";
  team: "home" | "away";
  playerName?: string;
  text: string;
}

export interface ChampionshipMatchDetail {
  home: TeamScoringDetail;
  away: TeamScoringDetail;
  homeTries: number;
  awayTries: number;
  events: ChampionshipMatchEvent[];
  story: string;
}

function pickStartingXiii(
  clubName: string,
  squads: ChampionshipSquadState | undefined,
  rng: () => number
): ChampionshipGeneratedPlayer[] {
  const club = getChampionshipClubByName(clubName);
  if (!club || !squads) return [];
  const roster = (squads.rosterByClub[club.id] ?? [])
    .map((id) => squads.players[id])
    .filter((p): p is ChampionshipGeneratedPlayer => Boolean(p));
  if (roster.length === 0) return [];

  const used = new Set<string>();
  const xiii: ChampionshipGeneratedPlayer[] = [];

  for (const position of FORMATION_SLOT_POSITIONS) {
    let candidates = roster.filter(
      (p) =>
        !used.has(p.id) &&
        (p.position === position || p.eligiblePositions.includes(position))
    );
    if (candidates.length === 0) {
      candidates = roster.filter((p) => !used.has(p.id));
    }
    if (candidates.length === 0) break;
    candidates.sort((a, b) => b.peakRating - a.peakRating);
    const top = candidates.slice(0, Math.min(4, candidates.length));
    const pick = top[Math.floor(rng() * top.length)]!;
    used.add(pick.id);
    xiii.push(pick);
  }

  return xiii;
}

function tryWeight(
  player: ChampionshipGeneratedPlayer,
  played: Position
): number {
  const posW = POSITION_TRY_WEIGHT[played] ?? 0.5;
  const ratingMod = 1 + (player.peakRating - 75) * 0.016;
  return Math.max(0.05, posW * ratingMod);
}

function pickKicker(
  xiii: ChampionshipGeneratedPlayer[]
): ChampionshipGeneratedPlayer | null {
  const halves = xiii.filter(
    (p) => p.position === "SCRUM_HALF" || p.position === "STAND_OFF"
  );
  if (halves.length === 0) return xiii[0] ?? null;
  return [...halves].sort((a, b) => b.peakRating - a.peakRating)[0]!;
}

function buildTeamDetail(
  xiii: ChampionshipGeneratedPlayer[],
  breakdown: ScoreBreakdown,
  rng: () => number
): TeamScoringDetail {
  if (xiii.length === 0) {
    return { tryScorers: [], kicking: null };
  }

  const positions = FORMATION_SLOT_POSITIONS.slice(0, xiii.length);
  const weights = xiii.map((p, i) => tryWeight(p, positions[i]!));
  const alloc = allocateMatchTries(breakdown.tries, weights, rng, {
    positions,
    ratings: xiii.map((p) => p.peakRating),
    seasonTotalsSoFar: xiii.map(() => 0),
  });

  const tryScorers: FixtureTryScorer[] = xiii
    .map((p, i) => ({
      playerId: p.id,
      name: p.name,
      tries: alloc[i] ?? 0,
    }))
    .filter((s) => s.tries > 0);

  const kicker = pickKicker(xiii);
  const kicking: FixtureKicking | null = kicker
    ? {
        playerId: kicker.id,
        name: kicker.name,
        conversions: breakdown.conversions,
        conversionAttempts: breakdown.tries,
        penalties: breakdown.penalties,
        dropGoals: breakdown.dropGoals,
      }
    : null;

  return { tryScorers, kicking };
}

function buildStory(
  homeTeam: string,
  awayTeam: string,
  homeScore: number,
  awayScore: number,
  home: TeamScoringDetail,
  away: TeamScoringDetail
): string {
  const winner =
    homeScore > awayScore
      ? homeTeam
      : awayScore > homeScore
        ? awayTeam
        : null;
  const topHome = [...home.tryScorers].sort((a, b) => b.tries - a.tries)[0];
  const topAway = [...away.tryScorers].sort((a, b) => b.tries - a.tries)[0];
  const margin = Math.abs(homeScore - awayScore);

  if (!winner) {
    return `${homeTeam} and ${awayTeam} share the spoils in a ${homeScore}-${awayScore} draw.`;
  }

  const scorerNote =
    winner === homeTeam && topHome
      ? ` ${topHome.name} crossed ${topHome.tries === 1 ? "once" : `${topHome.tries} times`}.`
      : winner === awayTeam && topAway
        ? ` ${topAway.name} crossed ${topAway.tries === 1 ? "once" : `${topAway.tries} times`}.`
        : "";

  if (margin >= 20) {
    return `${winner} ran out comfortable ${homeScore}-${awayScore} winners.${scorerNote}`;
  }
  if (margin <= 4) {
    return `${winner} edged ${winner === homeTeam ? awayTeam : homeTeam} ${homeScore}-${awayScore} in a Championship thriller.${scorerNote}`;
  }
  return `${winner} beat ${winner === homeTeam ? awayTeam : homeTeam} ${homeScore}-${awayScore}.${scorerNote}`;
}

function buildTimeline(
  homeTeam: string,
  awayTeam: string,
  home: TeamScoringDetail,
  away: TeamScoringDetail,
  homeScore: number,
  awayScore: number,
  rng: () => number,
  fixtureId: string
): ChampionshipMatchEvent[] {
  type Draft = { minute: number; event: ChampionshipMatchEvent };
  const drafts: Draft[] = [];

  const pushTries = (
    team: "home" | "away",
    teamName: string,
    detail: TeamScoringDetail
  ) => {
    const names = detail.tryScorers.flatMap((s) =>
      Array.from({ length: s.tries }, () => s.name)
    );
    for (let i = names.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = names[i]!;
      names[i] = names[j]!;
      names[j] = tmp;
    }
    let conversionsLeft = detail.kicking?.conversions ?? 0;
    const kicker = detail.kicking?.name;
    for (let i = 0; i < names.length; i++) {
      const minute = Math.min(78, 3 + Math.floor(rng() * 75));
      const name = names[i]!;
      drafts.push({
        minute,
        event: {
          id: `${fixtureId}-${team}-try-${i}`,
          minute,
          type: "try",
          team,
          playerName: name,
          text: `TRY ${teamName} — ${name}`,
        },
      });
      if (kicker) {
        const converted = conversionsLeft > 0;
        if (converted) conversionsLeft--;
        drafts.push({
          minute: minute + 1,
          event: {
            id: `${fixtureId}-${team}-conv-${i}`,
            minute: Math.min(80, minute + 1),
            type: converted ? "conversion" : "missed_conversion",
            team,
            playerName: kicker,
            text: converted
              ? `GOAL ${kicker}`
              : `Missed conversion — ${kicker}`,
          },
        });
      }
    }

    const pens = detail.kicking?.penalties ?? 0;
    for (let i = 0; i < pens; i++) {
      const minute = Math.min(76, 10 + Math.floor(rng() * 65));
      drafts.push({
        minute,
        event: {
          id: `${fixtureId}-${team}-pen-${i}`,
          minute,
          type: "penalty",
          team,
          playerName: detail.kicking?.name,
          text: `PENALTY GOAL — ${detail.kicking?.name ?? teamName}`,
        },
      });
    }

    const dgs = detail.kicking?.dropGoals ?? 0;
    for (let i = 0; i < dgs; i++) {
      const minute = Math.min(79, 55 + Math.floor(rng() * 22));
      drafts.push({
        minute,
        event: {
          id: `${fixtureId}-${team}-dg-${i}`,
          minute,
          type: "drop_goal",
          team,
          playerName: detail.kicking?.name,
          text: `DROP GOAL — ${detail.kicking?.name ?? teamName}`,
        },
      });
    }
  };

  pushTries("home", homeTeam, home);
  pushTries("away", awayTeam, away);

  drafts.sort((a, b) => a.minute - b.minute);
  const events: ChampionshipMatchEvent[] = [];
  let insertedHt = false;
  for (const d of drafts) {
    if (!insertedHt && d.minute >= 40) {
      events.push({
        id: `${fixtureId}-ht`,
        minute: 40,
        type: "half_time",
        team: "home",
        text: "HALF TIME",
      });
      insertedHt = true;
    }
    events.push({ ...d.event, minute: d.minute });
  }
  if (!insertedHt) {
    events.push({
      id: `${fixtureId}-ht`,
      minute: 40,
      type: "half_time",
      team: "home",
      text: "HALF TIME",
    });
  }
  events.push({
    id: `${fixtureId}-ft`,
    minute: 80,
    type: "full_time",
    team: "home",
    text: `FULL TIME — ${homeTeam} ${homeScore}-${awayScore} ${awayTeam}`,
  });
  return events;
}

/**
 * Build try scorers, kicking breakdown, timeline events, and a short match story
 * for a Championship fixture using club squads when available.
 */
export function buildChampionshipMatchDetail(
  homeTeam: string,
  awayTeam: string,
  homeScore: number,
  awayScore: number,
  seed: string,
  fixtureId: string,
  squads?: ChampionshipSquadState
): ChampionshipMatchDetail {
  const rng = seedrandom(`${seed}-champ-detail-${fixtureId}`);
  const homeBreakdown = decomposeRLScore(homeScore);
  const awayBreakdown = decomposeRLScore(awayScore);

  const homeXiii = pickStartingXiii(homeTeam, squads, rng);
  const awayXiii = pickStartingXiii(awayTeam, squads, rng);

  const home = buildTeamDetail(homeXiii, homeBreakdown, rng);
  const away = buildTeamDetail(awayXiii, awayBreakdown, rng);

  return {
    home,
    away,
    homeTries: homeBreakdown.tries,
    awayTries: awayBreakdown.tries,
    events: buildTimeline(
      homeTeam,
      awayTeam,
      home,
      away,
      homeScore,
      awayScore,
      rng,
      fixtureId
    ),
    story: buildStory(homeTeam, awayTeam, homeScore, awayScore, home, away),
  };
}
