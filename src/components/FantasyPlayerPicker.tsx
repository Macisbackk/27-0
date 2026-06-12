"use client";

import { useCallback, useDeferredValue, useMemo, useState } from "react";
import {
  getFantasyEligiblePlayers,
  getFantasyEligiblePositions,
  getFantasyBudgetForSlot,
  canAffordPlayerForSlot,
  isPlayerInSquad,
} from "@/lib/game/fantasy-mode";
import { formatValue } from "@/lib/players";
import { formatPlayerDisplayName } from "@/lib/players/prime-year";
import { filterShowcasePlayers, getUniqueClubs } from "@/lib/players/showcase";
import type { Player, SquadSlot } from "@/lib/types";
import { PlayerCard } from "./PlayerCard";
import { playPlayerSelect, playUiClick } from "@/lib/sound";
import { BTN, CARD, FILTER, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

const POOL = getFantasyEligiblePlayers();
const CLUBS = getUniqueClubs(POOL);

type FantasySortKey =
  | "rating-desc"
  | "rating-asc"
  | "value-desc"
  | "value-asc";

interface FantasyPlayerPickerProps {
  slot: SquadSlot;
  squad: SquadSlot[];
  onSelect: (player: Player) => void;
  onRemove?: () => void;
  onClose: () => void;
}

export function FantasyPlayerPicker({
  slot,
  squad,
  onSelect,
  onRemove,
  onClose,
}: FantasyPlayerPickerProps) {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDeferredValue(searchInput);
  const [club, setClub] = useState("all");
  const [sortKey, setSortKey] = useState<FantasySortKey>("rating-desc");
  const [affordableOnly, setAffordableOnly] = useState(false);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);

  const slotPositions = getFantasyEligiblePositions(slot.position);
  const slotBudget = getFantasyBudgetForSlot(squad, slot);
  const changingPlayer = !!slot.player;

  const players = useMemo(() => {
    const filters = {
      search: debouncedSearch,
      status: "all" as const,
      position: "all" as const,
      club,
      ratingMin: "all" as const,
      tier: "all" as const,
      yearsActive: "",
      browseMode: "all" as const,
      teamYearTeam: "all",
      teamYearYear: "",
    };

    let result = filterShowcasePlayers(POOL, filters).filter((p) =>
      slotPositions.includes(p.position)
    );

    if (affordableOnly) {
      result = result.filter((p) => canAffordPlayerForSlot(squad, slot, p));
    }

    return [...result].sort((a, b) => {
      switch (sortKey) {
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
  }, [debouncedSearch, club, slotPositions, sortKey, affordableOnly, squad, slot]);

  const handleSelect = useCallback(
    (player: Player) => {
      playPlayerSelect();
      onSelect(player);
    },
    [onSelect]
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm">
      <div className="flex shrink-0 items-center justify-between border-b border-pitch-700/60 px-3 py-2 sm:px-4 sm:py-3">
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

      <div className="shrink-0 px-3 py-2 sm:px-4 sm:py-3">
        {changingPlayer && onRemove && (
          <div className="mb-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                playUiClick();
                onRemove();
              }}
              className={`${BTN.base} ${BTN.secondary} min-h-[36px] px-3 py-1.5 text-xs`}
            >
              Remove Player
            </button>
          </div>
        )}

        <div className={`${CARD.base} overflow-hidden`}>
          <div className="border-b border-pitch-700/50 px-3 py-2.5 sm:px-4">
            <p className={`${TYPO.statLabel} mb-1.5`}>Search</p>
            <input
              type="search"
              placeholder="Player name"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className={`${FILTER.input} py-2 text-xs sm:text-sm`}
            />
          </div>

          <div className="border-b border-pitch-700/50 px-3 py-2.5 sm:px-4">
            <p className={`${TYPO.statLabel} mb-2`}>Filters</p>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <FilterSelect
                value={club}
                onChange={(v) => {
                  playUiClick();
                  setClub(v);
                }}
                options={[
                  { value: "all", label: "All teams" },
                  ...CLUBS.map((c) => ({ value: c, label: c })),
                ]}
              />
              <button
                type="button"
                aria-pressed={affordableOnly}
                onClick={() => {
                  playUiClick();
                  setAffordableOnly((v) => !v);
                }}
                className={`min-h-[32px] rounded-lg border px-2.5 py-1 text-[11px] font-medium transition sm:px-3 sm:text-xs ${
                  affordableOnly ? FILTER.chipActive : FILTER.chipIdle
                }`}
              >
                Affordable Only
              </button>
            </div>
          </div>

          <div className="px-3 py-2.5 sm:px-4">
            <p className={`${TYPO.statLabel} mb-2`}>Sort</p>
            <FilterSelect
              value={sortKey}
              onChange={(v) => {
                playUiClick();
                setSortKey(v as FantasySortKey);
              }}
              options={[
                { value: "rating-desc", label: "Highest Rating" },
                { value: "rating-asc", label: "Lowest Rating" },
                { value: "value-desc", label: "Highest Value" },
                { value: "value-asc", label: "Lowest Value" },
              ]}
            />
          </div>
        </div>

        <p className={`${TYPO.bodySm} mt-2`}>
          {players.length} eligible player{players.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto ${SPACING.pageX} py-3 sm:py-4`}>
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
                      className="flex w-full min-w-0 items-center justify-between gap-2 px-3 py-2.5 text-left"
                      onClick={() => {
                        playUiClick();
                        setExpandedPlayerId((id) =>
                          id === player.id ? null : player.id
                        );
                      }}
                    >
                      <span className="min-w-0 truncate font-display text-sm font-bold text-white">
                        {displayName}
                        <span className="ml-2 font-normal text-gray-400">
                          {player.peakRating} OVR · {formatValue(player.value)}
                        </span>
                      </span>
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
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
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${FILTER.input} max-w-full py-1.5 pl-2.5 pr-7 text-[11px] sm:min-w-0 sm:py-2 sm:pl-3 sm:text-xs`}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
