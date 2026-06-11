"use client";

import { useCallback, useDeferredValue, useMemo, useState } from "react";
import {
  getFantasyEligiblePlayers,
  getFantasyEligiblePositions,
  getFantasyBudgetForSlot,
  getFantasyValueScore,
  canAffordPlayerForSlot,
  isPlayerInSquad,
} from "@/lib/game/fantasy-mode";
import { formatValue } from "@/lib/players";
import {
  filterShowcasePlayers,
  getUniqueClubs,
  TIER_FILTER_LABELS,
  type TierFilter,
} from "@/lib/players/showcase";
import { POSITION_LABELS } from "@/lib/positions";
import type { Player, PlayerCategory, Position, SquadSlot } from "@/lib/types";
import { PlayerCard } from "./PlayerCard";
import { RL_FILTER_INPUT_CLASS } from "./cards/rl-card";
import { playPlayerSelect, playUiClick } from "@/lib/sound";
import { BTN, CARD } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

const POOL = getFantasyEligiblePlayers();
const CLUBS = getUniqueClubs(POOL);

type FantasySortKey = "rating" | "value" | "valueScore" | "name";

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
  const [status, setStatus] = useState<PlayerCategory | "all">("all");
  const [positionFilter, setPositionFilter] = useState<Position | "all">("all");
  const [club, setClub] = useState("all");
  const [tier, setTier] = useState<TierFilter>("all");
  const [sortKey, setSortKey] = useState<FantasySortKey>("rating");
  const [affordableOnly, setAffordableOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const slotPositions = getFantasyEligiblePositions(slot.position);
  const slotBudget = getFantasyBudgetForSlot(squad, slot);
  const changingPlayer = !!slot.player;

  const players = useMemo(() => {
    const filters = {
      search: debouncedSearch,
      status,
      position: positionFilter,
      club,
      ratingMin: "all" as const,
      tier,
      yearsActive: "",
    };

    let result = filterShowcasePlayers(POOL, filters).filter((p) =>
      slotPositions.includes(p.position)
    );

    if (affordableOnly) {
      result = result.filter((p) => canAffordPlayerForSlot(squad, slot, p));
    }

    return [...result].sort((a, b) => {
      switch (sortKey) {
        case "value":
          return b.value - a.value;
        case "valueScore":
          return getFantasyValueScore(b) - getFantasyValueScore(a);
        case "name":
          return a.name.localeCompare(b.name);
        default:
          return b.peakRating - a.peakRating;
      }
    });
  }, [
    debouncedSearch,
    status,
    positionFilter,
    club,
    tier,
    slotPositions,
    sortKey,
    affordableOnly,
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm">
      <div className="flex shrink-0 items-center justify-between border-b border-pitch-700/60 px-3 py-2 sm:px-4 sm:py-3">
        <div className="min-w-0">
          <p className={TYPO.sectionLabel}>Select player</p>
          <h2 className="truncate font-display text-base font-bold text-white sm:text-lg">
            {slot.label}
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Slot budget: {formatValue(slotBudget)}
            {changingPlayer && slot.player && (
              <> · Current: {formatValue(slot.player.value)}</>
            )}
          </p>
        </div>
        <button type="button" onClick={onClose} className={BTN.close}>
          Close
        </button>
      </div>

      <div className="shrink-0 space-y-2 border-b border-pitch-700/40 px-3 py-2 sm:px-4 sm:py-3">
        {changingPlayer && onRemove && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                playUiClick();
                onRemove();
              }}
              className={`${BTN.base} ${BTN.secondary} text-xs`}
            >
              Remove Player
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Search…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={`${RL_FILTER_INPUT_CLASS} min-w-0 flex-1 py-1 text-xs sm:max-w-xs sm:text-sm`}
          />
          <FilterSelect
            value={positionFilter}
            onChange={(v) => {
              playUiClick();
              setPositionFilter(v as Position | "all");
            }}
            options={[
              { value: "all", label: "All positions" },
              ...slotPositions.map((p) => ({
                value: p,
                label: POSITION_LABELS[p],
              })),
            ]}
          />
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-pitch-700/50 bg-pitch-950/60 px-2 py-1 text-xs text-gray-300">
            <input
              type="checkbox"
              checked={affordableOnly}
              onChange={(e) => {
                playUiClick();
                setAffordableOnly(e.target.checked);
              }}
              className="rounded border-pitch-600"
            />
            Affordable only
          </label>
          <button
            type="button"
            onClick={() => {
              playUiClick();
              setShowFilters((v) => !v);
            }}
            className={`${BTN.base} ${showFilters ? BTN.primary : BTN.secondary} px-2 py-1 text-xs`}
          >
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2 pt-1">
            <FilterSelect
              value={club}
              onChange={(v) => {
                playUiClick();
                setClub(v);
              }}
              options={[
                { value: "all", label: "All clubs" },
                ...CLUBS.map((c) => ({ value: c, label: c })),
              ]}
            />
            <FilterSelect
              value={status}
              onChange={(v) => {
                playUiClick();
                setStatus(v as PlayerCategory | "all");
              }}
              options={[
                { value: "all", label: "All" },
                { value: "current", label: "Current" },
                { value: "historic", label: "Historic" },
                { value: "legend", label: "Legend" },
              ]}
            />
            <FilterSelect
              value={tier}
              onChange={(v) => {
                playUiClick();
                setTier(v as TierFilter);
              }}
              options={[
                { value: "all", label: "All tiers" },
                ...(Object.entries(TIER_FILTER_LABELS) as [TierFilter, string][]).map(
                  ([value, label]) => ({ value, label })
                ),
              ]}
            />
            <FilterSelect
              value={sortKey}
              onChange={(v) => {
                playUiClick();
                setSortKey(v as FantasySortKey);
              }}
              options={[
                { value: "rating", label: "Sort: Rating" },
                { value: "value", label: "Sort: Value" },
                { value: "valueScore", label: "Sort: Best value" },
                { value: "name", label: "Sort: Name" },
              ]}
            />
          </div>
        )}

        <p className="text-xs text-gray-500">
          {players.length} eligible · Budget {formatValue(slotBudget)} remaining
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
        {players.length === 0 ? (
          <p className="py-12 text-center text-gray-500">
            No players match your filters.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
            {players.map((player) => {
              const signed = isPlayerInSquad(squad, player.id);
              const affordable = canAffordPlayerForSlot(squad, slot, player);
              const disabled =
                (signed && player.id !== slot.player?.id) || !affordable;

              return (
                <li key={player.id}>
                  <div
                    className={`${CARD.base} flex h-full flex-col overflow-hidden ${
                      disabled
                        ? "pointer-events-none border-red-900/40 opacity-50"
                        : ""
                    } ${!affordable && !signed ? "border-red-900/30" : ""}`}
                  >
                    <PlayerCard player={player} equalHeight compactMobile />
                    <div className="border-t border-pitch-700/50 px-3 py-2">
                      {!affordable && !signed && (
                        <p className="text-xs font-medium text-red-400">
                          Over budget ({formatValue(player.value)})
                        </p>
                      )}
                      {signed && player.id !== slot.player?.id && (
                        <p className="text-xs text-gray-500">Already signed</p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => handleSelect(player)}
                      className={`mx-3 mb-3 mt-auto ${BTN.base} ${BTN.primary} disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {slot.player?.id === player.id
                        ? "Keep"
                        : changingPlayer
                          ? "Change Player"
                          : "Sign"}
                    </button>
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
      className={`${RL_FILTER_INPUT_CLASS} min-w-[6rem] py-1 text-xs`}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
