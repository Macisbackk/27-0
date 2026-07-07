"use client";

import { useMemo, useState } from "react";
import { CARD, FILTER, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer, ManagerReservePlayer } from "@/lib/manager/types";
import { POSITION_SHORT } from "@/lib/positions";
import {
  getReserveSeasonGrowthDelta,
  sortReservesBySeasonGrowth,
} from "@/lib/manager/managerReserves";
import { ManagerDeltaBadge } from "@/components/manager/manager-ui";
import { playUiClick } from "@/lib/sound";

type GrowthFilter = "all" | "improved";

const MOBILE_RECENT_LIMIT = 5;

interface ManagerReserveGrowthPanelProps {
  career: ManagerCareer;
  /** Mobile compact tab vs desktop sidebar panel. */
  variant?: "mobile" | "desktop";
}

function GrowthSummary({
  seasonYear,
  improvedCount,
  totalGrowth,
}: {
  seasonYear: number;
  improvedCount: number;
  totalGrowth: number;
}) {
  return (
    <p className={`${TYPO.bodySm} text-pitch-400`}>
      {seasonYear} · {improvedCount} improved · +{totalGrowth} total
    </p>
  );
}

function GrowthRow({
  reserve,
  compact = false,
}: {
  reserve: ManagerReservePlayer;
  compact?: boolean;
}) {
  const delta = getReserveSeasonGrowthDelta(reserve);
  const base = reserve.baseRating ?? reserve.rating;

  if (compact) {
    return (
      <li
        className={`flex items-center justify-between gap-2 rounded-lg border border-pitch-700/50 bg-pitch-950/40 px-2.5 py-2 ${
          delta > 0 ? "border-theme-primary/20" : ""
        }`}
      >
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-white">{reserve.name}</p>
          <p className="text-[10px] text-pitch-500">
            {POSITION_SHORT[reserve.position]} · {base} → {reserve.rating}
          </p>
        </div>
        {delta !== 0 ? (
          <ManagerDeltaBadge delta={delta} />
        ) : (
          <span className="shrink-0 text-[10px] text-pitch-500">—</span>
        )}
      </li>
    );
  }

  return (
    <li
      className={`${CARD.inset} ${SPACING.cardPaddingSm} ${
        delta > 0 ? "border-theme-primary/25" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{reserve.name}</p>
          <p className="text-[10px] text-pitch-500">
            {POSITION_SHORT[reserve.position]}
          </p>
        </div>
        {delta !== 0 ? (
          <ManagerDeltaBadge delta={delta} />
        ) : (
          <span className="shrink-0 text-[10px] text-pitch-500">—</span>
        )}
      </div>
      <p className="mt-1 text-[11px] text-pitch-400">
        <span className="text-pitch-500">{base}</span>
        {" → "}
        <span
          className={
            delta > 0 ? "font-semibold text-theme-primary" : "text-white"
          }
        >
          {reserve.rating}
        </span>
        <span className="text-pitch-500"> · POT {reserve.potentialRating}</span>
      </p>
      {reserve.reserveAppearances > 0 && (
        <p className="mt-0.5 text-[10px] text-pitch-500">
          {reserve.reserveAppearances} reserve app
          {reserve.reserveAppearances === 1 ? "" : "s"}
          {reserve.reserveTries > 0 && ` · ${reserve.reserveTries} tries`}
        </p>
      )}
    </li>
  );
}

function useGrowthData(reserves: ManagerReservePlayer[]) {
  const improvedCount = useMemo(
    () => reserves.filter((r) => getReserveSeasonGrowthDelta(r) > 0).length,
    [reserves]
  );

  const totalGrowth = useMemo(
    () =>
      reserves.reduce(
        (sum, r) => sum + Math.max(0, getReserveSeasonGrowthDelta(r)),
        0
      ),
    [reserves]
  );

  const recentChanges = useMemo(
    () =>
      sortReservesBySeasonGrowth(reserves)
        .filter((r) => getReserveSeasonGrowthDelta(r) > 0)
        .slice(0, MOBILE_RECENT_LIMIT),
    [reserves]
  );

  return { improvedCount, totalGrowth, recentChanges };
}

function MobileGrowthTab({
  career,
  improvedCount,
  totalGrowth,
  recentChanges,
}: {
  career: ManagerCareer;
  improvedCount: number;
  totalGrowth: number;
  recentChanges: ManagerReservePlayer[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`${CARD.base} ${SPACING.cardPaddingSm}`}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={open}
        onClick={() => {
          playUiClick();
          setOpen((value) => !value);
        }}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className={TYPO.sectionLabel}>Season Growth</p>
            {totalGrowth > 0 && (
              <span className="rounded-full border border-theme-primary/35 bg-theme-primary/10 px-1.5 py-px text-[10px] font-bold text-theme-primary">
                +{totalGrowth}
              </span>
            )}
          </div>
          <GrowthSummary
            seasonYear={career.seasonYear}
            improvedCount={improvedCount}
            totalGrowth={totalGrowth}
          />
        </div>
        <span
          className={`shrink-0 text-sm text-theme-primary transition ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        >
          ▼
        </span>
      </button>

      {open && (
        <div className="mt-3 border-t border-pitch-700/50 pt-3">
          {recentChanges.length === 0 ? (
            <p className={`${TYPO.bodySm} text-pitch-500`}>
              No rating gains yet this season.
            </p>
          ) : (
            <>
              <p className={`${TYPO.sectionLabel} text-pitch-400`}>
                Recent changes
              </p>
              <ul className={`mt-2 ${SPACING.stackSm}`}>
                {recentChanges.map((reserve) => (
                  <GrowthRow key={reserve.id} reserve={reserve} compact />
                ))}
              </ul>
              {improvedCount > recentChanges.length && (
                <p className={`mt-2 ${TYPO.bodySm} text-pitch-500`}>
                  +{improvedCount - recentChanges.length} more on desktop view.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function DesktopGrowthPanel({
  career,
  improvedCount,
  totalGrowth,
}: {
  career: ManagerCareer;
  improvedCount: number;
  totalGrowth: number;
}) {
  const [filter, setFilter] = useState<GrowthFilter>("all");

  const rows = useMemo(() => {
    const sorted = sortReservesBySeasonGrowth(career.reserves);
    if (filter === "improved") {
      return sorted.filter((r) => getReserveSeasonGrowthDelta(r) > 0);
    }
    return sorted;
  }, [career.reserves, filter]);

  return (
    <aside
      className={`${CARD.base} ${SPACING.cardPadding} lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto`}
    >
      <p className={TYPO.sectionLabel}>Season Growth</p>
      <GrowthSummary
        seasonYear={career.seasonYear}
        improvedCount={improvedCount}
        totalGrowth={totalGrowth}
      />

      <div className="mt-3 flex gap-1">
        {(
          [
            ["all", "All"],
            ["improved", "Improved"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-lg border px-2 py-1 text-[10px] ${
              filter === id ? FILTER.chipActive : "border-pitch-600 text-pitch-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className={`mt-3 ${TYPO.bodySm} text-pitch-500`}>
          No rating gains yet this season.
        </p>
      ) : (
        <ul className={`mt-3 ${SPACING.stackSm}`}>
          {rows.map((reserve) => (
            <GrowthRow key={reserve.id} reserve={reserve} />
          ))}
        </ul>
      )}
    </aside>
  );
}

export function ManagerReserveGrowthPanel({
  career,
  variant = "desktop",
}: ManagerReserveGrowthPanelProps) {
  const { improvedCount, totalGrowth, recentChanges } = useGrowthData(
    career.reserves
  );

  if (variant === "mobile") {
    return (
      <MobileGrowthTab
        career={career}
        improvedCount={improvedCount}
        totalGrowth={totalGrowth}
        recentChanges={recentChanges}
      />
    );
  }

  return (
    <DesktopGrowthPanel
      career={career}
      improvedCount={improvedCount}
      totalGrowth={totalGrowth}
    />
  );
}
