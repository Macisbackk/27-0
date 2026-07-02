"use client";

import { useMemo, useState } from "react";
import { CARD, FILTER, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import { POSITION_SHORT } from "@/lib/positions";
import {
  getReserveSeasonGrowthDelta,
  sortReservesBySeasonGrowth,
} from "@/lib/manager/managerReserves";
import { ManagerDeltaBadge } from "@/components/manager/manager-ui";

type GrowthFilter = "all" | "improved";

interface ManagerReserveGrowthPanelProps {
  career: ManagerCareer;
}

export function ManagerReserveGrowthPanel({
  career,
}: ManagerReserveGrowthPanelProps) {
  const [filter, setFilter] = useState<GrowthFilter>("all");

  const rows = useMemo(() => {
    const sorted = sortReservesBySeasonGrowth(career.reserves);
    if (filter === "improved") {
      return sorted.filter((r) => getReserveSeasonGrowthDelta(r) > 0);
    }
    return sorted;
  }, [career.reserves, filter]);

  const improvedCount = useMemo(
    () =>
      career.reserves.filter((r) => getReserveSeasonGrowthDelta(r) > 0).length,
    [career.reserves]
  );

  const totalGrowth = useMemo(
    () =>
      career.reserves.reduce(
        (sum, r) => sum + Math.max(0, getReserveSeasonGrowthDelta(r)),
        0
      ),
    [career.reserves]
  );

  return (
    <aside
      className={`${CARD.base} ${SPACING.cardPadding} lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto`}
    >
      <p className={TYPO.sectionLabel}>Season Growth</p>
      <p className={`mt-0.5 ${TYPO.bodySm} text-pitch-400`}>
        {career.seasonYear} · {improvedCount} improved · +{totalGrowth} total
      </p>

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
          {rows.map((r) => {
            const delta = getReserveSeasonGrowthDelta(r);
            const base = r.baseRating ?? r.rating;
            return (
              <li
                key={r.id}
                className={`${CARD.inset} ${SPACING.cardPaddingSm} ${
                  delta > 0 ? "border-theme-primary/25" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {r.name}
                    </p>
                    <p className="text-[10px] text-pitch-500">
                      {POSITION_SHORT[r.position]}
                    </p>
                  </div>
                  {delta !== 0 ? (
                    <ManagerDeltaBadge delta={delta} />
                  ) : (
                    <span className="shrink-0 text-[10px] text-pitch-500">
                      —
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-pitch-400">
                  <span className="text-pitch-500">{base}</span>
                  {" → "}
                  <span
                    className={
                      delta > 0
                        ? "font-semibold text-theme-primary"
                        : "text-white"
                    }
                  >
                    {r.rating}
                  </span>
                  <span className="text-pitch-500"> · POT {r.potentialRating}</span>
                </p>
                {r.reserveAppearances > 0 && (
                  <p className="mt-0.5 text-[10px] text-pitch-500">
                    {r.reserveAppearances} reserve app
                    {r.reserveAppearances === 1 ? "" : "s"}
                    {r.reserveTries > 0 && ` · ${r.reserveTries} tries`}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
