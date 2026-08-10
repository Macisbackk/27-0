import type { ManagerView } from "./types";
import type { ManagerCareer } from "./types";
import { countExpiringContracts } from "./managerContracts";
import { countUnreadInbox } from "./managerInbox";
import { isWageOverBudget } from "./managerFinance";
import { validateFitMatchdaySquad } from "./managerMatchdayValidation";
import { resolveCareerForMatchSimulation } from "./managerAutoFix";
import { RESERVE_MIN_PLAYERS } from "./managerReserves";
import { getUserLeaguePosition } from "./managerFixtures";

export type HubAlertTone = "primary" | "gold" | "amber" | "red";

export interface HubAlert {
  id: string;
  tone: HubAlertTone;
  title: string;
  body: string;
  actionLabel?: string;
  actionView?: ManagerView;
}

export function getManagerHubAlerts(career: ManagerCareer): HubAlert[] {
  const alerts: HubAlert[] = [];
  const unread = countUnreadInbox(career);
  const expiring = countExpiringContracts(career);
  const reserveShort = Math.max(0, RESERVE_MIN_PLAYERS - career.reserves.length);
  const squadCheck = validateFitMatchdaySquad(
    resolveCareerForMatchSimulation(career)
  );
  const position = getUserLeaguePosition(career.leagueTable, career.club);
  const wageOver = isWageOverBudget(career);
  const wagePressure = career.wagePressureWeeks ?? 0;

  if (career.isSeasonComplete) {
    alerts.push({
      id: "season-review",
      tone: "gold",
      title: "Season complete",
      body: "Open Season Review to continue.",
      actionLabel: "Season Review",
      actionView: "season-review",
    });
  }

  if (unread > 0) {
    alerts.push({
      id: "inbox",
      tone: "primary",
      title: `${unread} unread`,
      body: "New inbox messages.",
      actionLabel: "Inbox",
      actionView: "inbox",
    });
  }

  if (!squadCheck.valid) {
    alerts.push({
      id: "matchday",
      tone: "red",
      title: "Squad incomplete",
      body: squadCheck.message,
      actionLabel: "Squad",
      actionView: "squad",
    });
  }

  if (reserveShort > 0) {
    alerts.push({
      id: "reserves",
      tone: "red",
      title: `Reserves ${career.reserves.length}/${RESERVE_MIN_PLAYERS}`,
      body: "Need 13 reserves or risk a walkover.",
      actionLabel: "Reserves",
      actionView: "reserves",
    });
  }

  if (wageOver || wagePressure >= 2) {
    alerts.push({
      id: "wages",
      tone: "amber",
      title: wageOver ? "Wages over budget" : "Wages watched",
      body: wageOver
        ? "Cut wages or release players."
        : `${wagePressure}w over — confidence at risk.`,
      actionLabel: "Contracts",
      actionView: "contracts",
    });
  }

  if (expiring >= 3) {
    alerts.push({
      id: "contracts",
      tone: "amber",
      title: `${expiring} expiring`,
      body: "Renew before they leave free.",
      actionLabel: "Contracts",
      actionView: "contracts",
    });
  }

  alerts.push({
    id: "objective",
    tone: position <= 6 ? "gold" : "primary",
    title: career.boardExpectation,
    body: `${position}${
      position === 1 ? "st" : position === 2 ? "nd" : position === 3 ? "rd" : "th"
    } · ${career.boardConfidence}% confidence`,
  });

  return alerts;
}

/** Hub-facing urgent alerts — only actionable problems, not routine inbox noise. */
export function getManagerHubUrgentAlerts(career: ManagerCareer): HubAlert[] {
  return getManagerHubAlerts(career).filter(
    (alert) =>
      alert.id === "season-review" ||
      alert.id === "matchday" ||
      alert.id === "reserves" ||
      alert.id === "wages" ||
      (alert.id === "contracts" && alert.tone === "amber")
  );
}
