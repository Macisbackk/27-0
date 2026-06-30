import type { MatchFixture } from "../game/season-simulation";
import type { SquadSlot } from "../types";
import { selectClubMatchSquad } from "../game/opponent-scorers";
import { getPlayerEligiblePositions } from "../players/player-positions";
import { getManagerPlayer } from "./managerPlayers";
import type { LiveMatchEvent, ManagerCareer } from "./types";
import { enrichManagerFixtureScoring } from "./managerScoring";

/** Ensure fixture always has scoring detail for match review UI. */
export function ensureManagerFixtureScoring(
  career: { seed: string; tactics: ManagerCareer["tactics"] },
  fixture: MatchFixture,
  squad: SquadSlot[]
): void {
  if (fixture.scoringDetail) return;

  enrichManagerFixtureScoring(
    squad,
    fixture,
    career.seed,
    career.tactics,
    { currentSeasonOnly: true }
  );

  if (fixture.scoringDetail) return;

  const xiiiPlayers = squad
    .filter((s) => s.player)
    .map((s) => s.player!);

  const userTryScorers = [];
  let triesLeft = fixture.triesFor;
  for (const p of xiiiPlayers) {
    if (triesLeft <= 0) break;
    const t = Math.min(triesLeft, triesLeft > 1 ? 1 : triesLeft);
    if (t > 0) {
      userTryScorers.push({ playerId: p.id, name: p.name, tries: t });
      triesLeft -= t;
    }
  }
  if (triesLeft > 0 && userTryScorers[0]) {
    userTryScorers[0] = {
      ...userTryScorers[0],
      tries: userTryScorers[0].tries + triesLeft,
    };
  }

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
          ? [
              {
                playerId: oppName,
                name: oppName,
                tries: fixture.triesAgainst,
              },
            ]
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
  events: LiveMatchEvent[]
): void {
  const userTryMap = new Map<string, { playerId: string; name: string; tries: number }>();
  const oppTryCount = events.filter(
    (e) => e.type === "try" && e.team === "opponent"
  ).length;

  let conversions = 0;
  let penalties = 0;
  let dropGoals = 0;
  let kickerId: string | undefined;
  let kickerName: string | undefined;

  for (const ev of events) {
    if (ev.team !== "user") continue;
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
  }

  const userTryScorers = [...userTryMap.values()];
  const userTryTotal = userTryScorers.reduce((sum, t) => sum + t.tries, 0);
  if (userTryTotal < fixture.triesFor && userTryScorers[0]) {
    userTryScorers[0] = {
      ...userTryScorers[0],
      tries: userTryScorers[0].tries + (fixture.triesFor - userTryTotal),
    };
  }

  const oppSquad = selectClubMatchSquad(
    fixture.opponent,
    career.seed,
    fixture.round,
    { currentSeasonOnly: true }
  );
  const oppEntries = oppSquad.slice(0, Math.max(1, oppTryCount)).map((p) => ({
    id: p.id,
    name: p.name,
    position: getPlayerEligiblePositions(p)[0] ?? p.position,
    rating: p.rating ?? p.peakRating,
  }));

  const oppTryScorers: { playerId: string; name: string; tries: number }[] = [];
  if (oppTryCount > 0) {
    let left = oppTryCount;
    for (const p of oppEntries) {
      if (left <= 0) break;
      const t = Math.min(left, 1);
      oppTryScorers.push({ playerId: p.id, name: p.name, tries: t });
      left -= t;
    }
    if (left > 0 && oppTryScorers[0]) {
      oppTryScorers[0] = {
        ...oppTryScorers[0],
        tries: oppTryScorers[0].tries + left,
      };
    } else if (oppTryScorers.length === 0) {
      oppTryScorers.push({
        playerId: fixture.opponent,
        name: fixture.opponent,
        tries: oppTryCount,
      });
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
            conversions: fixture.scoringAgainst.conversions,
            conversionAttempts: fixture.scoringAgainst.tries,
            penalties: fixture.scoringAgainst.penalties,
            dropGoals: fixture.scoringAgainst.dropGoals,
          }
        : null,
    },
  };
}
