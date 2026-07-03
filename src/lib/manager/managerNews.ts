import seedrandom from "seedrandom";
import type { LatestNewsItem, ManagerCareer } from "./types";
import { getNextManagerFixture } from "./managerSimulation";
import { getUserLeaguePosition } from "./managerFixtures";
import { formatWage } from "./managerContracts";
import {
  MAGIC_WEEKEND_VENUE,
  isMagicWeekendFixture,
} from "./managerMagicWeekend";

const MAX_STORED = 10;
const DISPLAY_COUNT = 5;

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
    .find((r) => r.rating >= 70 && r.form >= 55);
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
