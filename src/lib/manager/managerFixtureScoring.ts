import seedrandom from "seedrandom";
import type { MatchFixture } from "../game/season-simulation";
import type { SquadSlot } from "../types";
import { getManagerPlayer } from "./managerPlayers";
import type { LiveMatchEvent, ManagerCareer, ManagerFixtureRecord } from "./types";
import { enrichManagerFixtureScoring } from "./managerScoring";
import { generateManagerMatchBio } from "./manager-match-summary";
import { countTriesByPositionGroup } from "./managerTacticsScoring";
import { buildMatchdayScoringEntries } from "./managerSquad";
import { allocateWeightedTries } from "./managerTryScoring";
import { buildOpponentTryScoringDetail } from "./managerOpponentScoring";
import {
  opponentScoringUsesClubLump,
  repairOpponentTryScorers,
} from "./managerOpponentScoring";

function userTryTotal(fixture: MatchFixture): number {
  return (
    fixture.scoringDetail?.dreamTeam.tryScorers.reduce(
      (sum, s) => sum + s.tries,
      0
    ) ?? 0
  );
}

function scoringDetailMatchesFixture(fixture: MatchFixture): boolean {
  if (!fixture.scoringDetail) return false;
  if (userTryTotal(fixture) !== fixture.triesFor) return false;
  if (opponentScoringUsesClubLump(fixture)) return false;

  const oppTryTotal = fixture.scoringDetail.opponent.tryScorers.reduce(
    (sum, s) => sum + s.tries,
    0
  );
  if (fixture.triesAgainst > 0 && oppTryTotal !== fixture.triesAgainst) {
    return false;
  }
  return true;
}

/** Ensure fixture scoring detail matches the final scoreline for match review. */
export function ensureManagerFixtureScoring(
  career: ManagerCareer,
  fixture: MatchFixture,
  squad: SquadSlot[],
  fixtureKey?: string
): void {
  const record = fixture as ManagerFixtureRecord;
  const matchdayXiii = record.meta?.matchdayXiii ?? career.matchdayXiii;
  const xiiiSlotPositions =
    record.meta?.xiiiSlotPositions ?? career.xiiiSlotPositions;
  const matchdayInterchange =
    record.meta?.matchdayInterchange ?? career.matchdayInterchange;

  if (!scoringDetailMatchesFixture(fixture)) {
    fixture.scoringDetail = undefined;
    enrichManagerFixtureScoring(
      squad,
      fixture,
      career.seed,
      career.tactics,
      {
        currentSeasonOnly: true,
        fixtureKey,
        career,
        matchdayXiii,
        xiiiSlotPositions,
        matchdayInterchange,
      }
    );
  }

  if (opponentScoringUsesClubLump(fixture)) {
    repairOpponentTryScorers(
      fixture,
      career.seed,
      career.tactics,
      fixtureKey,
      career
    );
  }

  if (!fixture.scoringDetail) {
    const entries = buildMatchdayScoringEntries(
      career,
      matchdayXiii,
      xiiiSlotPositions,
      matchdayInterchange
    );
    const rng = seedrandom(
      `${career.seed}-mgr-fallback-${fixtureKey ?? `r${fixture.round}`}`
    );
    const weights = entries.map((e) => e.tryWeightMultiplier * (0.9 + rng() * 0.2));
    const alloc = allocateWeightedTries(fixture.triesFor, weights, rng);
    const userTryScorers = entries
      .map((e, i) => ({
        playerId: e.player.id,
        name: e.player.name,
        tries: alloc[i] ?? 0,
      }))
      .filter((s) => s.tries > 0);

    const oppName = fixture.opponent;

    fixture.scoringDetail = {
      dreamTeam: {
        tryScorers: userTryScorers,
        kicking: fixture.scoringFor
          ? {
              playerId: userTryScorers[0]?.playerId ?? "kicker",
              name: userTryScorers[0]?.name ?? career.seed,
              conversions: fixture.scoringFor.conversions,
              conversionAttempts: fixture.scoringFor.tries,
              penalties: fixture.scoringFor.penalties,
              dropGoals: fixture.scoringFor.dropGoals,
            }
          : null,
      },
      opponent: {
        tryScorers:
          fixture.triesAgainst > 0
            ? buildOpponentTryScoringDetail(
                oppName,
                fixture.triesAgainst,
                career.seed,
                fixture.round,
                career.tactics,
                fixtureKey,
                career
              )
            : [],
        kicking: fixture.scoringAgainst
          ? {
              playerId: oppName,
              name: oppName,
              conversions: fixture.scoringAgainst.conversions,
              conversionAttempts: fixture.scoringAgainst.tries,
              penalties: fixture.scoringAgainst.penalties,
              dropGoals: fixture.scoringAgainst.dropGoals,
            }
          : null,
      },
    };
  }

  refreshManagerMatchBio(career, fixture);
}

function refreshManagerMatchBio(
  career: ManagerCareer,
  fixture: MatchFixture
): void {
  const record = fixture as ManagerFixtureRecord;

  const userScorers = fixture.scoringDetail?.dreamTeam.tryScorers ?? [];
  const xiii = record.meta?.matchdayXiii ?? career.matchdayXiii;
  const slots = record.meta?.xiiiSlotPositions ?? career.xiiiSlotPositions;
  const { forward, back } = countTriesByPositionGroup(
    userScorers,
    slots,
    xiii
  );

  fixture.matchBio = generateManagerMatchBio(fixture, career.seed, {
    clubName: career.club,
    competition: record.competition ?? record.meta?.competition,
    cupRound: record.meta?.cupRound,
    tacticImpactLine: record.meta?.tacticImpactLine,
    tacticEffectivenessLine: record.meta?.tacticEffectivenessLine,
    attendance: record.meta?.attendance,
    playedLive: record.meta?.playedLive,
    injuryCount: record.meta?.injuries?.length,
    forwardTries: forward,
    backTries: back,
  });
}

