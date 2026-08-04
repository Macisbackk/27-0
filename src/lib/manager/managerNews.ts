import seedrandom from "seedrandom";
import type { LatestNewsItem, ManagerCareer } from "./types";
import { getNextManagerFixture } from "./managerSimulation";
import { getUserLeaguePosition } from "./managerFixtures";
import { formatWage } from "./managerContracts";
import {
  MAGIC_WEEKEND_VENUE,
  isMagicWeekendFixture,
} from "./managerMagicWeekend";
import { isCurrentPlayableClub } from "../clubs/super-league-display";

const MAX_STORED = 10;
const DISPLAY_COUNT = 5;

function championshipNewsItems(
  career: ManagerCareer,
  rng: () => number
): LatestNewsItem[] {
  const week = career.gameWeek;
  const items: LatestNewsItem[] = [];
  const competition = career.championshipCompetition;
  if (!competition || week <= 0) return items;

  const roundFixtures = competition.fixtures.filter(
    (f) => f.played && f.round === Math.min(19, week)
  );
  if (roundFixtures.length === 0) return items;

  const standings = competition.standings;
  const leader = standings[0];
  const bottom = standings[standings.length - 1];

  if (leader && rng() < 0.55) {
    items.push({
      id: `news-champ-leader-w${week}`,
      week,
      type: "result",
      text: `${leader.team} sit top of the Championship after Round ${Math.min(19, week)} (${leader.leaguePoints} pts).`,
    });
  }

  const thrashings = roundFixtures
    .filter(
      (f) =>
        f.homeScore != null &&
        f.awayScore != null &&
        Math.abs(f.homeScore - f.awayScore) >= 20
    )
    .sort(
      (a, b) =>
        Math.abs((b.homeScore ?? 0) - (b.awayScore ?? 0)) -
        Math.abs((a.homeScore ?? 0) - (a.awayScore ?? 0))
    );
  const big = thrashings[0];
  if (big && big.homeScore != null && big.awayScore != null) {
    const homeWon = big.homeScore > big.awayScore;
    const winner = homeWon ? big.homeTeam : big.awayTeam;
    const loser = homeWon ? big.awayTeam : big.homeTeam;
    const story = big.matchDetail?.story;
    items.push({
      id: `news-champ-result-${big.id}`,
      week,
      type: "result",
      text:
        story ??
        `Championship: ${winner} thrashed ${loser} ${big.homeScore}-${big.awayScore}.`,
    });
  } else if (roundFixtures.length > 0 && rng() < 0.7) {
    const pick =
      roundFixtures[Math.floor(rng() * roundFixtures.length)]!;
    if (pick.homeScore != null && pick.awayScore != null) {
      items.push({
        id: `news-champ-result-${pick.id}`,
        week,
        type: "result",
        text:
          pick.matchDetail?.story ??
          `Championship: ${pick.homeTeam} ${pick.homeScore}-${pick.awayScore} ${pick.awayTeam}.`,
      });
    }
  }

  const hatTrick = roundFixtures
    .flatMap((f) => {
      const detail = f.matchDetail;
      if (!detail) return [];
      return [
        ...detail.home.tryScorers.map((s) => ({
          ...s,
          club: f.homeTeam,
          fixtureId: f.id,
        })),
        ...detail.away.tryScorers.map((s) => ({
          ...s,
          club: f.awayTeam,
          fixtureId: f.id,
        })),
      ];
    })
    .filter((s) => s.tries >= 3)
    .sort((a, b) => b.tries - a.tries)[0];
  if (hatTrick) {
    items.push({
      id: `news-champ-hat-${hatTrick.fixtureId}-${hatTrick.playerId}`,
      week,
      type: "result",
      text: `${hatTrick.name} ran riot for ${hatTrick.club} with a ${hatTrick.tries}-try haul in the Championship.`,
    });
  }

  if (bottom && bottom.position >= 18 && rng() < 0.35) {
    items.push({
      id: `news-champ-bottom-w${week}`,
      week,
      type: "result",
      text: `${bottom.team} remain rooted near the foot of the Championship table.`,
    });
  }

  const champTransfers = (career.leagueTransfers ?? []).filter(
    (tx) => tx.week >= week - 1 && !isCurrentPlayableClub(tx.fromClub)
  );
  for (const tx of champTransfers.slice(0, 1)) {
    items.push({
      id: `news-champ-tx-${tx.id}`,
      week: tx.week,
      type: "transfer",
      text: `Championship exit: ${tx.playerName} leaves ${tx.fromClub} for Super League side ${tx.toClub}.`,
    });
  }

  return items;
}

