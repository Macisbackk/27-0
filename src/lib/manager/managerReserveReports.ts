import type { ManagerCareer } from "./types";
import type { InboxMessage } from "./types";
import { getPotentialTier } from "./managerReserves";
import { pushInboxMessage } from "./managerInbox";

const REPORT_INTERVAL_WEEKS = 4;

export function shouldGenerateReserveReport(career: ManagerCareer): boolean {
  if (career.gameWeek < REPORT_INTERVAL_WEEKS) return false;
  const last = career.lastReserveReportWeek ?? 0;
  return career.gameWeek - last >= REPORT_INTERVAL_WEEKS;
}

export function generateReserveReportMessage(
  career: ManagerCareer
): InboxMessage {
  const month = Math.max(1, Math.floor(career.gameWeek / REPORT_INTERVAL_WEEKS));
  const sorted = [...career.reserves].sort((a, b) => b.rating - a.rating);
  const top = sorted[0];
  const improver = sorted.find((r) => r.rating > r.baseRating + 1);
  const recentResults = career.reserveResults.slice(-4);
  const formWins = recentResults.filter((r) => r.userWon).length;

  const lines: string[] = [`Reserve update — month ${month}`];

  if (improver) {
    lines.push(
      `${improver.name} is up to ${improver.rating} rated (${getPotentialTier(improver.potentialRating).toLowerCase()} potential).`
    );
  } else if (top) {
    lines.push(`${top.name} leads the reserves at ${top.rating} rated.`);
  }

  if (recentResults.length > 0) {
    const walkovers = recentResults.filter((r) => r.walkover).length;
    lines.push(
      `Reserve team: ${formWins} win${formWins === 1 ? "" : "s"} from last ${recentResults.length} games.`
    );
    if (walkovers > 0) {
      lines.push(
        `${walkovers} fixture${walkovers === 1 ? "" : "s"} decided by walkover (minimum 17 registered).`
      );
    }
  }

  return {
    id: `reserve-report-w${career.gameWeek}`,
    type: "reserve_report",
    title: "Monthly Reserve Report",
    body: lines.join("\n"),
    week: career.gameWeek,
    season: career.seasonYear,
    gameWeek: career.gameWeek,
    createdAt: new Date().toISOString(),
    read: false,
    resolved: false,
  };
}

export function maybeAddReserveReport(career: ManagerCareer): ManagerCareer {
  if (!shouldGenerateReserveReport(career)) return career;
  const msgId = `reserve-report-w${career.gameWeek}`;
  if (career.inboxMessages.some((m) => m.id === msgId)) return career;

  const msg = generateReserveReportMessage(career);
  return {
    ...pushInboxMessage(career, msg),
    lastReserveReportWeek: career.gameWeek,
  };
}

/** Unread monthly reserve report — surfaced as a popup on the hub. */
export function getPendingReserveReportPopup(
  career: ManagerCareer
): InboxMessage | undefined {
  return career.inboxMessages.find(
    (m) => m.type === "reserve_report" && !m.read
  );
}

export function acknowledgeReserveReportPopup(
  career: ManagerCareer,
  messageId: string
): ManagerCareer {
  return {
    ...career,
    inboxMessages: career.inboxMessages.map((m) =>
      m.id === messageId ? { ...m, read: true, resolved: true } : m
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function getReserveReportMonth(career: ManagerCareer): number {
  return Math.max(1, Math.floor(career.gameWeek / REPORT_INTERVAL_WEEKS));
}
