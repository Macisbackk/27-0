"use client";

import { useCallback, useDeferredValue, useMemo, useState } from "react";
import {
  getFantasyEligiblePlayers,
  getFantasyEligiblePositions,
  canAffordPlayerForSlot,
  isPlayerInSquad,
  DEFAULT_FANTASY_PICKER_FILTERS,
  type FantasyPickerFilters,
  type FantasySortKey,
} from "@/lib/game/fantasy-mode";
import { formatValue } from "@/lib/players";
import { getPlayerColorClub } from "@/lib/players/run-club";
import { filterShowcasePlayers, getUniqueClubs } from "@/lib/players/showcase";
import { getClubColors } from "@/lib/clubs";
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
  /** Inline card layout (Fantasy squad build) vs full-screen overlay. */
  inline?: boolean;
}

export function FantasyPlayerPicker({
  slot,
  squad,
  filters,
  onFiltersChange,
  onSelect,
  onRemove,
  onClose,
  inline = false,
}: FantasyPlayerPickerProps) {
  const debouncedSearch = useDeferredValue(filters.search);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);

  const slotPositions = getFantasyEligiblePositions(slot.position);
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
      age: "all" as const,
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

  const shellClass = inline
    ? `${CARD.panel} overflow-hidden border-accent-green/25`
    : "fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm";

  const headerClass = inline
    ? "flex shrink-0 flex-wrap items-start justify-between gap-2 border-b border-pitch-700/50 px-3 py-3 sm:px-4"
    : "flex shrink-0 items-center justify-between border-b border-pitch-700/60 px-3 py-2 sm:px-4";

  const filtersClass = inline
    ? "shrink-0 border-b border-pitch-700/50 px-3 py-3 sm:px-4"
    : "shrink-0 border-b border-pitch-700/50 px-3 py-2 sm:px-4";

  const listClass = inline
    ? "max-h-[min(42vh,420px)] overflow-y-auto overflow-x-hidden px-3 py-3 sm:px-4"
    : "min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 sm:px-4 sm:py-3";

  const listInnerClass = "mx-auto w-full max-w-2xl";
  const contentWrapClass = inline ? "mx-auto w-full max-w-2xl" : "";

  return (
    <div className={shellClass}>
      <div className={headerClass}>
        <div className={`min-w-0 flex-1 ${contentWrapClass}`}>
          <p className={TYPO.sectionLabel}>Select player</p>
          <h2 className="truncate font-display text-base font-bold text-white sm:text-lg">
            {slot.label}
          </h2>
          {changingPlayer && slot.player && (
            <p className="mt-0.5 text-xs text-gray-500">
              Current signing · {formatValue(slot.player.value)}
            </p>
          )}
        </div>
        <button type="button" onClick={onClose} className={BTN.close}>
          Close
        </button>
      </div>

      <div className={filtersClass}>
        <div className={contentWrapClass}>
        {changingPlayer && onRemove && (
          <button
            type="button"
            onClick={() => {
              playUiClick();
              onRemove();
            }}
            className={`${BTN.base} ${BTN.secondary} mb-3 min-h-[36px] px-3 py-1.5 text-xs`}
          >
            Remove Player
          </button>
        )}

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <input
            type="search"
            placeholder="Search players"
            value={filters.search}
            onChange={(e) => updateFilters({ search: e.target.value })}
            className={`${FILTER.input} min-w-0 w-full py-2 text-xs sm:max-w-xs sm:flex-1 sm:text-sm`}
          />
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              aria-pressed={filters.affordableOnly}
              onClick={() => {
                playUiClick();
                updateFilters({ affordableOnly: !filters.affordableOnly });
              }}
              className={`btn-press shrink-0 rounded-lg border px-2.5 py-2 text-[10px] font-medium transition sm:text-xs ${
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
              className={`btn-press shrink-0 rounded-lg border px-2.5 py-2 text-[10px] font-medium transition sm:text-xs ${
                filtersOpen || activeFilterCount > 0
                  ? FILTER.chipActive
                  : FILTER.chipIdle
              }`}
            >
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </button>
          </div>
        </div>

        {filtersOpen && (
          <div className="mt-3 flex min-w-0 flex-col gap-2 border-t border-pitch-700/40 pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
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
              className={`${BTN.base} ${BTN.secondary} min-h-[36px] px-3 py-1.5 text-[10px] sm:text-xs`}
            >
              Reset Filters
            </button>
          </div>
        )}

        <p className={`${TYPO.bodySm} mt-2`}>
          {players.length} eligible player{players.length !== 1 ? "s" : ""}
        </p>
        </div>
      </div>

      <div className={listClass}>
        <div className={listInnerClass}>
        {players.length === 0 ? (
          <p className="py-8 text-center text-gray-500">
            No players match your filters.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
            {players.map((player) => {
              const signed = isPlayerInSquad(squad, player.id);
              const affordable = canAffordPlayerForSlot(squad, slot, player);
              const disabled =
                (signed && player.id !== slot.player?.id) || !affordable;
              const expanded = expandedPlayerId === player.id;
              const colorClub = getPlayerColorClub(player);
              const colors = getClubColors(colorClub);

              return (
                <div
                  key={player.id}
                  className={`relative min-w-0 ${expanded ? "col-span-2 sm:col-span-3" : ""}`}
                >
                  <div
                    className={`${CARD.base} flex h-full flex-col overflow-hidden transition ${
                      disabled ? "opacity-55" : "hover:border-accent-green/35"
                    } ${!affordable && !signed ? "border-red-900/35" : ""}`}
                    style={{
                      boxShadow: `inset 3px 0 0 ${colors.primary}`,
                    }}
                  >
                    <button
                      type="button"
                      disabled={disabled}
                      className="btn-press group flex min-w-0 flex-1 flex-col text-left disabled:cursor-not-allowed"
                      onClick={() => {
                        if (disabled) return;
                        handleSelect(player);
                      }}
                    >
                      <div className="mb-1 flex items-center justify-between px-1 pt-1">
                        <span className="font-display text-[8px] font-bold uppercase tracking-wider text-gray-500 sm:text-[10px]">
                          {signed && player.id !== slot.player?.id
                            ? "Signed"
                            : !affordable
                              ? "Over budget"
                              : "Sign"}
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          className="rounded-full border border-pitch-600/50 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-gray-400 transition hover:border-accent-green/40 hover:text-accent-green sm:text-[9px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            playUiClick();
                            setExpandedPlayerId((id) =>
                              id === player.id ? null : player.id
                            );
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              playUiClick();
                              setExpandedPlayerId((id) =>
                                id === player.id ? null : player.id
                              );
                            }
                          }}
                        >
                          {expanded ? "Close" : "Info"}
                        </span>
                      </div>
                      <div className="min-h-0 flex-1 overflow-hidden px-0.5 pb-1">
                        <PlayerCard
                          player={player}
                          selectable
                          equalHeight
                          compactMobile
                        />
                      </div>
                    </button>

                    {expanded && (
                      <div className="border-t border-pitch-700/50 px-2 pb-2 pt-2 sm:px-3">
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
                </div>
              );
            })}
          </div>
        )}
        </div>
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
    <label className="flex min-w-0 flex-1 items-center gap-1.5 sm:flex-none">
      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-gray-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${FILTER.input} min-w-0 flex-1 py-1.5 pl-2 pr-6 text-[10px] sm:max-w-[11rem] sm:text-xs`}
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
