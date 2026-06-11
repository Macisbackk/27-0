"use client";

import { formatValue } from "@/lib/players";
import {
  FANTASY_BUDGET,
  FANTASY_SEASON_ROUNDS,
  FANTASY_SQUAD_SIZE,
  getFantasySquadSummary,
} from "@/lib/game/fantasy-mode";
import type { SquadSlot } from "@/lib/types";
import { RL_INFO_BOX_CLASS } from "./cards/rl-card";
import { TYPO } from "@/lib/ui/typography";

interface FantasyBudgetPanelProps {
  squad: SquadSlot[];
  compact?: boolean;
}

export function FantasyBudgetPanel({ squad, compact }: FantasyBudgetPanelProps) {
  const { totalValue, budgetRemaining, averageRating } =
    getFantasySquadSummary(squad);
  const overBudget = budgetRemaining < 0;

  if (compact) {
    return (
      <div className={`${RL_INFO_BOX_CLASS} grid grid-cols-2 gap-3 p-3 sm:grid-cols-4`}>
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
    <div className={`${RL_INFO_BOX_CLASS} p-4`}>
      <p className={TYPO.sectionLabel}>Budget & Squad</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <BudgetStat
          label="Starting budget"
          value={formatValue(FANTASY_BUDGET)}
        />
        <BudgetStat
          label="Budget remaining"
          value={formatValue(Math.max(0, budgetRemaining))}
          accent={overBudget ? "text-red-400" : "text-accent-green"}
        />
        <BudgetStat label="Total squad value" value={formatValue(totalValue)} />
        <BudgetStat
          label="Average rating"
          value={averageRating > 0 ? `${averageRating} OVR` : "—"}
        />
      </div>
      {overBudget && (
        <p className="mt-3 text-sm font-medium text-red-400">
          Squad exceeds budget — remove a player or pick a cheaper option.
        </p>
      )}
      <p className="mt-3 text-xs text-gray-500">
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
    <div className="rounded-lg border border-pitch-700/50 bg-pitch-950/50 px-3 py-2.5">
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-1 font-display text-lg font-bold ${accent}`}>{value}</p>
    </div>
  );
}
