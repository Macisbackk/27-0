"use client";

import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { formatValue } from "@/lib/players";
import type {
  ExtendedTeamComparison,
  TeamValueEntry,
} from "@/lib/team-value-comparison";
import {
  compareHigher,
  compareLower,
  parseWinPct,
  type CompareEdge,
} from "@/lib/validation/compare-edge";
import { CARD } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { ClubNameLabel } from "./ClubNameLabel";
import {
  MobileComparisonStatRow,
  TeamComparisonStatRow,
} from "./ui/TeamComparisonStatRow";

interface TeamComparisonBoxProps {
  comparison: ExtendedTeamComparison;
  delay?: number;
}

export const TeamComparisonBox = memo(function TeamComparisonBox({
  comparison,
  delay = 0,
}: TeamComparisonBoxProps) {
  const { user, opponent, ratingEdge, mostExpensiveOpposition, useTriesConceded } =
    comparison;
  const defensiveLabel = useTriesConceded ? "Tries Conceded" : "Win %";
  const userDefensiveValue = useTriesConceded
    ? String(user.triesConceded)
    : user.winPct;
  const opponentDefensiveValue = useTriesConceded
    ? String(opponent.triesConceded)
    : opponent.winPct;
  const maxRating = Math.max(user.rating, opponent.rating, 1);

  const userBarPct = useMemo(
    () => Math.round((user.rating / maxRating) * 100),
    [user.rating, maxRating]
  );
  const oppBarPct = useMemo(
    () => Math.round((opponent.rating / maxRating) * 100),
    [opponent.rating, maxRating]
  );

  const valueEdge = compareHigher(user.value, opponent.value);
  const userWinPct = parseWinPct(user.winPct);
  const oppWinPct = parseWinPct(opponent.winPct);
  const defensiveEdge: CompareEdge = useTriesConceded
    ? compareLower(user.triesConceded, opponent.triesConceded)
    : userWinPct === null || oppWinPct === null
      ? "tie"
      : compareHigher(userWinPct, oppWinPct);
  const triesEdge = compareHigher(user.totalTries, opponent.totalTries);
  const topPlayerEdge = compareHigher(
    user.topPlayer.rating,
    opponent.topPlayer.rating
  );

  const statRows = [
    {
      label: "Team Value",
      userValue: formatValue(user.value),
      opponentValue: formatValue(opponent.value),
      edge: valueEdge,
    },
    {
      label: defensiveLabel,
      userValue: userDefensiveValue,
      opponentValue: opponentDefensiveValue,
      edge: defensiveEdge,
    },
    {
      label: "Total Tries",
      userValue: String(user.totalTries),
      opponentValue: String(opponent.totalTries),
      edge: triesEdge,
    },
    {
      label: "Top Player",
      userValue: user.topPlayer.name,
      opponentValue: opponent.topPlayer.name,
      edge: topPlayerEdge,
    },
  ];

  return (
    <motion.div
      className={`overflow-hidden ${CARD.elevated}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <div className="px-4 py-6 sm:px-6 sm:py-8">
        <div className="sm:hidden">
          <div className="grid grid-cols-2 gap-3">
            <TeamBadge
              heading="Your Team"
              badge="🟢 Your Team"
              badgeClass="border-accent-green/40 bg-accent-green/10 text-accent-green"
              club={user.name}
            />
            <TeamBadge
              heading="Opponent"
              badge="🔴 Opponent"
              badgeClass="border-accent-red/40 bg-accent-red/10 text-accent-red"
              club={opponent.name}
              align="right"
            />
          </div>
        </div>

        <RatingShowcase
          userRating={user.rating}
          opponentRating={opponent.rating}
          ratingEdge={ratingEdge}
          userBarPct={userBarPct}
          oppBarPct={oppBarPct}
          className="mt-6 sm:mt-0"
        />

        <div className="hidden sm:mt-8 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-stretch sm:gap-4">
          <TeamSidePanel
            label="Your Team"
            badge="🟢 Your Team"
            badgeClass="border-accent-green/40 bg-accent-green/10 text-accent-green"
            side={user}
            align="left"
            sideKey="left"
            valueEdge={valueEdge}
            defensiveEdge={defensiveEdge}
            defensiveLabel={defensiveLabel}
            userDefensiveValue={userDefensiveValue}
            opponentDefensiveValue={opponentDefensiveValue}
            triesEdge={triesEdge}
            topPlayerEdge={topPlayerEdge}
            topPlayerLabel="Top Player"
          />

          <div className="flex items-center justify-center self-center px-2">
            <span className="font-display text-3xl font-black uppercase tracking-widest text-gray-500">
              VS
            </span>
          </div>

          <TeamSidePanel
            label="Opponent"
            badge="🔴 Opponent"
            badgeClass="border-accent-red/40 bg-accent-red/10 text-accent-red"
            side={opponent}
            align="right"
            sideKey="right"
            valueEdge={valueEdge}
            defensiveEdge={defensiveEdge}
            defensiveLabel={defensiveLabel}
            userDefensiveValue={userDefensiveValue}
            opponentDefensiveValue={opponentDefensiveValue}
            triesEdge={triesEdge}
            topPlayerEdge={topPlayerEdge}
            topPlayerLabel="Top Player"
            mostExpensiveOpponent={mostExpensiveOpposition}
          />
        </div>

        <div className="sm:hidden">
          <MobileVsDivider className="mt-6" />

          <div className="mt-4 space-y-2.5">
            {statRows.map((row) => (
              <MobileComparisonStatRow
                key={row.label}
                label={row.label}
                userValue={row.userValue}
                opponentValue={row.opponentValue}
                edge={row.edge}
              />
            ))}
          </div>

          {mostExpensiveOpposition && (
            <div className={`${CARD.inset} mt-4 px-3 py-2.5 text-center`}>
              <p className={TYPO.statLabel}>Most Expensive Opposition</p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                {mostExpensiveOpposition.name === "N/A" ? (
                  <span className={TYPO.body}>N/A</span>
                ) : (
                  <>
                    <ClubNameLabel
                      club={mostExpensiveOpposition.name}
                      variant="pill"
                      className="max-w-full truncate"
                    />
                    <span className="font-display text-sm font-black text-accent-gold">
                      {formatValue(mostExpensiveOpposition.value)}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});

const TeamBadge = memo(function TeamBadge({
  heading,
  badge,
  badgeClass,
  club,
  align = "left",
}: {
  heading: string;
  badge: string;
  badgeClass: string;
  club: string;
  align?: "left" | "right";
}) {
  const isRight = align === "right";

  return (
    <div className={`${CARD.inset} p-3 ${isRight ? "text-right" : "text-left"}`}>
      <p className={TYPO.statLabel}>{heading}</p>
      <span
        className={`mt-1.5 inline-flex items-center rounded-full border px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider ${badgeClass}`}
      >
        {badge}
      </span>
      <div className={`mt-2 ${isRight ? "flex justify-end" : "flex justify-start"}`}>
        <ClubNameLabel club={club} variant="pill" className="max-w-full truncate" />
      </div>
    </div>
  );
});

const MobileVsDivider = memo(function MobileVsDivider({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div className={`text-center ${className}`}>
      <p className={TYPO.statLabel}>Your Team</p>
      <div className="mt-2 flex items-center gap-3">
        <div className="h-px flex-1 bg-pitch-700/80" aria-hidden />
        <span className="shrink-0 font-display text-sm font-black uppercase tracking-widest text-gray-500">
          VS
        </span>
        <div className="h-px flex-1 bg-pitch-700/80" aria-hidden />
      </div>
      <p className={`mt-2 ${TYPO.statLabel}`}>Opponent</p>
    </div>
  );
});

const RatingShowcase = memo(function RatingShowcase({
  userRating,
  opponentRating,
  ratingEdge,
  userBarPct,
  oppBarPct,
  className = "",
}: {
  userRating: number;
  opponentRating: number;
  ratingEdge: ExtendedTeamComparison["ratingEdge"];
  userBarPct: number;
  oppBarPct: number;
  className?: string;
}) {
  return (
    <div className={`text-center ${className}`}>
      <p className={TYPO.statLabel}>Team Rating</p>
      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-6">
        <RatingBadge
          rating={userRating}
          edge={ratingEdge === "user"}
          variant="user"
        />
        <span className="hidden font-display text-xl font-black text-gray-600 sm:inline sm:text-2xl">
          VS
        </span>
        <RatingBadge
          rating={opponentRating}
          edge={ratingEdge === "opponent"}
          variant="opponent"
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
                  ? "bg-accent-red shadow-[0_0_12px_rgba(239,68,68,0.5)]"
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
  variant,
}: {
  rating: number;
  edge: boolean;
  variant: "user" | "opponent";
}) {
  const userEdgeStyles =
    "border-accent-green/50 bg-accent-green/10 shadow-[0_0_24px_rgba(34,197,94,0.15)]";
  const oppEdgeStyles =
    "border-accent-red/50 bg-accent-red/10 shadow-[0_0_24px_rgba(239,68,68,0.15)]";
  const userGlow = [
    "0 0 16px rgba(34,197,94,0.1)",
    "0 0 28px rgba(34,197,94,0.2)",
    "0 0 16px rgba(34,197,94,0.1)",
  ];
  const oppGlow = [
    "0 0 16px rgba(239,68,68,0.1)",
    "0 0 28px rgba(239,68,68,0.2)",
    "0 0 16px rgba(239,68,68,0.1)",
  ];

  const edgeStyles = variant === "user" ? userEdgeStyles : oppEdgeStyles;
  const glow = variant === "user" ? userGlow : oppGlow;
  const textColor =
    edge && variant === "user"
      ? "text-accent-green"
      : edge && variant === "opponent"
        ? "text-accent-red"
        : "text-white";

  return (
    <motion.div
      className={`flex min-h-[5.5rem] min-w-[5.5rem] flex-col items-center justify-center rounded-xl border px-4 py-3 text-center sm:min-h-[6rem] sm:min-w-[6.5rem] ${
        edge ? edgeStyles : "border-pitch-600/50 bg-pitch-900/60"
      }`}
      animate={edge ? { boxShadow: glow } : undefined}
      transition={{ duration: 2.5, repeat: edge ? Infinity : 0 }}
    >
      <p className={`font-display text-3xl font-black leading-none sm:text-4xl ${textColor}`}>
        {Math.round(rating)}
      </p>
      <p className={`mt-1 ${TYPO.statLabel}`}>OVR</p>
    </motion.div>
  );
});

const TeamSidePanel = memo(function TeamSidePanel({
  label,
  badge,
  badgeClass,
  side,
  align,
  sideKey,
  valueEdge,
  defensiveEdge,
  defensiveLabel,
  userDefensiveValue,
  opponentDefensiveValue,
  triesEdge,
  topPlayerEdge,
  topPlayerLabel,
  mostExpensiveOpponent,
}: {
  label: string;
  badge: string;
  badgeClass: string;
  side: ExtendedTeamComparison["user"];
  align: "left" | "right";
  sideKey: "left" | "right";
  valueEdge: CompareEdge;
  defensiveEdge: CompareEdge;
  defensiveLabel: string;
  userDefensiveValue: string;
  opponentDefensiveValue: string;
  triesEdge: CompareEdge;
  topPlayerEdge: CompareEdge;
  topPlayerLabel: string;
  mostExpensiveOpponent?: TeamValueEntry | null;
}) {
  const isRight = align === "right";

  return (
    <div className={`${CARD.inset} p-4 ${isRight ? "sm:text-right" : "text-left"}`}>
      <p className={TYPO.statLabel}>{label}</p>
      <span
        className={`mt-1.5 inline-flex items-center rounded-full border px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider ${badgeClass}`}
      >
        {badge}
      </span>
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
        <TeamComparisonStatRow
          label="Team Value"
          value={formatValue(side.value)}
          align={align}
          edge={valueEdge}
          side={sideKey}
        />
        <TeamComparisonStatRow
          label={defensiveLabel}
          value={sideKey === "left" ? userDefensiveValue : opponentDefensiveValue}
          align={align}
          edge={defensiveEdge}
          side={sideKey}
        />
        <TeamComparisonStatRow
          label="Total Tries"
          value={String(side.totalTries)}
          align={align}
          edge={triesEdge}
          side={sideKey}
        />
        <TeamComparisonStatRow
          label={topPlayerLabel}
          value={side.topPlayer.name}
          align={align}
          edge={topPlayerEdge}
          side={sideKey}
          truncate
        />
      </dl>

      {isRight && (
        <div className="mt-4 border-t border-pitch-700/60 pt-3 sm:text-right">
          <p className={TYPO.statLabel}>Most Expensive Opposition</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 sm:justify-end">
            {mostExpensiveOpponent?.name === "N/A" || !mostExpensiveOpponent ? (
              <span className={TYPO.body}>N/A</span>
            ) : (
              <>
                <ClubNameLabel
                  club={mostExpensiveOpponent.name}
                  variant="pill"
                  className="max-w-full truncate"
                />
                <span className="font-display text-sm font-black text-accent-gold">
                  {formatValue(mostExpensiveOpponent.value)}
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
