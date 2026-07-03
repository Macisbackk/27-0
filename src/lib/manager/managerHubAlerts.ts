import type { ManagerView } from "./types";
import type { ManagerCareer } from "./types";
import { countExpiringContracts } from "./managerContracts";
import { countUnreadInbox } from "./managerInbox";
import { isWageOverBudget } from "./managerFinance";
import { validateFitMatchdaySquad } from "./managerMatchdayValidation";
import { resolveCareerForMatchSimulation } from "./managerAutoFix";
import { RESERVE_SQUAD_MIN } from "./managerReserves";
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
  const expiring = countExpiringContracts(career.contracts);
  const reserveShort = Math.max(0, RESERVE_SQUAD_MIN - career.reserves.length);
  const squadCheck = validateFitMatchdaySquad(
    resolveCareerForMatchSimulation(career)
  );
  const position = getUserLeaguePosition(career.leagueTable, career.club);
  const wageOver = isWageOverBudget(career);
  const wagePressure = career.wagePressureWeeks ?? 0;

  if (unread > 0) {
    alerts.push({
      id: "inbox",
      tone: "primary",
      title: `${unread} unread message${unread === 1 ? "" : "s"}`,
      body: "Board updates, transfer news, and contract reminders are waiting.",
      actionLabel: "Open inbox",
      actionView: "inbox",
    });
  }

  if (!squadCheck.valid) {
    alerts.push({
      id: "matchday",
      tone: "red",
      title: "Matchday squad incomplete",
      body: squadCheck.message,
      actionLabel: "Set lineup",
      actionView: "squad",
    });
  }

  if (reserveShort > 0) {
    alerts.push({
      id: "reserves",
      tone: "red",
      title: `Reserves short (${career.reserves.length}/${RESERVE_SQUAD_MIN})`,
      body: "Below 17 registered reserves risks an 18-0 walkover defeat.",
      actionLabel: "Manage reserves",
      actionView: "reserves",
    });
  }

  if (wageOver || wagePressure >= 2) {
    alerts.push({
      id: "wages",
      tone: "amber",
      title: wageOver ? "Wage bill over budget" : "Board watching wages",
      body: wageOver
        ? "Operating costs exceed your wage budget — release or renegotiate."
        : `${wagePressure} week${wagePressure === 1 ? "" : "s"} over budget — board confidence at risk.`,
      actionLabel: "View contracts",
      actionView: "contracts",
    });
  }

  if (expiring >= 3) {
    alerts.push({
      id: "contracts",
      tone: "amber",
      title: `${expiring} contracts expiring`,
      body: "Renew key players before they leave on a free.",
      actionLabel: "Renew contracts",
      actionView: "contracts",
    });
  }

  alerts.push({
    id: "objective",
    tone: position <= 6 ? "gold" : "primary",
    title: "Board objective",
    body: `Target: ${career.boardExpectation} · Currently ${position}${
      position === 1 ? "st" : position === 2 ? "nd" : position === 3 ? "rd" : "th"
    } · Confidence ${career.boardConfidence}%`,
  });

  return alerts;
}
