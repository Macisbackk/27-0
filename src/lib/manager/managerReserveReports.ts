import type { ManagerCareer } from "./types";
import type { InboxMessage } from "./types";
import { getPotentialTier } from "./managerReserves";
import { POSITION_SHORT } from "../positions";
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
  const progressing: string[] = [];
  const stalled: string[] = [];
  const contractRecs: string[] = [];
  const releaseRecs: string[] = [];

  const recentResults = career.reserveResults.slice(-4);
  const formWins = recentResults.filter((r) => r.userWon).length;

  const sorted = [...career.reserves].sort((a, b) => b.rating - a.rating);

  for (const r of sorted.slice(0, 8)) {
    const growth = r.rating - r.baseRating;
    const tier = getPotentialTier(r.potentialRating);
    const pos = POSITION_SHORT[r.position];

    if (growth >= 2 || (r.reserveTries >= 3 && r.form >= 60)) {
      progressing.push(
        `- ${r.name} has improved to ${r.rating} (${tier.toLowerCase()}).`
      );
    } else if (growth <= 0 && r.form < 45 && r.reserveAppearances >= 3) {
      stalled.push(`- ${r.name} has stalled at ${r.rating} rated.`);
    }

    const squadAtPos = career.squad.filter((ps) => {
      const p = career.playerRegistry[ps.playerId];
      return p?.position === r.position;
    }).length;

    if (
      r.rating >= 72 &&
      r.potentialRating >= 78 &&
      r.form >= 55 &&
      squadAtPos <= 3
    ) {
      contractRecs.push(
        `- Consider a full-time contract for ${r.name} (${pos}, ${r.rating} rated).`
      );
    }

    if (
      r.potentialRating < 72 &&
      r.rating <= r.baseRating &&
      r.form < 40 &&
      r.reserveAppearances >= 6
    ) {
      releaseRecs.push(
        `- ${r.name} may be surplus at ${pos} with limited upside.`
      );
    }
  }

  const standout = [...career.reserves]
    .filter((r) => r.reserveTries > 0)
    .sort((a, b) => b.reserveTries - a.reserveTries)[0];

  const lines: string[] = [
    `Reserve Development Report — Month ${month}`,
    "",
  ];

  if (progressing.length) {
    lines.push("Progressing well:", ...progressing.slice(0, 3), "");
  } else {
    lines.push("Progressing well:", "- No major breakthroughs this month.", "");
  }

  if (stalled.length) {
    lines.push("Needs attention:", ...stalled.slice(0, 2), "");
  }

  if (standout) {
    lines.push(
      `Standout: ${standout.name} — ${standout.reserveTries} reserve tries.`,
      ""
    );
  }

  lines.push(`Reserve form: ${formWins} wins from last ${recentResults.length || 0} fixtures.`);

  if (contractRecs.length) {
    lines.push("", "Recommendation:", ...contractRecs.slice(0, 2));
  }
  if (releaseRecs.length) {
    lines.push("", "Release consideration:", ...releaseRecs.slice(0, 1));
  }

  return {
    id: `reserve-report-w${career.gameWeek}`,
    type: "reserve_report",
    title: "Reserve Development Report",
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