function resolvePlayerIdByName(
  career: ManagerCareer,
  name: string | undefined
): string | undefined {
  if (!name) return undefined;
  const allIds = [
    ...career.matchdayXiii,
    ...career.matchdayInterchange,
  ].filter(Boolean);
  for (const id of allIds) {
    const p = getManagerPlayer(career, id);
    if (p?.name === name) return id;
  }
  for (const r of career.reserves) {
    if (r.name === name) return r.id;
  }
  return undefined;
}

/** Build scoring detail from live match events so review matches the played game. */
export function applyLiveEventsToFixtureScoring(
  career: ManagerCareer,
  fixture: MatchFixture,
  events: LiveMatchEvent[],
  fixtureKey?: string
): void {
  const userTryMap = new Map<string, { playerId: string; name: string; tries: number }>();
  const oppTryCountEvents = events.filter(
    (e) => e.type === "try" && e.team === "opponent"
  ).length;

  let conversions = 0;
  let penalties = 0;
  let dropGoals = 0;
  let kickerId: string | undefined;
  let kickerName: string | undefined;
  let oppConversions = 0;
  let oppPenalties = 0;
  let oppDropGoals = 0;

  for (const ev of events) {
    if (ev.team === "user") {
      if (ev.type === "try") {
        const playerId =
          resolvePlayerIdByName(career, ev.playerName) ??
          ev.playerName ??
          "unknown";
        const name = ev.playerName ?? "Try scorer";
        const existing = userTryMap.get(playerId);
        if (existing) {
          existing.tries++;
        } else {
          userTryMap.set(playerId, { playerId, name, tries: 1 });
        }
      }
      if (ev.type === "goal") {
        conversions++;
        kickerId = resolvePlayerIdByName(career, ev.playerName) ?? kickerId;
        kickerName = ev.playerName ?? kickerName;
      }
      if (ev.type === "penalty") {
        penalties++;
        kickerId = resolvePlayerIdByName(career, ev.playerName) ?? kickerId;
        kickerName = ev.playerName ?? kickerName;
      }
      if (ev.type === "drop_goal") {
        dropGoals++;
      }
      continue;
    }

    if (ev.team === "opponent") {
      if (ev.type === "goal") oppConversions++;
      if (ev.type === "penalty") oppPenalties++;
      if (ev.type === "drop_goal") oppDropGoals++;
    }
  }

  const userTryScorers = [...userTryMap.values()];
  const userTryTotal =
    fixture.triesFor ??
    userTryScorers.reduce((sum, t) => sum + t.tries, 0);
  const oppTryCount = fixture.triesAgainst ?? oppTryCountEvents;

  fixture.triesFor = userTryTotal;
  fixture.triesAgainst = oppTryCount;
  if (fixture.scoringFor) {
    fixture.scoringFor = { ...fixture.scoringFor, tries: userTryTotal };
  }
  if (fixture.scoringAgainst) {
    fixture.scoringAgainst = {
      ...fixture.scoringAgainst,
      tries: oppTryCount,
    };
  }

  const oppTryScorers: { playerId: string; name: string; tries: number }[] = [];
  if (oppTryCount > 0) {
    const fromSquad = buildOpponentTryScoringDetail(
      fixture.opponent,
      oppTryCount,
      career.seed,
      fixture.round,
      career.tactics,
      fixtureKey,
      career
    );
    if (fromSquad.length > 0) {
      oppTryScorers.push(...fromSquad);
    }
  }

  fixture.scoringDetail = {
    dreamTeam: {
      tryScorers: userTryScorers,
      kicking:
        fixture.scoringFor &&
        (conversions > 0 || penalties > 0 || dropGoals > 0)
          ? {
              playerId: kickerId ?? userTryScorers[0]?.playerId ?? "kicker",
              name: kickerName ?? userTryScorers[0]?.name ?? "Kicker",
              conversions,
              conversionAttempts: fixture.scoringFor.tries,
              penalties,
              dropGoals,
            }
          : fixture.scoringFor
            ? {
                playerId: userTryScorers[0]?.playerId ?? "kicker",
                name: userTryScorers[0]?.name ?? "Kicker",
                conversions: fixture.scoringFor.conversions,
                conversionAttempts: fixture.scoringFor.tries,
                penalties: fixture.scoringFor.penalties,
                dropGoals: fixture.scoringFor.dropGoals,
              }
            : null,
    },
    opponent: {
      tryScorers: oppTryScorers,
      kicking: fixture.scoringAgainst
        ? {
            playerId: oppTryScorers[0]?.playerId ?? fixture.opponent,
            name: oppTryScorers[0]?.name ?? fixture.opponent,
            conversions:
              oppConversions > 0
                ? oppConversions
                : fixture.scoringAgainst.conversions,
            conversionAttempts: oppTryCount,
            penalties:
              oppPenalties > 0
                ? oppPenalties
                : fixture.scoringAgainst.penalties,
            dropGoals:
              oppDropGoals > 0
                ? oppDropGoals
                : fixture.scoringAgainst.dropGoals,
          }
        : null,
    },
  };
}
