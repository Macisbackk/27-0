"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getShowcasePlayers,
  formatValue,
  getRosterPlayerIds,
  getRosterPlayerIdsForTeamAllYears,
  getTeamsWithYearRosters,
  getYearsForTeam,
  hasTeamYearRoster,
} from "@/lib/players";
import type { PlayerCategory, Position } from "@/lib/types";
import { POSITION_LABELS } from "@/lib/positions";
import {
  applyShowcasePipeline,
  computeShowcaseDbStats,
  getUniqueClubs,
  AGE_FILTER_LABELS,
  TIER_FILTER_LABELS,
  type AgeFilter,
  type RatingFilter,
  type ShowcaseBrowseMode,
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

const TEAM_YEAR_TEAMS = getTeamsWithYearRosters();

const DEFAULT_FILTERS: ShowcaseFilters = {
  search: "",
  status: "current",
  position: "all",
  club: "all",
  ratingMin: "all",
  tier: "all",
  yearsActive: "",
  age: "all",
  browseMode: "all",
  teamYearTeam: "all",
  teamYearYear: "",
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

  const teamYearYears = useMemo(
    () =>
      filters.teamYearTeam !== "all"
        ? getYearsForTeam(filters.teamYearTeam)
        : [],
    [filters.teamYearTeam]
  );

  const teamYearRosterIds = useMemo(() => {
    if (activeFiltersState.browseMode !== "teamYear") return null;
    if (activeFiltersState.teamYearTeam === "all") return null;
    if (!activeFiltersState.teamYearYear) {
      return new Set(
        getRosterPlayerIdsForTeamAllYears(activeFiltersState.teamYearTeam)
      );
    }
    return new Set(
      getRosterPlayerIds(
        activeFiltersState.teamYearTeam,
        activeFiltersState.teamYearYear
      )
    );
  }, [activeFiltersState]);

  const filtered = useMemo(
    () =>
      applyShowcasePipeline(
        ALL_PLAYERS,
        activeFiltersState,
        sortKey,
        sortDir,
        teamYearRosterIds
      ),
    [activeFiltersState, sortKey, sortDir, teamYearRosterIds]
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
        filters.yearsActive,
        filters.age,
        filters.browseMode,
        filters.teamYearTeam,
        filters.teamYearYear,
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
      filters.yearsActive,
      filters.age,
      filters.browseMode,
      filters.teamYearTeam,
      filters.teamYearYear,
      sortKey,
      sortDir,
    ]
  );

  useEffect(() => {
    setCurrentPage(1);
    setExpandedPlayerId(null);
  }, [filterResultsKey]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / SHOWCASE_PAGE_SIZE));
  const effectivePage = Math.min(currentPage, totalPages);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pagePlayers = useMemo(() => {
    const start = (effectivePage - 1) * SHOWCASE_PAGE_SIZE;
    return filtered.slice(start, start + SHOWCASE_PAGE_SIZE);
  }, [filtered, effectivePage]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    setExpandedPlayerId(null);
  }, []);

  const teamYearEmpty =
    activeFiltersState.browseMode === "teamYear" &&
    activeFiltersState.teamYearTeam !== "all" &&
    activeFiltersState.teamYearYear !== "" &&
    !hasTeamYearRoster(
      activeFiltersState.teamYearTeam,
      activeFiltersState.teamYearYear
    );

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
    if (filters.yearsActive.trim()) {
      chips.push({
        key: "years",
        label: `Years Active: ${filters.yearsActive.trim()}`,
        clear: () => updateFilters((f) => ({ ...f, yearsActive: "" })),
      });
    }
    if (filters.age !== DEFAULT_FILTERS.age) {
      chips.push({
        key: "age",
        label: `Age: ${AGE_FILTER_LABELS[filters.age]}`,
        clear: () => updateFilters((f) => ({ ...f, age: "all" })),
      });
    }
    if (filters.browseMode === "teamYear") {
      const squadLabel =
        filters.teamYearTeam === "all"
          ? "All Teams"
          : filters.teamYearYear
            ? `${filters.teamYearTeam} ${filters.teamYearYear}`
            : `${filters.teamYearTeam} (all years)`;
      chips.push({
        key: "teamYear",
        label: `Squad: ${squadLabel}`,
        clear: () =>
          updateFilters((f) => ({
            ...f,
            browseMode: "all",
            teamYearTeam: "all",
            teamYearYear: "",
          })),
      });
    }
    if (sortKey === "name") {
      chips.push({
        key: "alpha",
        label: `A–Z: ${sortDir === "asc" ? "A→Z" : "Z→A"}`,
        clear: () => {
          playUiClick();
          setSortKey("rating");
          setSortDir("desc");
        },
      });
    }

    return chips;
  }, [filters, debouncedSearch, sortKey, sortDir, updateFilters]);

  const resetFilters = () => {
    playUiClick();
    setFilters(DEFAULT_FILTERS);
    setSearchInput("");
    setSortKey("rating");
    setSortDir("desc");
    setCurrentPage(1);
    setExpandedPlayerId(null);
  };

  const setAlphaSort = (dir: "asc" | "desc") => {
    playUiClick();
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
          <span className={TYPO.sectionTitle}>Filters & Browse</span>
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
          <FilterField label="Browse">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["all", "All Players"],
                  ["teamYear", "Team > Year"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() =>
                    updateFilters((f) => ({
                      ...f,
                      browseMode: mode as ShowcaseBrowseMode,
                      teamYearTeam: "all",
                      teamYearYear: "",
                    }))
                  }
                  className={`rounded-lg border px-2 py-2 text-[11px] font-medium transition ${
                    filters.browseMode === mode
                      ? RL_FILTER_CHIP_ACTIVE
                      : RL_FILTER_CHIP_IDLE
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </FilterField>

          {filters.browseMode === "teamYear" && (
            <>
              <FilterField label="Team">
                <select
                  value={filters.teamYearTeam}
                  onChange={(e) => {
                    const team = e.target.value;
                    updateFilters((f) => ({
                      ...f,
                      teamYearTeam: team,
                      teamYearYear: "",
                    }));
                  }}
                  className={RL_FILTER_INPUT_CLASS}
                >
                  <option value="all">All Teams</option>
                  {TEAM_YEAR_TEAMS.map((team) => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
                </select>
              </FilterField>
              {filters.teamYearTeam !== "all" && (
                <FilterField label="Year">
                  <select
                    value={filters.teamYearYear}
                    onChange={(e) =>
                      updateFilters((f) => ({
                        ...f,
                        teamYearYear: e.target.value,
                      }))
                    }
                    className={RL_FILTER_INPUT_CLASS}
                  >
                    <option value="">All years</option>
                    {teamYearYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </FilterField>
              )}
            </>
          )}
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

          <FilterField label="Age">
            <select
              value={filters.age}
              onChange={(e) =>
                updateFilters((f) => ({
                  ...f,
                  age: e.target.value as AgeFilter,
                }))
              }
              className={RL_FILTER_INPUT_CLASS}
            >
              {(Object.keys(AGE_FILTER_LABELS) as AgeFilter[]).map((key) => (
                <option key={key} value={key}>
                  {AGE_FILTER_LABELS[key]}
                </option>
              ))}
            </select>
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

          {teamYearEmpty ? (
            <div className="card-glass px-4 py-10 text-center text-gray-500 sm:p-12">
              No squad data available for this team/year yet.
            </div>
          ) : filtered.length === 0 ? (
            <div className="card-glass px-4 py-10 text-center text-gray-500 sm:p-12">
              No players match your filters. Try adjusting or reset.
            </div>
          ) : (
            <>
              <ShowcasePagination
                currentPage={effectivePage}
                totalPages={totalPages}
                totalItems={filtered.length}
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
