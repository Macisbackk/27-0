"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  getShowcasePlayers,
  formatValue,
} from "@/lib/players";
import type { PlayerCategory, Position } from "@/lib/types";
import { POSITION_LABELS } from "@/lib/positions";
import {
  applyShowcasePipeline,
  computeShowcaseDbStats,
  getUniqueClubs,
  TIER_FILTER_LABELS,
  type RatingFilter,
  type ShowcaseFilters,
  type ShowcaseSortDir,
  type ShowcaseSortKey,
  type TierFilter,
} from "@/lib/players/showcase";
import type { Player } from "@/lib/types";
import { PlayerDetailModal } from "./PlayerDetailModal";
import { ShowcasePlayerCard } from "./ShowcasePlayerCard";
import {
  ShowcasePagination,
  SHOWCASE_PAGE_SIZE,
  getShowcasePageSize,
} from "./ShowcasePagination";
import {
  RL_FILTER_CHIP_ACTIVE,
  RL_FILTER_CHIP_IDLE,
  RL_FILTER_INPUT_CLASS,
  RL_INFO_BOX_CLASS,
  RL_SECTION_TITLE_CLASS,
} from "./cards/rl-card";
import { playUiClick } from "@/lib/sound";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

const ALL_PLAYERS = getShowcasePlayers();
const POSITIONS = Object.keys(POSITION_LABELS) as Position[];

const DEFAULT_FILTERS: ShowcaseFilters = {
  search: "",
  status: "current",
  position: "all",
  club: "all",
  ratingMin: "all",
  tier: "all",
};

const TIER_OPTIONS = Object.entries(TIER_FILTER_LABELS) as [
  Exclude<TierFilter, "all">,
  string,
][];

function formatPlayerTypeLabel(status: PlayerCategory | "all"): string {
  switch (status) {
    case "current":
      return "Current";
    case "historic":
      return "Historic";
    case "legend":
      return "Legend";
    default:
      return "All";
  }
}

