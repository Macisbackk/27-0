"use client";

import { useMemo, useState, type ReactNode } from "react";
import { getShowcasePlayers, formatValue } from "@/lib/players";
import type { PlayerCategory, Position } from "@/lib/types";
import { POSITION_LABELS } from "@/lib/positions";
import {
  computeShowcaseDbStats,
  filterShowcasePlayers,
  getUniqueClubs,
  sortShowcasePlayers,
  TIER_FILTER_LABELS,
  type RatingFilter,
  type ShowcaseFilters,
  type ShowcaseSortDir,
  type ShowcaseSortKey,
  type TierFilter,
} from "@/lib/players/showcase";
import { RugbyLeaguePlayerCard } from "./cards/RugbyLeaguePlayerCard";
import {
  RL_FILTER_CHIP_ACTIVE,
  RL_FILTER_CHIP_IDLE,
  RL_FILTER_INPUT_CLASS,
  RL_INFO_BOX_CLASS,
  RL_SECTION_TITLE_CLASS,
} from "./cards/rl-card";
import { TYPO } from "@/lib/ui/typography";

const ALL_PLAYERS = getShowcasePlayers();
const POSITIONS = Object.keys(POSITION_LABELS) as Position[];

const DEFAULT_FILTERS: ShowcaseFilters = {
  search: "",
  status: "all",
  position: "all",
  club: "all",
  ratingMin: "all",
  tier: "all",
  yearsActive: "",
};

const TIER_OPTIONS = Object.entries(TIER_FILTER_LABELS) as [
  Exclude<TierFilter, "all">,
  string,
][];

