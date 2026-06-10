"use client";

import { motion } from "framer-motion";
import { formatValue } from "@/lib/players";
import type { TeamComparisonSummary } from "@/lib/team-value-comparison";
import { ClubNameLabel } from "./ClubNameLabel";

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
      <dl className="mt-3 space-y-3">
        <ComparisonRow
          label="My Team Rating"
          value={summary.myTeamRating.toFixed(1)}
        />
        <ComparisonRow
          label="Best Team Rating This Season"
          teamName={summary.bestRatedTeam.name}
          value={summary.bestRatedTeam.rating.toFixed(1)}
        />
        <ComparisonRow
          label="Most Expensive Team"
          teamName={summary.mostExpensiveTeam.name}
          value={formatValue(summary.mostExpensiveTeam.value)}
        />
        <ComparisonRow
          label="Total Team Value"
          value={formatValue(summary.myTeamValue)}
          highlight={summary.myTeamValue >= summary.mostExpensiveTeam.value}
        />
      </dl>
    </motion.div>
  );
}

function ComparisonRow({
  label,
  teamName,
  value,
  highlight,
}: {
  label: string;
  teamName?: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="border-b border-pitch-700/40 pb-3 last:border-0 last:pb-0">
      <dt className="font-display text-[10px] font-bold uppercase tracking-wider text-gray-500">
        {label}
      </dt>
      <dd className="mt-1.5 space-y-1.5">
        {teamName && (
          <ClubNameLabel club={teamName} variant="inline" className="max-w-full" />
        )}
        <p
          className={`font-display text-sm font-bold ${
            highlight ? "text-accent-green" : "text-white"
          }`}
        >
          {value}
        </p>
      </dd>
    </div>
  );
}
