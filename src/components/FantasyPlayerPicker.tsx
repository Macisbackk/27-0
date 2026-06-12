"use client";

import { useCallback, useDeferredValue, useMemo, useState } from "react";
import {
  getFantasyEligiblePlayers,
  getFantasyEligiblePositions,
  getFantasyBudgetForSlot,
  canAffordPlayerForSlot,
  isPlayerInSquad,
  DEFAULT_FANTASY_PICKER_FILTERS,
  type FantasyPickerFilters,
  type FantasySortKey,
} from "@/lib/game/fantasy-mode";
import { formatValue } from "@/lib/players";
import { formatPlayerDisplayName } from "@/lib/players/prime-year";
import { filterShowcasePlayers, getUniqueClubs } from "@/lib/players/showcase";
import type { Player, SquadSlot } from "@/lib/types";
import { PlayerCard } from "./PlayerCard";
import { playPlayerSelect, playUiClick } from "@/lib/sound";
import { BTN, CARD, FILTER } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

const POOL = getFantasyEligiblePlayers();
const CLUBS = getUniqueClubs(POOL);

interface FantasyPlayerPickerProps {
  slot: SquadSlot;
  squad: SquadSlot[];
  filters: FantasyPickerFilters;
  onFiltersChange: (filters: FantasyPickerFilters) => void;
  onSelect: (player: Player) => void;
  onRemove?: () => void;
  onClose: () => void;
}

