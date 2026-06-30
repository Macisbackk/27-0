import {
  deriveCupOutcomeFromBracket,
  getCupRoundLabel,
} from "../game/challenge-cup-bracket";
import type { InboxMessage, ManagerCareer } from "./types";
import {
  getPendingCupBracketRound,
  getUserCupMatch,
  prepareCupRound,
} from "./managerChallengeCup";
import {
  computeManagerSeasonRewardLines,
  formatRewardTotal,
} from "./managerSeasonRewards";
import { buildSeasonSummary } from "./managerState";
import { formatWage } from "./managerContracts";
import { getUserLeaguePosition } from "./managerFixtures";

export function normalizeInboxMessage(
  raw: Partial<InboxMessage> & { id: string; title: string; body: string },
  career: ManagerCareer
): InboxMessage {
  const week = raw.week ?? raw.gameWeek ?? career.gameWeek;
  const read =
    raw.read ?? (raw.resolved === true ? true : false);
  let type = raw.type ?? "general";
  if (type === "transfer_offer_in") type = "transfer";
  if (type === "cup_draw") type = "fixture";

  return {
    id: raw.id,
    type,
    title: raw.title,
    body: raw.body,
    week,
    season: raw.season ?? career.seasonYear,
    gameWeek: week,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    read,
    resolved: raw.resolved,
    playerId: raw.playerId,
    playerName: raw.playerName,
    offerClub: raw.offerClub,
    offerAmount: raw.offerAmount,
    askingPrice: raw.askingPrice,
  };
}

export function pushInboxMessage(
  career: ManagerCareer,
  message: InboxMessage
): ManagerCareer {
  const normalized = normalizeInboxMessage(message, career);
  if (career.inboxMessages.some((m) => m.id === normalized.id)) {
    return career;
  }
  return {
    ...career,
    inboxMessages: [normalized, ...career.inboxMessages],
    updatedAt: new Date().toISOString(),
  };
}

export function resolveInboxMessage(
  career: ManagerCareer,
  messageId: string
): ManagerCareer {
  return {
    ...career,
    inboxMessages: career.inboxMessages.map((m) =>
      m.id === messageId ? { ...m, resolved: true, read: true } : m
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function markInboxMessagesRead(career: ManagerCareer): ManagerCareer {
  const hasUnread = career.inboxMessages.some((m) => !m.read);
  if (!hasUnread) return career;
  return {
    ...career,
    inboxMessages: career.inboxMessages.map((m) =>
      m.read ? m : { ...m, read: true }
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function createPlayerSaleMessage(
  career: ManagerCareer,
  playerName: string,
  buyerClub: string,
  fee: number
): InboxMessage {
  return normalizeInboxMessage(
    {
      id: `sale-${playerName}-${career.gameWeek}-${Date.now()}`,
      type: "sale",
      title: "Transfer Completed",
      body: `${playerName} has joined ${buyerClub} for ${formatWage(fee)}.\nThe fee has been added to your transfer budget.`,
      read: false,
      resolved: false,
    },
    career
  );
}

export function syncCupDrawInboxMessages(career: ManagerCareer): ManagerCareer {
  if (career.isSeasonComplete) return career;

  const cupRound = getPendingCupBracketRound(career);
  if (cupRound === null) return career;

  const prepared = prepareCupRound(career);
  const cupMatch = getUserCupMatch(prepared);
  if (!cupMatch) return career;

  const msgId = `cup-draw-${cupMatch.matchId}`;
  if (career.inboxMessages.some((m) => m.id === msgId)) return career;

  const roundLabel = getCupRoundLabel(cupMatch.round);
  const venue = cupMatch.isHome ? "Home" : "Away";

  return pushInboxMessage(career, {
    id: msgId,
    type: "fixture",
    title: "Challenge Cup Draw",
    body: `${roundLabel}: ${career.club} vs ${cupMatch.opponent} (${venue}). Check Fixtures when you're ready to play.`,
    week: career.gameWeek,
    season: career.seasonYear,
    gameWeek: career.gameWeek,
    createdAt: new Date().toISOString(),
    read: false,
    resolved: false,
    offerClub: cupMatch.opponent,
  });
}

export function addSeasonRewardInboxMessage(
  career: ManagerCareer
): ManagerCareer {
  const msgId = `season-reward-s${career.seasonYear}`;
  if (career.inboxMessages.some((m) => m.id === msgId)) return career;

  const summary = buildSeasonSummary(career);
  const lines = computeManagerSeasonRewardLines(career, summary);
  const total = formatRewardTotal(lines);
  const position =
    summary.position ??
    getUserLeaguePosition(career.leagueTable, career.club);
  const cupOutcome = deriveCupOutcomeFromBracket(career.challengeCup);

  return pushInboxMessage(career, {
    id: msgId,
    type: "season_reward",
    title: "Season Complete",
    body: `${career.seasonYear} season finished — ${position}${getOrdinal(position)} in the league, Challenge Cup: ${cupOutcome.label}. Club Funds rewards available: ${total}.`,
    week: career.gameWeek,
    season: career.seasonYear,
    gameWeek: career.gameWeek,
    createdAt: new Date().toISOString(),
    read: false,
    resolved: false,
  });
}

function getOrdinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  const mod10 = n % 10;
  if (mod10 === 1) return "st";
  if (mod10 === 2) return "nd";
  if (mod10 === 3) return "rd";
  return "th";
}

export function syncManagerInboxMessages(career: ManagerCareer): ManagerCareer {
  let next = syncCupDrawInboxMessages(career);
  if (next.isSeasonComplete) {
    next = addSeasonRewardInboxMessage(next);
  }
  return next;
}

export function countUnreadInbox(career: ManagerCareer): number {
  return career.inboxMessages.filter((m) => !m.read).length;
}

export function hydrateInboxMessages(career: ManagerCareer): ManagerCareer {
  return {
    ...career,
    inboxMessages: (career.inboxMessages ?? []).map((m) =>
      normalizeInboxMessage(m, career)
    ),
  };
}
