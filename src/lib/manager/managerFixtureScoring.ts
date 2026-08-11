import seedrandom from "seedrandom";
import type { MatchFixture } from "../game/season-simulation";
import type { SquadSlot } from "../types";
import { getManagerPlayer } from "./managerPlayers";
import type { LiveMatchEvent, ManagerCareer, ManagerFixtureRecord } from "./types";
import { enrichManagerFixtureScoring } from "./managerScoring";
import { generateManagerMatchBio } from "./manager-match-summary";
import { buildMatchStoryFromEvents, type MatchEventType } from "../game/match-events";
import { countTriesByPositionGroup, resolveEffectiveTactics } from "./managerTacticsScoring";
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

import {
  isInvalidPlayerName,
  isPlaceholderTryScorerName,
} from "./managerPlayerNameGuards";

export { isPlaceholderTryScorerName, isInvalidPlayerName };

function scorersHavePlaceholders(
  scorers: { name: string; playerId?: string }[]
): boolean {
  return scorers.some(
    (s) =>
      isInvalidPlayerName(s.name) ||
      isInvalidPlayerName(s.playerId)
  );
}

function userScoringMatchesFixture(fixture: MatchFixture): boolean {
  if (!fixture.scoringDetail) return false;
  if (userTryTotal(fixture) !== fixture.triesFor) return false;
  const scorers = fixture.scoringDetail.dreamTeam.tryScorers;
  if (fixture.triesFor > 0 && scorers.length === 0) return false;
  if (scorersHavePlaceholders(scorers)) return false;
  return true;
}

function opponentScoringMatchesFixture(fixture: MatchFixture): boolean {
  if (!fixture.scoringDetail) return false;
  if (opponentScoringUsesClubLump(fixture)) return false;
  const oppTryTotal = fixture.scoringDetail.opponent.tryScorers.reduce(
    (sum, s) => sum + s.tries,
    0
  );
  if (fixture.triesAgainst > 0 && oppTryTotal !== fixture.triesAgainst) {
    return false;
  }
  if (
    fixture.triesAgainst > 0 &&
    scorersHavePlaceholders(fixture.scoringDetail.opponent.tryScorers)
  ) {
    return false;
  }
  return true;
}

