import { getNationalityAbbrev } from "../players/nationality";
import { formatValue } from "../players";
import { POSITION_SHORT } from "../positions";
import type { Position } from "../types";
import { formatWage, getContractStatus } from "./managerContracts";
import { findPlayerMatchdaySlot } from "./managerMatchdaySquad";
import { getActiveRetraining, getRetrainingProgress } from "./managerPositionRetraining";
import { reserveToPlayer } from "./managerPlayers";
import {
  formatReserveGrowthDelta,
  getReserveSignedGrowthDelta,
  getReserveSignedRating,
  SENIOR_SQUAD_LIMIT,
} from "./managerReserves";
import type { ManagerCareer, ManagerReservePlayer } from "./types";

/** Mirrors the tone keys accepted by `managerPillClass`. */
export type ReserveCardTone =
  | "primary"
  | "gold"
  | "sky"
  | "amber"
  | "red"
  | "muted"
  | "stone";

export interface ReserveCardChip {
  label: string;
  tone: ReserveCardTone;
  title?: string;
}

/**
 * Squad status uses registration facts, never rating bands. "Fringe" and
 * "Development" are deliberately absent — they described nothing real.
 * "Senior Squad Eligible" is reserved for explicit registration readiness
 * (currently: already called up for first-team duty).
 */
export type ReserveSquadStatus =
  | "reserve"
  | "first-team-registered"
  | "senior-squad-eligible";

export const RESERVE_SQUAD_STATUS_LABELS: Record<ReserveSquadStatus, string> = {
  reserve: "Reserve",
  "first-team-registered": "First-Team Registered",
  "senior-squad-eligible": "Senior Squad Eligible",
};

/** Selection in the saved matchday squad — never inferred from rating. */
export type ReserveLineupStatus =
  | "starting"
  | "interchange"
  | "not-selected"
  | "unavailable";

export const RESERVE_LINEUP_LABELS: Record<ReserveLineupStatus, string> = {
  starting: "Starting",
  interchange: "Interchange",
  "not-selected": "Not Selected",
  unavailable: "Unavailable",
};

export interface ReserveDevelopmentSummary {
  /** Active position programme, when one exists in saved data. */
  trainingLabel: string | null;
  /** 0–100, only present alongside `trainingLabel`. */
  trainingProgressPercent: number | null;
  /** Growth since signing, e.g. "+4". */
  growthLabel: string;
  growthDelta: number;
  potentialReached: boolean;
}

export interface ReserveContractSummary {
  expiryLabel: string;
  wageLabel: string | null;
  valueLabel: string;
  needsRenewal: boolean;
  renewalStatusLabel: string | null;
  listed: boolean;
}

export interface ReservePromotionCheck {
  allowed: boolean;
  /** Populated only when `allowed` is false — shown on the disabled action. */
  reason: string | null;
}

export interface ReserveCardModel {
  id: string;
  name: string;
  /** "PROP • ENG • Age 19" */
  metaLine: string;
  primaryPositionLabel: string;
  secondaryPositionLabel: string | null;
  nationalityAbbrev: string;
  age: number;
  currentRating: number;
  potential: number;
  signedRating: number;
  squadStatus: ReserveSquadStatus;
  squadStatusLabel: string;
  lineupStatus: ReserveLineupStatus;
  lineupStatusLabel: string;
  statusChips: ReserveCardChip[];
  development: ReserveDevelopmentSummary;
  contract: ReserveContractSummary;
  promotion: ReservePromotionCheck;
  canCallUp: boolean;
  reserveAppearances: number;
  reserveTries: number;
  form: number;
  fitness: number;
}

const RENEWAL_STATUS_LABELS: Record<string, string> = {
  expires_this_season: "Expires this season",
  one_year_left: "1 year left",
  long_term: "Long-term",
  wants_renewal: "Renewal due",
  renewed: "Renewed",
};

function warnMissingReserveData(reserve: ManagerReservePlayer, field: string) {
  if (process.env.NODE_ENV === "production") return;
  console.warn(
    `[reserve-card] ${reserve.id || "(no id)"} is missing canonical ${field}`
  );
}

export function getReservePositions(reserve: ManagerReservePlayer): Position[] {
  const eligible = reserve.eligiblePositions?.length
    ? reserve.eligiblePositions
    : reserve.position
      ? [reserve.position]
      : [];
  return eligible as Position[];
}

/** "PROP • ENG • Age 19" — same field order on every card. */
export function formatReserveMetaLine(reserve: ManagerReservePlayer): string {
  const positions = getReservePositions(reserve);
  if (positions.length === 0) warnMissingReserveData(reserve, "position");

  const positionLabel = positions
    .map((pos) => POSITION_SHORT[pos])
    .filter(Boolean)
    .join(" / ");

  const nationality = getNationalityAbbrev(reserve.nationality ?? "");
  if (!reserve.nationality) warnMissingReserveData(reserve, "nationality");

  return [positionLabel, nationality, `Age ${reserve.age}`]
    .filter((part) => Boolean(part))
    .join(" • ");
}

export function getReserveSquadStatus(
  career: ManagerCareer,
  reserve: ManagerReservePlayer
): ReserveSquadStatus {
  if (career.squad.some((p) => p.playerId === reserve.id)) {
    return "first-team-registered";
  }
  // A call-up places the player on the senior matchday sheet without promoting
  // them permanently — that is the only non-rating signal of senior readiness.
  if (reserve.calledUpForNextMatch) return "senior-squad-eligible";
  return "reserve";
}

