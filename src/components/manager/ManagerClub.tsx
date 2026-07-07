"use client";

import { useMemo, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import {
  ManagerSectionCard,
  ManagerStat,
} from "@/components/manager/manager-ui";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { FacilityType, ManagerCareer } from "@/lib/manager/types";
import { formatWage } from "@/lib/manager/managerContracts";
import { getTransferBudget } from "@/lib/manager/managerFinance";
import {
  FACILITY_DESCRIPTIONS,
  FACILITY_LABELS,
  FACILITY_MAX_LEVEL,
  formatFacilityStars,
  getClubFacilities,
  getFacilityEffectSummary,
  getFacilityUpgradeCost,
  getNextFacilityEffectPreview,
  purchaseFacilityUpgrade,
} from "@/lib/manager/managerFacilities";
import { getClubAttendanceProfile } from "@/lib/manager/managerAttendance";
import { playUiClick } from "@/lib/sound";

interface ManagerClubProps {
  career: ManagerCareer;
  onUpdate: (career: ManagerCareer) => void;
}

const FACILITY_ORDER: FacilityType[] = [
  "youth",
  "training",
  "stadium",
  "commercial",
];

const FACILITY_ICONS: Record<FacilityType, string> = {
  youth: "🎓",
  training: "🏋️",
  stadium: "🏟️",
  commercial: "📈",
};

export function ManagerClub({ career, onUpdate }: ManagerClubProps) {
  const [error, setError] = useState<string | null>(null);
  const facilities = getClubFacilities(career);
  const transferFund = getTransferBudget(career);
  const baseCapacity = getClubAttendanceProfile(career.club).capacity;

  const facilityRows = useMemo(
    () =>
      FACILITY_ORDER.map((type) => {
        const level = facilities[type];
        const cost = getFacilityUpgradeCost(career, type);
        const canAfford = cost != null && transferFund >= cost;
        return {
          type,
          level,
          cost,
          canAfford,
          maxed: level >= FACILITY_MAX_LEVEL,
        };
      }),
    [career, facilities, transferFund]
  );

  const handleUpgrade = (type: FacilityType) => {
    playUiClick();
    setError(null);
    const result = purchaseFacilityUpgrade(career, type);
    if (!result.ok || !result.career) {
      setError(result.error ?? "Upgrade failed.");
      return;
    }
    onUpdate(result.career);
  };

  return (
    <div className={`w-full ${SPACING.stackLg}`}>
      <div>
        <h1 className={TYPO.viewTitle}>Club</h1>
        <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
          Invest transfer funds to improve facilities — each area upgrades one
          star at a time (0–5).
        </p>
      </div>

      <ManagerSectionCard title="Investment fund" variant="elevated" accent="primary">
        <div className="mt-2 grid grid-cols-2 gap-3">
          <ManagerStat
            label="Available for upgrades"
            value={formatWage(transferFund)}
            tone="gold"
            large
          />
          <ManagerStat
            label="Stadium capacity"
            value={`${career.attendanceData.stadiumCapacity.toLocaleString()}`}
            tone="default"
            large
          />
        </div>
        <p className={`mt-3 ${TYPO.bodySm} text-pitch-500`}>
          Base capacity {baseCapacity.toLocaleString()} — stadium upgrades add up
          to +20% seats at five stars.
        </p>
      </ManagerSectionCard>

      {error && (
        <p className={`${CARD.base} ${SPACING.cardPadding} ${TYPO.bodySm} text-amber-300`}>
          {error}
        </p>
      )}

      <div className={`grid gap-3 lg:grid-cols-2 ${SPACING.cardGridGap}`}>
        {facilityRows.map(({ type, level, cost, canAfford, maxed }) => (
          <ManagerSectionCard
            key={type}
            title={`${FACILITY_ICONS[type]} ${FACILITY_LABELS[type]}`}
            variant="elevated"
          >
            <div className="mt-2 flex items-center justify-between gap-3">
              <div>
                <p className="font-display text-lg font-bold tracking-wide text-accent-gold">
                  {formatFacilityStars(level)}
                </p>
                <p className={`mt-0.5 ${TYPO.bodySm} text-pitch-500`}>
                  Level {level} / {FACILITY_MAX_LEVEL}
                </p>
              </div>
              {type === "stadium" && level > 0 && (
                <ManagerStat
                  label="Capacity"
                  value={career.attendanceData.stadiumCapacity.toLocaleString()}
                  tone="muted"
                />
              )}
            </div>

            <p className={`mt-3 ${TYPO.bodySm} text-pitch-400`}>
              {FACILITY_DESCRIPTIONS[type]}
            </p>

            <p className={`mt-2 ${TYPO.bodySm} text-theme-primary`}>
              {getFacilityEffectSummary(type, level)}
            </p>

            {!maxed && getNextFacilityEffectPreview(type, level) && (
              <p className={`mt-1 ${TYPO.bodySm} text-pitch-500`}>
                Next star: {getNextFacilityEffectPreview(type, level)}
              </p>
            )}

            <div className="mt-4 border-t border-pitch-700/40 pt-4">
              {maxed ? (
                <p className={`${TYPO.bodySm} font-semibold text-accent-gold`}>
                  Maximum level reached
                </p>
              ) : (
                <GameButton
                  variant="theme"
                  size="sm"
                  fullWidth
                  disabled={!canAfford}
                  onClick={() => handleUpgrade(type)}
                >
                  Upgrade to {formatFacilityStars(level + 1).replace(/☆/g, "").trim()}
                  {cost != null ? ` — ${formatWage(cost)}` : ""}
                </GameButton>
              )}
            </div>
          </ManagerSectionCard>
        ))}
      </div>
    </div>
  );
}
