"use client";

import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { formatValue } from "@/lib/players";
import type { ExtendedTeamComparison } from "@/lib/team-value-comparison";
import { ClubNameLabel } from "./ClubNameLabel";

interface TeamComparisonBoxProps {
  comparison: ExtendedTeamComparison;
  delay?: number;
}

export const TeamComparisonBox = memo(function TeamComparisonBox({
  comparison,
  delay = 0,
}: TeamComparisonBoxProps) {
  const { user, opponent, ratingEdge, mostExpensiveTeam } = comparison;
  const maxRating = Math.max(user.rating, opponent.rating, 1);

  const userBarPct = useMemo(
    () => Math.round((user.rating / maxRating) * 100),
    [user.rating, maxRating]
  );
  const oppBarPct = useMemo(
    () => Math.round((opponent.rating / maxRating) * 100),
    [opponent.rating, maxRating]
  );

  return (
    <motion.div
      className="overflow-hidden rounded-2xl border border-pitch-600/50 bg-gradient-to-b from-pitch-900/80 to-pitch-950/90"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <div className="border-b border-pitch-700/50 bg-pitch-900/60 px-4 py-3 text-center sm:px-6">
        <p className="font-display text-[10px] font-bold uppercase tracking-[0.3em] text-accent-green">
          Head-to-Head Comparison
        </p>
      </div>

      <div className="px-4 py-6 sm:px-6 sm:py-8">
        <RatingShowcase
          userRating={user.rating}
          opponentRating={opponent.rating}
          ratingEdge={ratingEdge}
          userBarPct={userBarPct}
          oppBarPct={oppBarPct}
        />

        <div className="relative mt-8 grid gap-6 sm:grid-cols-[1fr_auto_1fr] sm:items-start sm:gap-4">
          <TeamSidePanel
            label="Your Team"
            side={user}
            align="left"
            highlight={ratingEdge === "user"}
            topPlayerLabel="Top Player"
          />

          <div className="flex items-center justify-center sm:pt-10">
            <span className="font-display text-2xl font-black uppercase tracking-widest text-gray-500 sm:text-3xl">
              VS
            </span>
          </div>

          <TeamSidePanel
            label="Best Opposition"
            side={opponent}
            align="right"
            highlight={ratingEdge === "opponent"}
            topPlayerLabel="Best Player"
          />
        </div>

        <div className="mt-6 rounded-xl border border-pitch-700/50 bg-pitch-950/50 px-4 py-3 text-left sm:text-center">
          <p className="font-display text-[10px] font-bold uppercase tracking-wider text-accent-gold">
            Most Expensive Team
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-start gap-2 sm:justify-center">
            <ClubNameLabel
              club={mostExpensiveTeam.name}
              variant="pill"
              className="max-w-full truncate"
            />
            <span className="font-display text-base font-black text-accent-gold sm:text-lg">
              {formatValue(mostExpensiveTeam.value)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

const RatingShowcase = memo(function RatingShowcase({
  userRating,
  opponentRating,
  ratingEdge,
  userBarPct,
  oppBarPct,
}: {
  userRating: number;
  opponentRating: number;
  ratingEdge: ExtendedTeamComparison["ratingEdge"];
  userBarPct: number;
  oppBarPct: number;
}) {
  return (
    <div className="text-center">
      <p className="font-display text-[10px] font-bold uppercase tracking-[0.25em] text-gray-500">
        Team Rating
      </p>
      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-6">
        <RatingBadge
          rating={userRating}
          edge={ratingEdge === "user"}
          edgeColor="green"
        />
        <span className="font-display text-xl font-black text-gray-600 sm:text-2xl">
          VS
        </span>
        <RatingBadge
          rating={opponentRating}
          edge={ratingEdge === "opponent"}
          edgeColor="red"
        />
      </div>

      <div className="mx-auto mt-5 flex max-w-md items-center gap-3">
        <div className="flex-1">
          <div className="h-2 overflow-hidden rounded-full bg-pitch-800">
            <motion.div
              className={`h-full rounded-full ${
                ratingEdge === "user"
                  ? "bg-accent-green shadow-[0_0_12px_rgba(34,197,94,0.5)]"
                  : "bg-pitch-600"
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${userBarPct}%` }}
              transition={{ duration: 0.6, delay: 0.15 }}
            />
          </div>
        </div>
        <div className="flex-1">
          <div className="h-2 overflow-hidden rounded-full bg-pitch-800">
            <motion.div
              className={`h-full rounded-full ${
                ratingEdge === "opponent"
                  ? "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.45)]"
                  : "bg-pitch-600"
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${oppBarPct}%` }}
              transition={{ duration: 0.6, delay: 0.15 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

const RatingBadge = memo(function RatingBadge({
  rating,
  edge,
  edgeColor = "green",
}: {
  rating: number;
  edge: boolean;
  edgeColor?: "green" | "red";
}) {
  const edgeStyles =
    edgeColor === "red"
      ? "border-red-500/50 bg-red-600/10 shadow-[0_0_24px_rgba(239,68,68,0.15)]"
      : "border-accent-green/50 bg-accent-green/10 shadow-[0_0_24px_rgba(34,197,94,0.15)]";
  const edgeText = edgeColor === "red" ? "text-red-400" : "text-accent-green";
  const glow =
    edgeColor === "red"
      ? [
          "0 0 16px rgba(239,68,68,0.1)",
          "0 0 28px rgba(239,68,68,0.2)",
          "0 0 16px rgba(239,68,68,0.1)",
        ]
      : [
          "0 0 16px rgba(34,197,94,0.1)",
          "0 0 28px rgba(34,197,94,0.2)",
          "0 0 16px rgba(34,197,94,0.1)",
        ];

  return (
    <motion.div
      className={`flex min-h-[5.5rem] min-w-[5.5rem] flex-col items-center justify-center rounded-xl border px-4 py-3 text-center sm:min-h-[6rem] sm:min-w-[6.5rem] ${
        edge ? edgeStyles : "border-pitch-600/50 bg-pitch-900/60"
      }`}
      animate={edge ? { boxShadow: glow } : undefined}
      transition={{ duration: 2.5, repeat: edge ? Infinity : 0 }}
    >
      <p
        className={`font-display text-3xl font-black leading-none sm:text-4xl ${
          edge ? edgeText : "text-white"
        }`}
      >
        {Math.round(rating)}
      </p>
      <p className="mt-1 font-display text-[10px] font-bold uppercase tracking-wider text-gray-500">
        OVR
      </p>
    </motion.div>
  );
});

const TeamSidePanel = memo(function TeamSidePanel({
  label,
  side,
  align,
  highlight,
  topPlayerLabel,
}: {
  label: string;
  side: ExtendedTeamComparison["user"];
  align: "left" | "right";
  highlight: boolean;
  topPlayerLabel: string;
}) {
  const isRight = align === "right";

  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? "border-accent-green/25 bg-accent-green/[0.04]"
          : "border-pitch-700/50 bg-pitch-950/50"
      } ${isRight ? "sm:text-right" : "text-left"}`}
    >
      <p className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
        {label}
      </p>
      <div
        className={`mt-2 ${isRight ? "sm:flex sm:justify-end" : "flex justify-start"}`}
      >
        <ClubNameLabel
          club={side.name}
          variant="pill"
          className="max-w-full truncate"
        />
      </div>

      <dl className="mt-4 space-y-2.5 text-sm">
        <StatRow
          label="Team Value"
          value={formatValue(side.value)}
          align={align}
        />
        <StatRow
          label="Team Tier"
          value={side.tier}
          align={align}
          highlight={highlight}
        />
        <StatRow label="Win %" value={side.winPct} align={align} />
        <StatRow
          label="Total Tries"
          value={String(side.totalTries)}
          align={align}
        />
        <StatRow
          label={topPlayerLabel}
          value={side.topPlayer.name}
          align={align}
          truncate
        />
      </dl>
    </div>
  );
});

const StatRow = memo(function StatRow({
  label,
  value,
  align,
  highlight,
  truncate,
}: {
  label: string;
  value: string;
  align: "left" | "right";
  highlight?: boolean;
  truncate?: boolean;
}) {
  const isRight = align === "right";

  return (
    <div
      className={`flex flex-col gap-0.5 border-b border-pitch-800/60 pb-2 last:border-0 last:pb-0 sm:gap-2 ${
        isRight
          ? "sm:flex-row-reverse sm:items-baseline sm:justify-between"
          : "sm:flex-row sm:items-baseline sm:justify-between"
      }`}
    >
      <dt className="shrink-0 font-display text-[10px] font-bold uppercase tracking-wider text-gray-500">
        {label}
      </dt>
      <dd
        className={`font-display text-xs font-bold sm:text-sm ${
          highlight ? "text-accent-green" : "text-white"
        } ${truncate ? "truncate" : ""} ${isRight ? "sm:text-right" : "sm:text-left"}`}
      >
        {value}
      </dd>
    </div>
  );
});