export function getReserveLineupStatus(
  career: ManagerCareer,
  reserve: ManagerReservePlayer
): ReserveLineupStatus {
  const slot = findPlayerMatchdaySlot(career, reserve.id);
  if (slot) return slot.kind === "xiii" ? "starting" : "interchange";
  if (reserve.fitness > 0 && reserve.fitness < 50) return "unavailable";
  return "not-selected";
}

export function getReserveDevelopment(
  career: ManagerCareer,
  reserve: ManagerReservePlayer
): ReserveDevelopmentSummary {
  const training = getActiveRetraining(career, reserve.id);
  const growthDelta = getReserveSignedGrowthDelta(reserve);

  return {
    trainingLabel: training
      ? `${POSITION_SHORT[training.fromPosition]} → ${POSITION_SHORT[training.targetPosition]}`
      : null,
    trainingProgressPercent: training
      ? Math.round(getRetrainingProgress(training) * 100)
      : null,
    growthLabel: formatReserveGrowthDelta(growthDelta),
    growthDelta,
    potentialReached: reserve.rating >= reserve.potentialRating,
  };
}

export function getReserveContractSummary(
  career: ManagerCareer,
  reserve: ManagerReservePlayer
): ReserveContractSummary {
  const contract = career.reserveContracts?.[reserve.id];
  const player = reserveToPlayer(reserve, career.seasonYear);
  const listed = Boolean(career.playerTransferStatus?.[reserve.id]?.listed);

  if (!contract) {
    return {
      expiryLabel: "Not under contract",
      wageLabel: null,
      valueLabel: formatValue(player.value),
      needsRenewal: false,
      renewalStatusLabel: null,
      listed,
    };
  }

  const status = getContractStatus(contract);
  const needsRenewal =
    status === "expires_this_season" || status === "wants_renewal";
  const expiryYear =
    career.seasonYear + Math.max(0, contract.yearsRemaining - 1);

  return {
    expiryLabel:
      contract.yearsRemaining <= 0 || contract.expiresAtSeasonEnd
        ? `End of ${career.seasonYear}`
        : `End of ${expiryYear}`,
    wageLabel: `${formatWage(contract.wagePerYear)}/yr`,
    valueLabel: formatValue(player.value),
    needsRenewal,
    renewalStatusLabel: needsRenewal
      ? (RENEWAL_STATUS_LABELS[status] ?? status)
      : null,
    listed,
  };
}

/**
 * Promotion only moves squad assignment, so the sole blocker is registration
 * capacity. Injury and suspension never prevent a promotion.
 */
export function checkReservePromotion(
  career: ManagerCareer,
  reserve: ManagerReservePlayer
): ReservePromotionCheck {
  if (career.squad.some((p) => p.playerId === reserve.id)) {
    return { allowed: false, reason: "Already in the senior squad." };
  }
  if (career.squad.length >= SENIOR_SQUAD_LIMIT) {
    return {
      allowed: false,
      reason: `Senior squad is full (${career.squad.length}/${SENIOR_SQUAD_LIMIT}). Release or sell a player first.`,
    };
  }
  return { allowed: true, reason: null };
}

function buildStatusChips(
  model: Omit<ReserveCardModel, "statusChips">
): ReserveCardChip[] {
  const chips: ReserveCardChip[] = [
    {
      label: model.squadStatusLabel,
      tone:
        model.squadStatus === "first-team-registered"
          ? "primary"
          : model.squadStatus === "senior-squad-eligible"
            ? "sky"
            : "muted",
    },
    {
      label: model.lineupStatusLabel,
      tone:
        model.lineupStatus === "starting"
          ? "primary"
          : model.lineupStatus === "interchange"
            ? "sky"
            : model.lineupStatus === "unavailable"
              ? "red"
              : "muted",
    },
  ];

  if (model.contract.needsRenewal && model.contract.renewalStatusLabel) {
    chips.push({ label: model.contract.renewalStatusLabel, tone: "gold" });
  }
  if (model.contract.listed) {
    chips.push({ label: "Transfer Listed", tone: "gold" });
  }
  return chips;
}

export function buildReserveCardModel(
  career: ManagerCareer,
  reserve: ManagerReservePlayer
): ReserveCardModel {
  if (!reserve.id) warnMissingReserveData(reserve, "id");
  if (!reserve.name) warnMissingReserveData(reserve, "name");

  const positions = getReservePositions(reserve);
  const squadStatus = getReserveSquadStatus(career, reserve);
  const lineupStatus = getReserveLineupStatus(career, reserve);

  const base: Omit<ReserveCardModel, "statusChips"> = {
    id: reserve.id,
    name: reserve.name,
    metaLine: formatReserveMetaLine(reserve),
    primaryPositionLabel: positions[0] ? POSITION_SHORT[positions[0]] : "",
    secondaryPositionLabel: positions[1] ? POSITION_SHORT[positions[1]] : null,
    nationalityAbbrev: getNationalityAbbrev(reserve.nationality ?? ""),
    age: reserve.age,
    currentRating: reserve.rating,
    potential: reserve.potentialRating,
    signedRating: getReserveSignedRating(reserve),
    squadStatus,
    squadStatusLabel: RESERVE_SQUAD_STATUS_LABELS[squadStatus],
    lineupStatus,
    lineupStatusLabel: RESERVE_LINEUP_LABELS[lineupStatus],
    development: getReserveDevelopment(career, reserve),
    contract: getReserveContractSummary(career, reserve),
    promotion: checkReservePromotion(career, reserve),
    canCallUp: !reserve.calledUpForNextMatch,
    reserveAppearances: reserve.reserveAppearances ?? 0,
    reserveTries: reserve.reserveTries ?? 0,
    form: reserve.form ?? 0,
    fitness: reserve.fitness ?? 0,
  };

  return { ...base, statusChips: buildStatusChips(base) };
}