export function PlayerShowcase() {
  const [filters, setFilters] = useState<ShowcaseFilters>(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState<ShowcaseSortKey>("rating");
  const [sortDir, setSortDir] = useState<ShowcaseSortDir>("desc");

  const clubs = useMemo(() => getUniqueClubs(ALL_PLAYERS), []);
  const dbStats = useMemo(() => computeShowcaseDbStats(ALL_PLAYERS), []);

  const filtered = useMemo(() => {
    const result = filterShowcasePlayers(ALL_PLAYERS, filters);
    return sortShowcasePlayers(result, sortKey, sortDir);
  }, [filters, sortKey, sortDir]);

  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];

    if (filters.search.trim()) {
      chips.push({
        key: "search",
        label: `Search: "${filters.search.trim()}"`,
        clear: () => setFilters((f) => ({ ...f, search: "" })),
      });
    }
    if (filters.status !== "all") {
      chips.push({
        key: "status",
        label: `Type: ${filters.status}`,
        clear: () => setFilters((f) => ({ ...f, status: "all" })),
      });
    }
    if (filters.position !== "all") {
      chips.push({
        key: "position",
        label: `Position: ${POSITION_LABELS[filters.position]}`,
        clear: () => setFilters((f) => ({ ...f, position: "all" })),
      });
    }
    if (filters.club !== "all") {
      chips.push({
        key: "club",
        label: `Team: ${filters.club}`,
        clear: () => setFilters((f) => ({ ...f, club: "all" })),
      });
    }
    if (filters.ratingMin !== "all") {
      chips.push({
        key: "rating",
        label: `Rating: ${filters.ratingMin}+`,
        clear: () => setFilters((f) => ({ ...f, ratingMin: "all" })),
      });
    }
    if (filters.tier !== "all") {
      chips.push({
        key: "tier",
        label: `Tier: ${TIER_FILTER_LABELS[filters.tier]}`,
        clear: () => setFilters((f) => ({ ...f, tier: "all" })),
      });
    }
    if (filters.yearsActive.trim()) {
      chips.push({
        key: "years",
        label: `Years: ${filters.yearsActive.trim()}`,
        clear: () => setFilters((f) => ({ ...f, yearsActive: "" })),
      });
    }
    if (sortKey === "name") {
      chips.push({
        key: "alpha",
        label: `A–Z: ${sortDir === "asc" ? "A→Z" : "Z→A"}`,
        clear: () => {
          setSortKey("rating");
          setSortDir("desc");
        },
      });
    }

    return chips;
  }, [filters, sortKey, sortDir]);

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSortKey("rating");
    setSortDir("desc");
  };

  const setAlphaSort = (dir: "asc" | "desc") => {
    setSortKey("name");
    setSortDir(dir);
  };

  return (
    <div className="space-y-8">
      <header className="text-center">
        <p className={RL_SECTION_TITLE_CLASS}>Player Database</p>
        <h1 className={`mt-2 ${TYPO.pageTitle}`}>Player Showcase</h1>
        <p className={`mt-2 ${TYPO.body}`}>
          Browse every player in the 27-0 database
        </p>
      </header>

      <section className="matchday-panel p-4 sm:p-6">
        <h2 className="mb-4 text-center font-display text-xs font-bold uppercase tracking-wider text-gray-500">
          Database Overview
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatChip label="Total Players" value={String(dbStats.total)} />
          <StatChip label="Current Players" value={String(dbStats.current)} />
          <StatChip label="Historic Players" value={String(dbStats.historic)} />
          <StatChip label="Legends" value={String(dbStats.legends)} highlight />
          <StatChip
            label="Highest Rated Player"
            value={
              dbStats.highestRated
                ? `${dbStats.highestRated.name} (${dbStats.highestRated.peakRating})`
                : "—"
            }
            highlight
          />
          <StatChip
            label="Highest Transfer Value"
            value={
              dbStats.highestValue
                ? `${dbStats.highestValue.name} (${formatValue(dbStats.highestValue.value)})`
                : "—"
            }
            highlight
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="matchday-panel flex max-h-[calc(100vh-6rem)] flex-col lg:sticky lg:top-20">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-pitch-600/30 px-4 py-3 sm:px-5">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-accent-green">
              Filters
            </h2>
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-medium text-gray-500 transition hover:text-white"
            >
              Reset
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
          <FilterField label="Search">
            <input
              type="search"
              value={filters.search}
              onChange={(e) =>
                setFilters((f) => ({ ...f, search: e.target.value }))
              }
              placeholder="Name, club, position…"
              className={RL_FILTER_INPUT_CLASS}
            />
          </FilterField>

          <FilterField label="Team">
            <select
              value={filters.club}
              onChange={(e) =>
                setFilters((f) => ({ ...f, club: e.target.value }))
              }
              className={RL_FILTER_INPUT_CLASS}
            >
              <option value="all">All Teams</option>
              {clubs.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Position">
            <select
              value={filters.position}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  position: e.target.value as Position | "all",
                }))
              }
              className={RL_FILTER_INPUT_CLASS}
            >
              <option value="all">All Positions</option>
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {POSITION_LABELS[p]}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Player Type">
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  status: e.target.value as PlayerCategory | "all",
                }))
              }
              className={RL_FILTER_INPUT_CLASS}
            >
              <option value="all">All Types</option>
              <option value="current">Current</option>
              <option value="historic">Historic</option>
              <option value="legend">Legend</option>
            </select>
          </FilterField>

          <FilterField label="Alphabetical">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAlphaSort("asc")}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  sortKey === "name" && sortDir === "asc"
                    ? RL_FILTER_CHIP_ACTIVE
                    : RL_FILTER_CHIP_IDLE
                }`}
              >
                A → Z
              </button>
              <button
                type="button"
                onClick={() => setAlphaSort("desc")}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  sortKey === "name" && sortDir === "desc"
                    ? RL_FILTER_CHIP_ACTIVE
                    : RL_FILTER_CHIP_IDLE
                }`}
              >
                Z → A
              </button>
            </div>
          </FilterField>

          <FilterField label="Rating">
            <select
              value={filters.ratingMin}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  ratingMin: e.target.value as RatingFilter,
                }))
              }
              className={RL_FILTER_INPUT_CLASS}
            >
              <option value="all">Any Rating</option>
              <option value="70">70+</option>
              <option value="80">80+</option>
              <option value="90">90+</option>
              <option value="95">95+</option>
            </select>
          </FilterField>

          <FilterField label="Tier">
            <div className="flex flex-wrap gap-1.5">
              <TierChip
                active={filters.tier === "all"}
                onClick={() => setFilters((f) => ({ ...f, tier: "all" }))}
              >
                All
              </TierChip>
              {TIER_OPTIONS.map(([key, label]) => (
                <TierChip
                  key={key}
                  active={filters.tier === key}
                  onClick={() => setFilters((f) => ({ ...f, tier: key }))}
                >
                  {label}
                </TierChip>
              ))}
            </div>
          </FilterField>

          <FilterField label="Years Active">
            <input
              type="text"
              value={filters.yearsActive}
              onChange={(e) =>
                setFilters((f) => ({ ...f, yearsActive: e.target.value }))
              }
              placeholder="e.g. 2010, Present"
              className={RL_FILTER_INPUT_CLASS}
            />
          </FilterField>

          <FilterField label="Sort By">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["rating", "Rating"],
                  ["value", "Value"],
                  ["tries", "Tries"],
                  ["appearances", "Apps"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSortKey(key);
                    setSortDir("desc");
                  }}
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
                    sortKey === key ? RL_FILTER_CHIP_ACTIVE : RL_FILTER_CHIP_IDLE
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </FilterField>
          </div>
        </aside>

        <div className="space-y-4">
          <div className="matchday-panel flex flex-wrap items-center gap-2 px-4 py-3">
            <span className="text-sm font-medium text-white">
              {filtered.length} player{filtered.length !== 1 ? "s" : ""}
            </span>
            {activeFilters.length > 0 && (
              <>
                <span className="text-gray-600">·</span>
                {activeFilters.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={chip.clear}
                    className="inline-flex items-center gap-1 rounded-full border border-accent-green/30 bg-accent-green/10 px-2.5 py-0.5 text-[11px] font-medium text-accent-green transition hover:bg-accent-green/20"
                  >
                    {chip.label}
                    <span aria-hidden>×</span>
                  </button>
                ))}
              </>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="card-glass p-12 text-center text-gray-500">
              No players match your filters. Try adjusting or reset.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
              {filtered.map((player) => (
                <RugbyLeaguePlayerCard
                  key={player.id}
                  player={player}
                  variant="default"
                  equalHeight
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatChip({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`${RL_INFO_BOX_CLASS} px-3 py-2.5`}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <p
        className={`mt-0.5 truncate text-sm font-semibold ${
          highlight ? "text-accent-gold" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-gray-500">
        {label}
      </p>
      {children}
    </div>
  );
}

function TierChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-md border px-2.5 py-1 text-[10px] font-medium transition ${
        active ? RL_FILTER_CHIP_ACTIVE : RL_FILTER_CHIP_IDLE
      }`}
    >
      {children}
    </button>
  );
}
