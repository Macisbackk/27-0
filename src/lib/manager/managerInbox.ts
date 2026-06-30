import seedrandom from "seedrandom";
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

export function pushInboxMessage(
  career: ManagerCareer,
  message: InboxMessage
): ManagerCareer {
  if (career.inboxMessages.some((m) => m.id === message.id)) {
    return career;
  }
  return {
    ...career,
    inboxMessages: [message, ...career.inboxMessages],
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
      m.id === messageId ? { ...m, resolved: true } : m
    ),
    updatedAt: new Date().toISOString(),
  };
}

/** Add Challenge Cup draw message when a new user tie becomes available. */
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
    type: "cup_draw",
    title: "Challenge Cup Draw",
    body: `${roundLabel}: ${career.club} vs ${cupMatch.opponent} (${venue}). Check Fixtures when you're ready to play.`,
    gameWeek: career.gameWeek,
    createdAt: new Date().toISOString(),
    resolved: false,
    offerClub: cupMatch.opponent,
  });
}

/** Season-end reward summary for the inbox. */
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
    gameWeek: career.gameWeek,
    createdAt: new Date().toISOString(),
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

/** Sync cup draws and season messages after career state changes. */
export function syncManagerInboxMessages(career: ManagerCareer): ManagerCareer {
  let next = syncCupDrawInboxMessages(career);
  if (next.isSeasonComplete) {
    next = addSeasonRewardInboxMessage(next);
  }
  return next;
}

export function countUnreadInbox(career: ManagerCareer): number {
  return career.inboxMessages.filter((m) => !m.resolved).length;
}