export function PlayerShowcase() {
  const searchParams = useSearchParams();
  const deepLinkPlayerId = searchParams.get("player");
  const [filters, setFilters] = useState<ShowcaseFilters>(DEFAULT_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDeferredValue(searchInput);
  const [sortKey, setSortKey] = useState<ShowcaseSortKey>("rating");
  const [sortDir, setSortDir] = useState<ShowcaseSortDir>("desc");
  const [detailPlayer, setDetailPlayer] = useState<Player | null>(null);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const clubs = useMemo(() => getUniqueClubs(ALL_PLAYERS), []);
  const dbStats = useMemo(() => computeShowcaseDbStats(ALL_PLAYERS), []);

  const activeFiltersState = useMemo(
    (): ShowcaseFilters => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch]
  );

  const filtered = useMemo(
    () =>
      applyShowcasePipeline(
        ALL_PLAYERS,
        activeFiltersState,
        sortKey,
        sortDir
      ),
    [activeFiltersState, sortKey, sortDir]
  );

  const filterResultsKey = useMemo(
    () =>
      [
        debouncedSearch,
        filters.status,
        filters.position,
        filters.club,
        filters.ratingMin,
        filters.tier,
        sortKey,
        sortDir,
      ].join("|"),
    [
      debouncedSearch,
      filters.status,
      filters.position,
      filters.club,
      filters.ratingMin,
      filters.tier,
      sortKey,
      sortDir,
    ]
  );

  const [pageSize, setPageSize] = useState(SHOWCASE_PAGE_SIZE);

  useEffect(() => {
    const syncPageSize = () => setPageSize(getShowcasePageSize());
    syncPageSize();
    const mq = window.matchMedia("(max-width: 639px)");
    mq.addEventListener("change", syncPageSize);
    return () => mq.removeEventListener("change", syncPageSize);
  }, []);

  useEffect(() => {
    if (!deepLinkPlayerId) return;
    const player = ALL_PLAYERS.find((p) => p.id === deepLinkPlayerId);
    if (!player) return;
    setDetailPlayer(player);
    setExpandedPlayerId(player.id);
    setSearchInput(player.name);
  }, [deepLinkPlayerId]);

  useEffect(() => {
    setCurrentPage(1);
    setExpandedPlayerId(null);
  }, [filterResultsKey]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const effectivePage = Math.min(currentPage, totalPages);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pagePlayers = useMemo(() => {
    const start = (effectivePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, effectivePage, pageSize]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    setExpandedPlayerId(null);
  }, []);

  const handleTogglePlayer = useCallback((player: Player) => {
    setExpandedPlayerId((current) =>
      current === player.id ? null : player.id
    );
  }, []);

  const handleOpenDetail = useCallback((player: Player) => {
    setDetailPlayer(player);
  }, []);

  const updateFilters = useCallback(
    (updater: (f: ShowcaseFilters) => ShowcaseFilters) => {
      playUiClick();
      setFilters(updater);
    },
    []
  );

  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];

    if (debouncedSearch.trim()) {
      chips.push({
        key: "search",
        label: `Search: "${debouncedSearch.trim()}"`,
        clear: () => setSearchInput(""),
      });
    }
    if (filters.status !== DEFAULT_FILTERS.status) {
      chips.push({
        key: "status",
        label: `Type: ${formatPlayerTypeLabel(filters.status)}`,
        clear: () =>
          updateFilters((f) => ({ ...f, status: DEFAULT_FILTERS.status })),
      });
    }
    if (filters.position !== "all") {
      chips.push({
        key: "position",
        label: `Position: ${POSITION_LABELS[filters.position]}`,
        clear: () => updateFilters((f) => ({ ...f, position: "all" })),
      });
    }
    if (filters.club !== "all") {
      chips.push({
        key: "club",
        label: `Team: ${filters.club}`,
        clear: () => updateFilters((f) => ({ ...f, club: "all" })),
      });
    }
    if (filters.ratingMin !== "all") {
      chips.push({
        key: "rating",
        label: `Rating: ${filters.ratingMin}+`,
        clear: () => updateFilters((f) => ({ ...f, ratingMin: "all" })),
      });
    }
    if (filters.tier !== "all") {
      chips.push({
        key: "tier",
        label: `Tier: ${TIER_FILTER_LABELS[filters.tier]}`,
        clear: () => updateFilters((f) => ({ ...f, tier: "all" })),
      });
    }

    return chips;
  }, [filters, debouncedSearch, updateFilters]);

  const resetFilters = () => {
    playUiClick();
    setFilters(DEFAULT_FILTERS);
    setSearchInput("");
    setSortKey("rating");
    setSortDir("desc");
    setCurrentPage(1);
    setExpandedPlayerId(null);
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

      <section className={`${CARD.panel} ${SPACING.cardPadding}`}>
        <h2 className={`mb-4 text-center ${TYPO.statLabel}`}>
          Database Overview
        </h2>
        <div className={`grid ${SPACING.cardGridGap} sm:grid-cols-2 lg:grid-cols-3`}>
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

      <div className="grid gap-4 lg:grid-cols-[280px_1fr] lg:gap-6">
        <button
          type="button"
          onClick={() => {
            playUiClick();
            setFiltersOpen((open) => !open);
          }}
          className={`${CARD.panel} flex w-full items-center justify-between px-4 py-3 lg:hidden`}
        >
          <span className={TYPO.sectionTitle}>Filters</span>
          <span className="text-xs text-gray-500">
            {filtersOpen ? "Hide" : "Show"}
          </span>
        </button>

        <aside
          className={`${CARD.panel} flex max-h-[calc(100vh-6rem)] flex-col lg:sticky lg:top-20 ${
            filtersOpen ? "flex" : "hidden lg:flex"
          }`}
        >
          <div className={`flex shrink-0 items-center justify-between ${SPACING.buttonGap} border-b border-pitch-600/30 px-4 py-3 sm:px-5`}>
            <h2 className={TYPO.sectionTitle}>
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

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden p-4 sm:p-5">
          <FilterField label="Search">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Name, club, position…"
              className={RL_FILTER_INPUT_CLASS}
            />
          </FilterField>

          <FilterField label="Team">
            <select
              value={filters.club}
              onChange={(e) =>
                updateFilters((f) => ({ ...f, club: e.target.value }))
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
                updateFilters((f) => ({
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
                updateFilters((f) => ({
                  ...f,
                  status: e.target.value as PlayerCategory | "all",
                }))
              }
              className={RL_FILTER_INPUT_CLASS}
            >
              <option value="current">Current</option>
              <option value="historic">Historic</option>
              <option value="legend">Legend</option>
              <option value="all">All</option>
            </select>
          </FilterField>

          <FilterField label="Rating">
            <select
              value={filters.ratingMin}
              onChange={(e) =>
                updateFilters((f) => ({
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
                onClick={() => updateFilters((f) => ({ ...f, tier: "all" }))}
              >
                All
              </TierChip>
              {TIER_OPTIONS.map(([key, label]) => (
                <TierChip
                  key={key}
                  active={filters.tier === key}
                  onClick={() => updateFilters((f) => ({ ...f, tier: key }))}
                >
                  {label}
                </TierChip>
              ))}
            </div>
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
                    playUiClick();
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

        <div className="min-w-0 space-y-4">
          <div className="matchday-panel flex flex-wrap items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
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
            <div className="card-glass px-4 py-10 text-center text-gray-500 sm:p-12">
              No players match your filters. Try adjusting or reset.
            </div>
          ) : (
            <>
              <ShowcasePagination
                currentPage={effectivePage}
                totalPages={totalPages}
                totalItems={filtered.length}
                pageSize={pageSize}
                onPageChange={handlePageChange}
              />

              <div className="showcase-player-grid grid items-start gap-2 sm:grid-cols-2 sm:gap-2.5 xl:grid-cols-3">
                {pagePlayers.map((player) => (
                  <div key={player.id} className="min-w-0 self-start">
                    <ShowcasePlayerCard
                      player={player}
                      expanded={expandedPlayerId === player.id}
                      onToggle={handleTogglePlayer}
                      onOpenDetail={handleOpenDetail}
                    />
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <ShowcasePagination
                  currentPage={effectivePage}
                  totalPages={totalPages}
                  totalItems={filtered.length}
                  pageSize={pageSize}
                  onPageChange={handlePageChange}
                />
              )}
            </>
          )}
        </div>
      </div>

      {detailPlayer && (
        <PlayerDetailModal
          player={detailPlayer}
          onClose={() => setDetailPlayer(null)}
        />
      )}
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
