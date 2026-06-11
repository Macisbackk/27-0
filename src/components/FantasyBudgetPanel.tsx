"use client";

import { formatValue } from "@/lib/players";
import {
  FANTASY_BUDGET,
  FANTASY_SEASON_ROUNDS,
  FANTASY_SQUAD_SIZE,
  getFantasySquadSummary,
} from "@/lib/game/fantasy-mode";
import type { SquadSlot } from "@/lib/types";
import { CARD } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

interface FantasyBudgetPanelProps {
  squad: SquadSlot[];
}

const LOW_BUDGET_THRESHOLD = FANTASY_BUDGET * 0.1;

export function FantasyBudgetPanel({ squad }: FantasyBudgetPanelProps) {
  const { totalValue, budgetRemaining, averageRating } =
    getFantasySquadSummary(squad);
  const overBudget = budgetRemaining < 0;
  const lowBudget =
    !overBudget && budgetRemaining <= LOW_BUDGET_THRESHOLD;
  const spentPct = Math.min(100, Math.round((totalValue / FANTASY_BUDGET) * 100));
  const filledCount = squad.filter((s) => s.player).length;

  const panelRing = overBudget
    ? CARD.featuredHard
    : lowBudget
      ? "border border-accent-gold/25 shadow-[0_0_24px_rgba(234,179,8,0.08)]"
      : CARD.featured;

  const remainingAccent = overBudget
    ? "text-accent-red"
    : lowBudget
      ? "text-accent-gold"
      : "text-accent-green";

  const progressBarClass = overBudget
    ? "bg-accent-red"
    : lowBudget
      ? "bg-accent-gold"
      : "bg-accent-green";

  return (
    <div className={`${CARD.elevated} ${panelRing} p-3 sm:p-4`}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className={TYPO.sectionLabel}>Budget</p>
        <p className="text-[11px] text-gray-500 sm:text-xs">
          {filledCount}/{FANTASY_SQUAD_SIZE} signed
          {averageRating > 0 && <> · {averageRating} OVR avg</>}
        </p>
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-2 sm:mt-3 sm:gap-3">
        <BudgetStat
          label="Remaining"
          value={formatValue(Math.max(0, budgetRemaining))}
          accent={remainingAccent}
        />
        <BudgetStat
          label="Squad used"
          value={formatValue(totalValue)}
          accent="text-white"
        />
        <BudgetStat
          label="Total"
          value={formatValue(FANTASY_BUDGET)}
          accent="text-gray-300"
        />
      </div>

      <div className="mt-2.5 sm:mt-3">
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-gray-500">
          <span>Budget used</span>
          <span>{spentPct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-pitch-950/80 sm:h-2">
          <div
            className={`h-full rounded-full transition-all ${progressBarClass}`}
            style={{ width: `${spentPct}%` }}
          />
        </div>
      </div>

      {overBudget && (
        <p className="mt-2 text-xs font-medium text-accent-red sm:text-sm">
          Squad exceeds budget — remove a player or pick a cheaper option.
        </p>
      )}
      {!overBudget && lowBudget && (
        <p className="mt-2 text-xs font-medium text-accent-gold sm:text-sm">
          Budget running low — choose remaining signings carefully.
        </p>
      )}
    </div>
  );
}

function BudgetStat({
  label,
  value,
  accent = "text-white",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className={`${CARD.stat} min-w-0 px-2 py-1.5 sm:px-2.5 sm:py-2`}>
      <p className="truncate text-[9px] uppercase tracking-wider text-gray-500 sm:text-[10px]">
        {label}
      </p>
      <p
        className={`mt-0.5 truncate font-display text-base font-bold sm:text-lg ${accent}`}
      >
        {value}
      </p>
    </div>
  );
}
