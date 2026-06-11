"use client";

import { formatValue } from "@/lib/players";
import {
  FANTASY_BUDGET,
  FANTASY_SEASON_ROUNDS,
  FANTASY_SQUAD_SIZE,
  getFantasyBudgetForSlot,
  getFantasySquadSummary,
} from "@/lib/game/fantasy-mode";
import type { SquadSlot } from "@/lib/types";
import { RL_INFO_BOX_CLASS } from "./cards/rl-card";
import { TYPO } from "@/lib/ui/typography";

interface FantasyBudgetPanelProps {
  squad: SquadSlot[];
  selectedSlot?: SquadSlot | null;
  compact?: boolean;
}

export function FantasyBudgetPanel({
  squad,
  selectedSlot,
  compact,
}: FantasyBudgetPanelProps) {
  const { totalValue, budgetRemaining, averageRating } =
    getFantasySquadSummary(squad);
  const overBudget = budgetRemaining < 0;
  const selectedCost = selectedSlot?.player?.value ?? null;
  const slotBudget = selectedSlot
    ? getFantasyBudgetForSlot(squad, selectedSlot)
    : null;

  if (compact) {
    return (
      <div className={`${RL_INFO_BOX_CLASS} grid grid-cols-2 gap-2 p-2 sm:grid-cols-4 sm:gap-3 sm:p-3`}>
        <BudgetStat
          label="Budget left"
          value={formatValue(Math.max(0, budgetRemaining))}
          accent={overBudget ? "text-red-400" : "text-accent-green"}
        />
        <BudgetStat label="Squad value" value={formatValue(totalValue)} />
        <BudgetStat
          label="Avg rating"
          value={averageRating > 0 ? String(averageRating) : "—"}
        />
        <BudgetStat
          label="Filled"
          value={`${squad.filter((s) => s.player).length}/${FANTASY_SQUAD_SIZE}`}
        />
      </div>
    );
  }

  return (
    <div className={`${RL_INFO_BOX_CLASS} p-3 sm:p-4`}>
      <p className={TYPO.sectionLabel}>Budget & Squad</p>
      <div className="mt-2 grid gap-2 sm:mt-3 sm:grid-cols-2 sm:gap-3 lg:grid-cols-5">
        <BudgetStat label="Total budget" value={formatValue(FANTASY_BUDGET)} />
        <BudgetStat
          label="Budget remaining"
          value={formatValue(Math.max(0, budgetRemaining))}
          accent={overBudget ? "text-red-400" : "text-accent-green"}
        />
        <BudgetStat label="Squad value used" value={formatValue(totalValue)} />
        {selectedCost !== null && (
          <BudgetStat
            label="Selected player cost"
            value={formatValue(selectedCost)}
            accent="text-accent-gold"
          />
        )}
        {slotBudget !== null && selectedSlot && (
          <BudgetStat
            label="Slot budget"
            value={formatValue(slotBudget)}
            accent="text-accent-green"
          />
        )}
        <BudgetStat
          label="Average rating"
          value={averageRating > 0 ? `${averageRating} OVR` : "—"}
        />
      </div>
      {overBudget && (
        <p className="mt-2 text-sm font-medium text-red-400 sm:mt-3">
          Squad exceeds budget — remove a player or pick a cheaper option.
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
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-pitch-700/50 bg-pitch-950/50 px-2.5 py-2 sm:px-3 sm:py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-gray-500 sm:text-xs">
        {label}
      </p>
      <p
        className={`mt-0.5 font-display text-base font-bold sm:mt-1 sm:text-lg ${accent}`}
      >
        {value}
      </p>
    </div>
  );
}