function scoringDetailMatchesFixture(fixture: MatchFixture): boolean {
  return (
    userScoringMatchesFixture(fixture) && opponentScoringMatchesFixture(fixture)
  );
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

  const liveEvents = record.meta?.liveEvents;
  if (
    liveEvents &&
    liveEvents.length > 0 &&
    !scoringDetailMatchesFixture(fixture)
  ) {
    applyLiveEventsToFixtureScoring(
      career,
      fixture,
      liveEvents,
      fixtureKey
    );
  }

  // Rebuild only when user try totals are wrong — do not wipe good user
  // scorers just because opponent names need a repair.
  if (!userScoringMatchesFixture(fixture)) {
    const preservedOpponent = fixture.scoringDetail?.opponent;
    fixture.scoringDetail = undefined;
    enrichManagerFixtureScoring(
      squad,
      fixture,
      career.seed,
      resolveEffectiveTactics(career, fixtureKey),
      {
        currentSeasonOnly: true,
        fixtureKey,
        career,
        matchdayXiii,
        xiiiSlotPositions,
        matchdayInterchange,
      }
    );
    // Re-read after mutation — assigning `undefined` above narrows the property.
    const enrichedDetail = (fixture as MatchFixture).scoringDetail;
    if (
      enrichedDetail &&
      preservedOpponent &&
      opponentScoringMatchesFixture({
        ...fixture,
        scoringDetail: {
          dreamTeam: enrichedDetail.dreamTeam,
          opponent: preservedOpponent,
        },
      })
    ) {
      fixture.scoringDetail = {
        ...enrichedDetail,
        opponent: preservedOpponent,
      };
    }
  }

  if (!opponentScoringMatchesFixture(fixture)) {
    repairOpponentTryScorers(
      fixture,
      career.seed,
      resolveEffectiveTactics(career, fixtureKey),
      fixtureKey,
      career
    );
  }

  if (!fixture.scoringDetail || !userScoringMatchesFixture(fixture)) {
    const entries = buildMatchdayScoringEntries(
      career,
      matchdayXiii,
      xiiiSlotPositions,
      matchdayInterchange
    );
    const rng = seedrandom(
      `${career.seed}-mgr-fallback-${fixtureKey ?? `r${fixture.round}`}`
    );
    const weights = entries.map((e) => {
      const rating =
        typeof e.player.peakRating === "number" &&
        Number.isFinite(e.player.peakRating) &&
        e.player.peakRating > 0
          ? e.player.peakRating
          : 80;
      const ability = Math.pow(Math.max(80, rating) / 83, 2.35);
      return Math.max(
        0.05,
        ability * e.tryWeightMultiplier * (0.9 + rng() * 0.2)
      );
    });
    const alloc = allocateWeightedTries(fixture.triesFor, weights, rng, {
      positions: entries.map((e) => e.playedPosition),
      ratings: entries.map((e) =>
        typeof e.player.peakRating === "number" &&
        Number.isFinite(e.player.peakRating) &&
        e.player.peakRating > 0
          ? e.player.peakRating
          : 80
      ),
      seasonTriesSoFar: entries.map(
        (e) => career.playerSeasonStats[e.player.id]?.tries ?? 0
      ),
    });
    const userTryScorers = entries
      .map((e, i) => ({
        playerId: e.player.id,
        name: e.player.name,
        tries: alloc[i] ?? 0,
      }))
      .filter((s) => s.tries > 0);

    const oppName = fixture.opponent;
    const existingOpp = fixture.scoringDetail?.opponent;

    fixture.scoringDetail = {
      dreamTeam: {
        tryScorers: userTryScorers,
        kicking: fixture.scoringFor
          ? {
              playerId: userTryScorers[0]?.playerId ?? "kicker",
              name: userTryScorers[0]?.name ?? career.club,
              conversions: fixture.scoringFor.conversions,
              conversionAttempts: fixture.scoringFor.tries,
              penalties: fixture.scoringFor.penalties,
              dropGoals: fixture.scoringFor.dropGoals,
            }
          : null,
      },
      opponent: existingOpp ?? {
        tryScorers:
          fixture.triesAgainst > 0
            ? buildOpponentTryScoringDetail(
                oppName,
                fixture.triesAgainst,
                career.seed,
                fixture.round,
                resolveEffectiveTactics(career, fixtureKey),
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

  if (!opponentScoringMatchesFixture(fixture)) {
    repairOpponentTryScorers(
      fixture,
      career.seed,
      resolveEffectiveTactics(career, fixtureKey),
      fixtureKey,
      career
    );
  }

  refreshManagerMatchBio(career, fixture);
}

function refreshManagerMatchBio(
  career: ManagerCareer,
  fixture: MatchFixture
): void {
  const record = fixture as ManagerFixtureRecord;

  const liveEvents = record.meta?.liveEvents;
  if (liveEvents && liveEvents.length > 0) {
    fixture.matchBio = buildMatchStoryFromEvents(
      liveEvents.map((e) => ({
        id: e.id ?? "",
        minute: e.minute,
        teamId: e.teamId ?? e.team,
        teamName:
          e.teamName ?? (e.team === "user" ? career.club : fixture.opponent),
        playerName: e.playerName,
        type: e.type as MatchEventType,
        description: e.description,
        importance: e.importance ?? "medium",
      })),
      career.club
    );
    return;
  }

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
    tactics: resolveEffectiveTactics(career, record.fixtureId),
    tacticImpactLine: record.meta?.tacticImpactLine,
    tacticEffectivenessLine: record.meta?.tacticEffectivenessLine,
    attendance: record.meta?.attendance,
    playedLive: record.meta?.playedLive,
    liveEvents: record.meta?.liveEvents,
    injuryCount: record.meta?.injuries?.length,
    injuries: record.meta?.injuries?.map((i) => i.name),
    forwardTries: forward,
    backTries: back,
  });
}

function resolvePlayerIdByName(
  career: ManagerCareer,
  name: string | undefined
): string | undefined {
  if (!name || isInvalidPlayerName(name, [career.club])) return undefined;
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

function resolveUserTryIdentity(
  career: ManagerCareer,
  ev: LiveMatchEvent
): { playerId: string; name: string } | null {
  const fromId =
    ev.playerId && !isInvalidPlayerName(ev.playerId, [career.club])
      ? getManagerPlayer(career, ev.playerId)
      : undefined;
  if (fromId?.name && !isInvalidPlayerName(fromId.name, [career.club])) {
    return { playerId: fromId.id, name: fromId.name };
  }

  const name = ev.playerName?.trim();
  if (name && !isInvalidPlayerName(name, [career.club])) {
    const playerId = resolvePlayerIdByName(career, name);
    // Never persist a bare display name as playerId — only real ids.
    if (!playerId) return null;
    return { playerId, name };
  }

  return null;
}

/** Fill unnamed / placeholder try counts from the matchday squad. */
function allocateRemainingUserTries(
  career: ManagerCareer,
  remaining: number,
  existing: Map<string, { playerId: string; name: string; tries: number }>,
  fixtureKey: string | undefined,
  round: number,
  matchdayXiii: string[],
  xiiiSlotPositions: ManagerCareer["xiiiSlotPositions"],
  matchdayInterchange: string[]
): void {
  if (remaining <= 0) return;
  const entries = buildMatchdayScoringEntries(
    career,
    matchdayXiii,
    xiiiSlotPositions,
    matchdayInterchange
  );
  if (entries.length === 0) return;

  const rng = seedrandom(
    `${career.seed}-mgr-live-fill-${fixtureKey ?? `r${round}`}`
  );
  const weights = entries.map((e) => e.tryWeightMultiplier * (0.9 + rng() * 0.2));
  const alloc = allocateWeightedTries(remaining, weights, rng);
  entries.forEach((e, i) => {
    const tries = alloc[i] ?? 0;
    if (tries <= 0) return;
    const existingEntry = existing.get(e.player.id);
    if (existingEntry) {
      existingEntry.tries += tries;
    } else {
      existing.set(e.player.id, {
        playerId: e.player.id,
        name: e.player.name,
        tries,
      });
    }
  });
}

/** Build scoring detail from live match events so review matches the played game. */
export function applyLiveEventsToFixtureScoring(
  career: ManagerCareer,
  fixture: MatchFixture,
  events: LiveMatchEvent[],
  fixtureKey?: string
): void {
  const record = fixture as ManagerFixtureRecord;
  const matchdayXiii = record.meta?.matchdayXiii ?? career.matchdayXiii;
  const xiiiSlotPositions =
    record.meta?.xiiiSlotPositions ?? career.xiiiSlotPositions;
  const matchdayInterchange =
    record.meta?.matchdayInterchange ?? career.matchdayInterchange;

  const userTryMap = new Map<string, { playerId: string; name: string; tries: number }>();
  const oppTryMap = new Map<string, { playerId: string; name: string; tries: number }>();
  const oppTryCountEvents = events.filter(
    (e) => e.type === "try" && e.team === "opponent"
  ).length;
  let userTryEvents = 0;
  let unresolvedUserTries = 0;

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
        userTryEvents++;
        const identity = resolveUserTryIdentity(career, ev);
        if (!identity) {
          unresolvedUserTries++;
          continue;
        }
        const existing = userTryMap.get(identity.playerId);
        if (existing) {
          existing.tries++;
        } else {
          userTryMap.set(identity.playerId, {
            playerId: identity.playerId,
            name: identity.name,
            tries: 1,
          });
        }
      }
      if (ev.type === "goal" || ev.type === "conversion") {
        conversions++;
        const kickName = ev.kickerName ?? ev.playerName;
        if (kickName && !isPlaceholderTryScorerName(kickName)) {
          kickerId = resolvePlayerIdByName(career, kickName) ?? kickerId;
          kickerName = kickName ?? kickerName;
        }
      }
      if (ev.type === "penalty" || ev.type === "penalty_goal") {
        penalties++;
        const kickName = ev.kickerName ?? ev.playerName;
        if (kickName && !isPlaceholderTryScorerName(kickName)) {
          kickerId = resolvePlayerIdByName(career, kickName) ?? kickerId;
          kickerName = kickName ?? kickerName;
        }
      }
      if (ev.type === "drop_goal") {
        dropGoals++;
        const kickName = ev.kickerName ?? ev.playerName;
        if (kickName && !isPlaceholderTryScorerName(kickName)) {
          kickerId = resolvePlayerIdByName(career, kickName) ?? kickerId;
          kickerName = kickName ?? kickerName;
        }
      }
      continue;
    }

    if (ev.team === "opponent") {
      if (ev.type === "try") {
        const name = ev.playerName;
        if (
          name &&
          !isPlaceholderTryScorerName(name) &&
          name !== fixture.opponent
        ) {
          const playerId = ev.playerId ?? name;
          const existing = oppTryMap.get(playerId);
          if (existing) existing.tries++;
          else oppTryMap.set(playerId, { playerId, name, tries: 1 });
        }
      }
      if (ev.type === "goal" || ev.type === "conversion") oppConversions++;
      if (ev.type === "penalty" || ev.type === "penalty_goal") oppPenalties++;
      if (ev.type === "drop_goal") oppDropGoals++;
    }
  }

  const namedUserTries = [...userTryMap.values()].reduce(
    (sum, t) => sum + t.tries,
    0
  );
  const userTryTotal =
    fixture.triesFor ??
    (userTryEvents > 0 ? userTryEvents : namedUserTries);
  const missingUserTries = Math.max(0, userTryTotal - namedUserTries);
  allocateRemainingUserTries(
    career,
    unresolvedUserTries > 0 ? Math.max(missingUserTries, unresolvedUserTries) : missingUserTries,
    userTryMap,
    fixtureKey,
    fixture.round,
    matchdayXiii,
    xiiiSlotPositions,
    matchdayInterchange
  );

  // If still short after allocation, top up to the scoreline.
  const afterAlloc = [...userTryMap.values()].reduce(
    (sum, t) => sum + t.tries,
    0
  );
  if (afterAlloc < userTryTotal) {
    allocateRemainingUserTries(
      career,
      userTryTotal - afterAlloc,
      userTryMap,
      fixtureKey ? `${fixtureKey}-topup` : undefined,
      fixture.round,
      matchdayXiii,
      xiiiSlotPositions,
      matchdayInterchange
    );
  }

  const userTryScorers = [...userTryMap.values()].filter((s) => s.tries > 0);
  const oppTryFromEvents = [...oppTryMap.values()];
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

  let oppTryScorers = oppTryFromEvents;
  if (
    oppTryCount > 0 &&
    (oppTryScorers.length === 0 ||
      oppTryScorers.reduce((s, t) => s + t.tries, 0) !== oppTryCount ||
      scorersHavePlaceholders(oppTryScorers))
  ) {
    const fromSquad = buildOpponentTryScoringDetail(
      fixture.opponent,
      oppTryCount,
      career.seed,
      fixture.round,
      resolveEffectiveTactics(career, fixtureKey),
      fixtureKey,
      career
    );
    if (fromSquad.length > 0) {
      oppTryScorers = fromSquad;
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
                playerId: kickerId ?? userTryScorers[0]?.playerId ?? "kicker",
                name: kickerName ?? userTryScorers[0]?.name ?? "Kicker",
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

  if (record.meta) {
    record.meta.liveEvents = events;
  }
  refreshManagerMatchBio(career, fixture);
}
