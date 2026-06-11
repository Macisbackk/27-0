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
  compact?: boolean;
}

const LOW_BUDGET_THRESHOLD = FANTASY_BUDGET * 0.1;

export function FantasyBudgetPanel({ squad, compact }: FantasyBudgetPanelProps) {
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

  const stats = (
    <>
      <BudgetStat
        label="Budget remaining"
        value={formatValue(Math.max(0, budgetRemaining))}
        accent={remainingAccent}
        prominent={!compact}
      />
      <BudgetStat
        label="Squad value used"
        value={formatValue(totalValue)}
        accent="text-white"
        prominent={!compact}
      />
      <BudgetStat
        label="Total budget"
        value={formatValue(FANTASY_BUDGET)}
        accent="text-gray-300"
        prominent={!compact}
      />
    </>
  );

  if (compact) {
    return (
      <div
        className={`${CARD.elevated} ${panelRing} grid grid-cols-3 gap-2 p-2 sm:gap-3 sm:p-3`}
      >
        {stats}
      </div>
    );
  }

  return (
    <div className={`${CARD.elevated} ${panelRing} p-3 sm:p-4`}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className={TYPO.sectionLabel}>Budget</p>
        <p className="text-xs text-gray-500">
          {filledCount}/{FANTASY_SQUAD_SIZE} signed
          {averageRating > 0 && <> · {averageRating} OVR avg</>}
        </p>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 sm:mt-3 sm:grid-cols-3 sm:gap-3">
        {stats}
      </div>

      <div className="mt-3 sm:mt-4">
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-gray-500 sm:text-xs">
          <span>Budget used</span>
          <span>{spentPct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-pitch-950/80">
          <div
            className={`h-full rounded-full transition-all ${progressBarClass}`}
            style={{ width: `${spentPct}%` }}
          />
        </div>
      </div>

      {overBudget && (
        <p className="mt-2 text-sm font-medium text-accent-red sm:mt-3">
          Squad exceeds budget — remove a player or pick a cheaper option.
        </p>
      )}
      {!overBudget && lowBudget && (
        <p className="mt-2 text-sm font-medium text-accent-gold sm:mt-3">
          Budget running low — choose remaining signings carefully.
        </p>
      )}

      <p className="mt-2 text-xs text-gray-500 sm:mt-3">
        {FANTASY_SQUAD_SIZE} players · {FANTASY_SEASON_ROUNDS} rounds
      </p>
    </div>
  );
}

function BudgetStat({
  label,
  value,
  accent = "text-white",
  prominent = false,
}: {
  label: string;
  value: string;
  accent?: string;
  prominent?: boolean;
}) {
  return (
    <div className={`${CARD.stat} px-2.5 py-2 sm:px-3 sm:py-2.5`}>
      <p className="text-[10px] uppercase tracking-wider text-gray-500 sm:text-xs">
        {label}
      </p>
      <p
        className={`mt-0.5 font-display font-bold ${accent} ${
          prominent
            ? "text-xl sm:text-2xl"
            : "text-base sm:text-lg"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