export function generateWeeklyNews(career: ManagerCareer): LatestNewsItem[] {
  const rng = seedrandom(`${career.seed}-news-w${career.gameWeek}`);
  const items: LatestNewsItem[] = [];
  const week = career.gameWeek;
  const pos = getUserLeaguePosition(career.leagueTable, career.club);

  const next = getNextManagerFixture(career);
  if (next && next.competition === "league") {
    items.push({
      id: `news-fixture-${week}`,
      week,
      type: "fixture",
      text: isMagicWeekendFixture(next)
        ? `${career.club} head to Magic Weekend at ${MAGIC_WEEKEND_VENUE} to face rivals ${next.opponent}.`
        : `${career.club} prepare for ${next.isHome ? "home" : "away"} clash with ${next.opponent} in Round ${next.round}.`,
    });
  }

  const last = career.lastMatchFixture;
  if (last && last.round >= week - 1) {
    const won = last.result === "W";
    const margin = Math.abs(last.pointsFor - last.pointsAgainst);
    if (margin >= 20) {
      items.push({
        id: `news-result-${week}-${last.fixtureId ?? last.round}`,
        week,
        type: "result",
        text: won
          ? `${career.club} thrashed ${last.opponent} ${last.pointsFor}-${last.pointsAgainst}.`
          : `${career.club} suffered a heavy defeat to ${last.opponent}.`,
      });
    } else if (won) {
      items.push({
        id: `news-result-${week}-${last.fixtureId ?? last.round}`,
        week,
        type: "result",
        text: `${career.club} beat ${last.opponent} ${last.pointsFor}-${last.pointsAgainst}.`,
      });
    }
  }

  items.push(...championshipNewsItems(career, rng));

  const recentPurchase = career.inboxMessages.find(
    (m) =>
      (m.type === "transfer_complete" ||
        (m.type === "transfer" && m.title === "Transfer Completed")) &&
      m.week >= week - 1
  );
  if (recentPurchase) {
    items.push({
      id: `news-purchase-${recentPurchase.id}`,
      week,
      type: "transfer",
      text: recentPurchase.body.split("\n")[0] ?? recentPurchase.title,
    });
  }

  for (const tx of career.leagueTransfers.slice(0, 2)) {
    items.push({
      id: `news-league-tx-${tx.id}`,
      week: tx.week,
      type: "transfer",
      text: `${tx.playerName} joined ${tx.toClub} from ${tx.fromClub}.`,
    });
  }

  const recentSale = career.inboxMessages.find(
    (m) => m.type === "sale" && m.week >= week - 1
  );
  if (recentSale) {
    items.push({
      id: `news-sale-${recentSale.id}`,
      week,
      type: "transfer",
      text: recentSale.body.split("\n")[0] ?? recentSale.title,
    });
  }

  const topReserve = [...career.reserves]
    .sort((a, b) => b.rating - a.rating)
    .find((r) => r.rating >= 84 && r.form >= 55);
  if (topReserve && rng() < 0.45) {
    items.push({
      id: `news-reserve-${week}-${topReserve.id}`,
      week,
      type: "reserve",
      text: `Reserve ${topReserve.position.toLowerCase().replace("_", " ")} ${topReserve.name} pushing for a first-team call-up.`,
    });
  }

  if (pos <= 3 && career.wins >= 3) {
    items.push({
      id: `news-table-${week}`,
      week,
      type: "result",
      text: `${career.club} sit ${pos === 1 ? "top" : `${pos}rd`} of the table after ${career.wins} wins.`,
    });
  }

  if (career.boardConfidence >= 75) {
    items.push({
      id: `news-board-${week}`,
      week,
      type: "board",
      text: `The board are pleased with progress at ${career.club}.`,
    });
  } else if (career.boardConfidence < 40) {
    items.push({
      id: `news-board-low-${week}`,
      week,
      type: "board",
      text: `Pressure growing on the ${career.club} manager after a tough run.`,
    });
  }

  const listed = career.leagueListedPlayers[0];
  if (listed && rng() < 0.35) {
    items.push({
      id: `news-transfer-${week}`,
      week,
      type: "transfer",
      text: `${listed.club} have ${listed.playerId ? "a player" : "talent"} available for around ${formatWage(listed.askingPrice)}.`,
    });
  }

  // Prefer a mix of SL + Championship headlines when both exist
  const champIds = new Set(
    items.filter((i) => i.id.includes("champ")).map((i) => i.id)
  );
  if (champIds.size > 0 && items.length > DISPLAY_COUNT) {
    const preferred = [
      ...items.filter((i) => champIds.has(i.id)).slice(0, 2),
      ...items.filter((i) => !champIds.has(i.id)),
    ];
    const deduped = preferred.filter(
      (item, idx, arr) => arr.findIndex((x) => x.id === item.id) === idx
    );
    return deduped.slice(0, DISPLAY_COUNT);
  }

  return items.slice(0, DISPLAY_COUNT);
}

export function rotateLatestNews(career: ManagerCareer): ManagerCareer {
  if (career.gameWeek <= 0 && career.fixtures.length === 0) return career;

  const fresh = generateWeeklyNews(career);
  const existing = career.latestNews.filter((n) => n.week < career.gameWeek - 2);
  const merged = [...fresh, ...existing]
    .filter(
      (item, idx, arr) => arr.findIndex((x) => x.id === item.id) === idx
    )
    .slice(0, MAX_STORED);

  return { ...career, latestNews: merged };
}

export function getHubNewsItems(career: ManagerCareer): LatestNewsItem[] {
  const fresh = generateWeeklyNews(career);
  return [...fresh, ...career.latestNews]
    .filter(
      (item, idx, arr) => arr.findIndex((x) => x.id === item.id) === idx
    )
    .slice(0, DISPLAY_COUNT);
}

/** @alias getHubNewsItems — league-wide headlines for Across the League */
export const getLeagueNewsItems = getHubNewsItems;
