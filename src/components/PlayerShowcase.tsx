"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  getShowcasePlayers,
  getPlayerDisplayName,
  toPlayerShowcaseViewModel,
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
import { playUiClick } from "@/lib/sound";
import { FILTER } from "@/lib/ui/design-system";
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
      return "Current ('26)";
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
  const [detailPlayerId, setDetailPlayerId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const clubs = useMemo(() => getUniqueClubs(allPlayers), [allPlayers]);
  const years = useMemo(() => getUniqueShowcaseYears(allPlayers), [allPlayers]);
  const dbStats = useMemo(() => computeShowcaseDbStats(allPlayers), [allPlayers]);
  // "Top rated" names come from the same default sort as the list, so they match row 1 (ties
  // at the top rating are all named, up to three).
  const topRated = useMemo(() => {
    const sorted = applyShowcasePipeline(allPlayers, DEFAULT_FILTERS, "rating", "desc");
    const top = sorted[0];
    if (!top) return null;
    const tied = sorted.filter((p) => p.peakRating === top.peakRating);
    return {
      rating: top.peakRating,
      names: tied.slice(0, 3).map((p) => getPlayerDisplayName(p)),
      more: Math.max(0, tied.length - 3),
    };
  }, [allPlayers]);

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
    setDetailPlayerId(player.id);
    setSearchInput(getPlayerDisplayName(player));
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

  const handleOpenDetail = useCallback((playerId: string) => {
    setDetailPlayerId(playerId);
  }, []);

  const detailPlayer = useMemo(() => {
    if (!detailPlayerId) return null;
    return (
      allPlayers.find((p) => p.id === detailPlayerId) ??
      pagePlayers.find((p) => p.id === detailPlayerId) ??
      null
    );
  }, [detailPlayerId, allPlayers, pagePlayers]);

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

  const filterPanel = (
    <div className="grid gap-4 sm:grid-cols-2">
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

      <FilterField label="Tier" wide>
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

      <FilterField label="Sort by" wide>
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
              className="showcase-pill !min-h-[34px] !px-3 !text-xs"
              aria-pressed={sortKey === key}
            >
              {label}
            </button>
          ))}
        </div>
      </FilterField>
    </div>
  );

  const typeOptions: { id: PlayerCategory | "all"; label: string }[] = [
    { id: "all", label: "All" },
    { id: "current", label: "Current" },
    { id: "historic", label: "Historic" },
    { id: "legend", label: "Legends" },
  ];
  // The type pills already show the player type, so the Filters count leaves it out.
  const panelFilterCount = activeFilters.filter((c) => c.key !== "status" && c.key !== "search").length;

  return (
    <div className="mx-auto w-full max-w-[60rem] space-y-4">
      <header className="text-center">
        <p className={TYPO.sectionLabel}>Player database</p>
        <h1 className={`mt-2 ${TYPO.pageTitle}`}>Player Showcase</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-[color:var(--fl-muted)]">
          {dbStats.total.toLocaleString("en-GB")} players: {dbStats.current} in this season&rsquo;s squads,{" "}
          {dbStats.historic.toLocaleString("en-GB")} era cards and {dbStats.legends} legends.
          {topRated ? (
            <>
              {" "}Top rated ({topRated.rating}):{" "}
              <span className="font-semibold text-white">{topRated.names.join(", ")}</span>
              {topRated.more > 0 ? ` and ${topRated.more} more` : ""}.
            </>
          ) : null}
        </p>
      </header>

      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Player type">
        {typeOptions.map((t) => (
          <button
            key={t.id}
            type="button"
            className="showcase-pill"
            aria-pressed={filters.status === t.id}
            onClick={() => updateFilters((f) => ({ ...f, status: t.id }))}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search name, club or position"
          className={`${FILTER.input} min-w-0 flex-1 !rounded-full`}
          aria-label="Search players"
        />
        <button
          type="button"
          className="showcase-pill shrink-0"
          aria-expanded={filtersOpen}
          aria-pressed={filtersOpen || panelFilterCount > 0}
          onClick={() => {
            playUiClick();
            setFiltersOpen((open) => !open);
          }}
        >
          Filters{panelFilterCount > 0 ? ` (${panelFilterCount})` : ""}
        </button>
      </div>

      {filtersOpen ? (
        <section aria-label="Filters" className="fl-rise rounded-[20px] bg-[color:var(--fl-surface)] p-4 text-left sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className={TYPO.sectionTitle}>Filters</p>
            <GameButton variant="ghost" size="sm" fullWidth={false} onClick={resetFilters}>
              Reset
            </GameButton>
          </div>
          {filterPanel}
        </section>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        <span className="font-semibold text-white">
          {filtered.length.toLocaleString("en-GB")} player{filtered.length !== 1 ? "s" : ""}
        </span>
        {activeFilters
          .filter((chip) => chip.key !== "status")
          .map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-[color:var(--fl-raised)] px-3 py-1 text-xs font-semibold text-white"
              aria-label={`Clear ${chip.label}`}
            >
              <span className="truncate">{chip.label}</span>
              <span aria-hidden className="text-[color:var(--fl-muted)]">×</span>
            </button>
          ))}
      </div>
      {filters.year !== "all" && <EraRatingExplanation compact className="px-2" />}

      {filtered.length === 0 ? (
        <p className="rounded-[20px] bg-[color:var(--fl-surface)] px-4 py-10 text-center text-sm text-gray-400">
          No players match. Try another search or reset the filters.
        </p>
      ) : (
        <>
          <ShowcasePagination
            currentPage={effectivePage}
            totalPages={totalPages}
            totalItems={filtered.length}
            pageSize={pageSize}
            onPageChange={handlePageChange}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            {pagePlayers.map((player) => (
              <ShowcasePlayerCard key={player.id} player={player} onOpenDetail={handleOpenDetail} />
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

      {detailPlayer && (
        <PlayerDetailModal
          player={detailPlayer}
          cardDisplayName={toPlayerShowcaseViewModel(detailPlayer).displayName}
          onClose={() => setDetailPlayerId(null)}
        />
      )}
    </div>
  );
}

function FilterField({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const fieldId = `showcase-filter-${label.toLowerCase().replace(/\s+/g, "-")}`;

  if (isValidElement(children) && children.type === "select") {
    return (
      <div className={wide ? "sm:col-span-2" : ""}>
        <label
          htmlFor={fieldId}
          className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[color:var(--fl-muted)]"
        >
          {label}
        </label>
        {cloneElement(children as ReactElement<{ id?: string }>, { id: fieldId })}
      </div>
    );
  }

  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <p
        id={fieldId}
        className="mb-1.5 text-xs font-medium uppercase tracking-wider text-[color:var(--fl-muted)]"
      >
        {label}
      </p>
      <div role="group" aria-labelledby={fieldId}>
        {children}
      </div>
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
      className="showcase-pill !min-h-[34px] !px-3 !text-xs"
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