export function FantasyPlayerPicker({
  slot,
  squad,
  filters,
  onFiltersChange,
  onSelect,
  onRemove,
  onClose,
}: FantasyPlayerPickerProps) {
  const debouncedSearch = useDeferredValue(filters.search);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);

  const slotPositions = getFantasyEligiblePositions(slot.position);
  const slotBudget = getFantasyBudgetForSlot(squad, slot);
  const changingPlayer = !!slot.player;

  const updateFilters = useCallback(
    (patch: Partial<FantasyPickerFilters>) => {
      onFiltersChange({ ...filters, ...patch });
    },
    [filters, onFiltersChange]
  );

  const resetFilters = useCallback(() => {
    playUiClick();
    onFiltersChange({ ...DEFAULT_FANTASY_PICKER_FILTERS });
  }, [onFiltersChange]);

  const players = useMemo(() => {
    const showcaseFilters = {
      search: debouncedSearch,
      status: "all" as const,
      position: "all" as const,
      club: filters.club,
      ratingMin: "all" as const,
      tier: "all" as const,
      yearsActive: "",
      browseMode: "all" as const,
      teamYearTeam: "all",
      teamYearYear: "",
    };

    let result = filterShowcasePlayers(POOL, showcaseFilters).filter((p) =>
      slotPositions.includes(p.position)
    );

    if (filters.affordableOnly) {
      result = result.filter((p) => canAffordPlayerForSlot(squad, slot, p));
    }

    return [...result].sort((a, b) => {
      switch (filters.sortKey) {
        case "rating-asc":
          return a.peakRating - b.peakRating;
        case "value-desc":
          return b.value - a.value;
        case "value-asc":
          return a.value - b.value;
        default:
          return b.peakRating - a.peakRating;
      }
    });
  }, [
    debouncedSearch,
    filters.club,
    filters.sortKey,
    filters.affordableOnly,
    slotPositions,
    squad,
    slot,
  ]);

  const handleSelect = useCallback(
    (player: Player) => {
      playPlayerSelect();
      onSelect(player);
    },
    [onSelect]
  );

  const activeFilterCount =
    (filters.club !== "all" ? 1 : 0) +
    (filters.sortKey !== DEFAULT_FANTASY_PICKER_FILTERS.sortKey ? 1 : 0);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm">
      <div className="flex shrink-0 items-center justify-between border-b border-pitch-700/60 px-3 py-2 sm:px-4">
        <div className="min-w-0">
          <p className={TYPO.sectionLabel}>Select player</p>
          <h2 className="truncate font-display text-base font-bold text-white sm:text-lg">
            {slot.label}
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Slot budget {formatValue(slotBudget)}
            {changingPlayer && slot.player && (
              <> · Current {formatValue(slot.player.value)}</>
            )}
          </p>
        </div>
        <button type="button" onClick={onClose} className={BTN.close}>
          Close
        </button>
      </div>

      <div className="shrink-0 border-b border-pitch-700/50 px-3 py-2 sm:px-4">
        {changingPlayer && onRemove && (
          <button
            type="button"
            onClick={() => {
              playUiClick();
              onRemove();
            }}
            className={`${BTN.base} ${BTN.secondary} mb-2 min-h-[32px] px-3 py-1.5 text-xs`}
          >
            Remove Player
          </button>
        )}

        <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
          <input
            type="search"
            placeholder="Search players"
            value={filters.search}
            onChange={(e) => updateFilters({ search: e.target.value })}
            className={`${FILTER.input} min-w-0 flex-1 py-1.5 text-xs sm:py-2 sm:text-sm`}
          />
          <button
            type="button"
            aria-pressed={filters.affordableOnly}
            onClick={() => {
              playUiClick();
              updateFilters({ affordableOnly: !filters.affordableOnly });
            }}
            className={`shrink-0 rounded-lg border px-2 py-1.5 text-[10px] font-medium transition sm:px-2.5 sm:text-xs ${
              filters.affordableOnly ? FILTER.chipActive : FILTER.chipIdle
            }`}
          >
            Affordable
          </button>
          <button
            type="button"
            aria-expanded={filtersOpen}
            onClick={() => {
              playUiClick();
              setFiltersOpen((open) => !open);
            }}
            className={`shrink-0 rounded-lg border px-2 py-1.5 text-[10px] font-medium transition sm:px-2.5 sm:text-xs ${
              filtersOpen || activeFilterCount > 0
                ? FILTER.chipActive
                : FILTER.chipIdle
            }`}
          >
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
        </div>

        {filtersOpen && (
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5 border-t border-pitch-700/40 pt-2 sm:gap-2">
            <FilterSelect
              label="Team"
              value={filters.club}
              onChange={(club) => {
                playUiClick();
                updateFilters({ club });
              }}
              options={[
                { value: "all", label: "All teams" },
                ...CLUBS.map((c) => ({ value: c, label: c })),
              ]}
            />
            <FilterSelect
              label="Sort"
              value={filters.sortKey}
              onChange={(sortKey) => {
                playUiClick();
                updateFilters({ sortKey: sortKey as FantasySortKey });
              }}
              options={[
                { value: "rating-desc", label: "Highest Rating" },
                { value: "rating-asc", label: "Lowest Rating" },
                { value: "value-desc", label: "Highest Value" },
                { value: "value-asc", label: "Lowest Value" },
              ]}
            />
            <button
              type="button"
              onClick={resetFilters}
              className={`${BTN.base} ${BTN.secondary} min-h-[32px] px-2.5 py-1.5 text-[10px] sm:text-xs`}
            >
              Reset Filters
            </button>
          </div>
        )}

        <p className={`${TYPO.bodySm} mt-1.5`}>
          {players.length} eligible player{players.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 sm:px-4 sm:py-3">
        {players.length === 0 ? (
          <p className="py-12 text-center text-gray-500">
            No players match your filters.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {players.map((player) => {
              const signed = isPlayerInSquad(squad, player.id);
              const affordable = canAffordPlayerForSlot(squad, slot, player);
              const disabled =
                (signed && player.id !== slot.player?.id) || !affordable;
              const expanded = expandedPlayerId === player.id;
              const displayName = formatPlayerDisplayName(player);

              return (
                <li key={player.id}>
                  <div
                    className={`${CARD.base} overflow-hidden ${
                      disabled ? "border-red-900/40 opacity-60" : ""
                    } ${!affordable && !signed ? "border-red-900/30" : ""}`}
                  >
                    <button
                      type="button"
                      className="flex w-full min-w-0 items-start gap-2 px-3 py-2 text-left sm:py-2.5"
                      onClick={() => {
                        playUiClick();
                        setExpandedPlayerId((id) =>
                          id === player.id ? null : player.id
                        );
                      }}
                    >
                      <span className="showcase-compact-name min-w-0 flex-1 font-display font-bold leading-snug text-white">
                        {displayName}
                      </span>
                      <span className="shrink-0 text-[10px] font-semibold text-gray-400 sm:text-xs">
                        {player.peakRating} OVR
                      </span>
                      <span className="hidden shrink-0 text-[10px] text-gray-500 sm:inline sm:text-xs">
                        {formatValue(player.value)}
                      </span>
                      <span className="shrink-0 self-start text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                        {expanded ? "Close" : "View"}
                      </span>
                    </button>

                    {!affordable && !signed && (
                      <p className="border-t border-pitch-700/50 px-3 py-1 text-xs font-medium text-red-400">
                        Over budget
                      </p>
                    )}
                    {signed && player.id !== slot.player?.id && (
                      <p className="border-t border-pitch-700/50 px-3 py-1 text-xs text-gray-500">
                        Already signed
                      </p>
                    )}

                    {expanded && (
                      <div className="border-t border-pitch-700/50 px-2 pb-3 pt-2">
                        <PlayerCard player={player} equalHeight compactMobile />
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => handleSelect(player)}
                          className={`mt-2 w-full ${BTN.base} ${BTN.primary} disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                          {slot.player?.id === player.id
                            ? "Keep"
                            : changingPlayer
                              ? "Change Player"
                              : "Sign"}
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex min-w-0 items-center gap-1.5">
      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-gray-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${FILTER.input} max-w-[9rem] py-1 pl-2 pr-6 text-[10px] sm:max-w-none sm:py-1.5 sm:pl-2.5 sm:text-xs`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
