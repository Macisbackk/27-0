"use client";

import { motion } from "framer-motion";
import { formatValue } from "@/lib/players";
import type { TeamComparisonSummary } from "@/lib/team-value-comparison";

interface TeamComparisonBoxProps {
  summary: TeamComparisonSummary;
  userTeamName?: string;
  delay?: number;
}

export function TeamComparisonBox({
  summary,
  userTeamName = "Dream Team",
  delay = 0,
}: TeamComparisonBoxProps) {
  const rows = [
    {
      label: "My Team Rating",
      value: summary.myTeamRating.toFixed(1),
    },
    {
      label: "Best Team Rating This Season",
      value: `${summary.bestRatedTeam.name} — ${summary.bestRatedTeam.rating.toFixed(1)}`,
    },
    {
      label: "Most Expensive Team",
      value: `${summary.mostExpensiveTeam.name} — ${formatValue(summary.mostExpensiveTeam.value)}`,
    },
    {
      label: "Total Team Value",
      value: formatValue(summary.myTeamValue),
      highlight: summary.myTeamValue >= summary.mostExpensiveTeam.value,
    },
  ];

  return (
    <motion.div
      className="mx-auto max-w-md rounded-xl border border-pitch-600/50 bg-pitch-900/60 px-4 py-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <p className="font-display text-[10px] font-bold uppercase tracking-[0.25em] text-accent-green">
        Team Comparison
      </p>
      <p className="mt-1 text-xs text-gray-500">{userTeamName} vs opposition</p>
      <dl className="mt-3 space-y-2.5">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex flex-col gap-0.5 border-b border-pitch-700/40 pb-2 last:border-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between"
          >
            <dt className="font-display text-[10px] font-bold uppercase tracking-wider text-gray-500">
              {row.label}
            </dt>
            <dd
              className={`text-sm font-semibold ${
                row.highlight ? "text-accent-green" : "text-white"
              }`}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </motion.div>
  );
}
