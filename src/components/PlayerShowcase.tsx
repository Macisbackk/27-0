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
  getUniqueShowcaseYears,
  RATING_FILTER_LABELS,
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
import { GameButton } from "@/components/ui/GameButton";
import { GameHeader } from "@/components/ui/GameHeader";
import { GamePanel } from "@/components/ui/GamePanel";
import { GameStatCard } from "@/components/ui/GameStatCard";
import { ScoreboardPanel } from "@/components/ui/ScoreboardPanel";
import { playUiClick } from "@/lib/sound";
import { FILTER, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { EraRatingExplanation } from "./EraRatingExplanation";

const DEFAULT_FILTERS: ShowcaseFilters = {
  search: "",
  status: "all",
  position: "all",
  club: "all",
  year: "all",
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
  const allPlayers = useMemo(() => getShowcasePlayers(), []);
  const POSITIONS = useMemo(
    () => Object.keys(POSITION_LABELS) as Position[],
    []
  );
  const deepLinkPlayerId = searchParams.get("player");
  const [filters, setFilters] = useState<ShowcaseFilters>(DEFAULT_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDeferredValue(searchInput);
  const [sortKey, setSortKey] = useState<ShowcaseSortKey>("rating");
  const [sortDir, setSortDir] = useState<ShowcaseSortDir>("desc");
  const [detailPlayer, setDetailPlayer] = useState<Player | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const clubs = useMemo(() => getUniqueClubs(allPlayers), [allPlayers]);
  const years = useMemo(() => getUniqueShowcaseYears(allPlayers), [allPlayers]);
  const dbStats = useMemo(() => computeShowcaseDbStats(allPlayers), [allPlayers]);

  const activeFiltersState = useMemo(
    (): ShowcaseFilters => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch]
  );

  const filtered = useMemo(
    () =>
      applyShowcasePipeline(
        allPlayers,
        activeFiltersState,
        sortKey,
        sortDir
      ),
    [activeFiltersState, sortKey, sortDir, allPlayers]
  );

  const filterResultsKey = useMemo(
    () =>
      [
        debouncedSearch,
        filters.status,
        filters.position,
        filters.club,
        filters.year,
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
      filters.year,
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
    const player = allPlayers.find((p) => p.id === deepLinkPlayerId);
    if (!player) return;
    setDetailPlayer(player);
    setSearchInput(player.name);
    setFilters((current) => ({
      ...current,
      status: "all",
      club: "all",
      year: "all",
    }));
  }, [deepLinkPlayerId, allPlayers]);

  useEffect(() => {
    setCurrentPage(1);
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
    if (filters.year !== "all") {
      chips.push({
        key: "year",
        label: `Year: ${filters.year}`,
        clear: () => updateFilters((f) => ({ ...f, year: "all" })),
      });
    }
    if (filters.ratingMin !== "all") {
      chips.push({
        key: "rating",
        label: `Rating: ${RATING_FILTER_LABELS[filters.ratingMin]}`,
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
  };

  return (
    <div className="space-y-8">
      <GameHeader
        eyebrow="Player Database"
        title="Player Showcase"
        subtitle="Browse every player in the 27-0 database"
        className="[&_.game-header__eyebrow]:text-gray-400"
      />

      <GamePanel padded variant="elevated" flush>
        <p className={`mb-4 ${TYPO.sectionTitle}`}>Database Overview</p>
        <div className={`grid ${SPACING.cardGridGap} sm:grid-cols-2 lg:grid-cols-3`}>
          <GameStatCard
            neutral
            label="Total Players"
            value={String(dbStats.total)}
          />
          <GameStatCard
            neutral
            label="Current Players"
            value={String(dbStats.current)}
          />
          <GameStatCard
            neutral
            label="Historic Players"
            value={String(dbStats.historic)}
          />
          <GameStatCard
            neutral
            label="Legends"
            value={<span className="text-accent-gold">{dbStats.legends}</span>}
          />
          <GameStatCard
            neutral
            label="Highest Rated Player"
            value={
              dbStats.highestRated ? (
                <span className="text-accent-gold">
                  {dbStats.highestRated.name} ({dbStats.highestRated.peakRating})
                </span>
              ) : (
                "—"
              )
            }
          />
          <GameStatCard
            neutral
            label="Highest Transfer Value"
            value={
              dbStats.highestValue ? (
                <span className="text-accent-gold">
                  {dbStats.highestValue.name} (
                  {formatValue(dbStats.highestValue.value)})
                </span>
              ) : (
                "—"
              )
            }
          />
        </div>
      </GamePanel>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr] lg:gap-6">
        <GamePanel className="lg:hidden" variant="elevated" flush>
          <button
            type="button"
            onClick={() => {
              playUiClick();
              setFiltersOpen((open) => !open);
            }}
            className="btn-press flex w-full items-center justify-between px-4 py-3"
          >
            <span className={TYPO.sectionTitle}>Filters</span>
            <span className="text-xs text-gray-500">
              {filtersOpen ? "Hide" : "Show"}
            </span>
          </button>
        </GamePanel>

        <GamePanel
          variant="elevated"
          flush
          className={`lg:sticky lg:top-20 ${
            filtersOpen ? "" : "hidden lg:block"
          }`}
        >
          <div className="flex max-h-[calc(100vh-6rem)] flex-col">
          <div
            className={`flex shrink-0 items-center justify-between ${SPACING.buttonGap} border-b border-pitch-600/30 px-4 py-3 sm:px-5`}
          >
            <h2 className={TYPO.sectionTitle}>Filters</h2>
            <GameButton
              variant="ghost"
              size="sm"
              fullWidth={false}
              onClick={resetFilters}
            >
              Reset
            </GameButton>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden p-4 sm:p-5">
          <FilterField label="Search">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Name, club, position…"
              className={FILTER.input}
            />
          </FilterField>

          <FilterField label="Team">
            <select
              value={filters.club}
              onChange={(e) =>
                updateFilters((f) => ({ ...f, club: e.target.value }))
              }
              className={FILTER.input}
            >
              <option value="all">All Teams</option>
              {clubs.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Year">
            <select
              value={filters.year === "all" ? "all" : String(filters.year)}
              onChange={(e) =>
                updateFilters((f) => ({
                  ...f,
                  year:
                    e.target.value === "all"
                      ? "all"
                      : Number.parseInt(e.target.value, 10),
                }))
              }
              className={FILTER.input}
            >
              <option value="all">All Years</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
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
              className={FILTER.input}
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
              className={FILTER.input}
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
              className={FILTER.input}
            >
              <option value="all">Any Rating</option>
              <option value="80-82">80–82</option>
              <option value="83-85">83–85</option>
              <option value="86-88">86–88</option>
              <option value="89-91">89–91</option>
              <option value="92-94">92–94</option>
              <option value="95+">95+</option>
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
                  ["name", "A–Z"],
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
                    setSortDir(key === "name" ? "asc" : "desc");
                  }}
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
                    sortKey === key ? FILTER.chipActive : FILTER.chipIdle
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </FilterField>
          </div>
          </div>
        </GamePanel>

        <div className="min-w-0 space-y-4">
          <ScoreboardPanel
            flush
            className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3"
          >
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
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-0.5 text-[11px] font-medium transition ${FILTER.chipActive}`}
                  >
                    {chip.label}
                    <span aria-hidden>×</span>
                  </button>
                ))}
              </>
            )}
          </ScoreboardPanel>
          {filters.year !== "all" && (
            <EraRatingExplanation compact className="px-2" />
          )}

          {filtered.length === 0 ? (
            <GamePanel
              variant="elevated"
              flush
              className="px-4 py-10 text-center text-gray-500 sm:p-12"
            >
              No players match your filters. Try adjusting or reset.
            </GamePanel>
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
        active ? FILTER.chipActive : FILTER.chipIdle
      }`}
    >
      {children}
    </button>
  );
}
