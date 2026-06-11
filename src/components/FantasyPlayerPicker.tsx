"use client";

import { useCallback, useDeferredValue, useMemo, useState } from "react";
import {
  getFantasyEligiblePlayers,
  getFantasyValueScore,
  canAffordPlayer,
  isPlayerInSquad,
} from "@/lib/game/fantasy-mode";
import { getDraftCandidatePositions } from "@/lib/game/draft-positions";
import { getPlacementPenalty } from "@/lib/game/position-placement";
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
import { AchievementChipList } from "./cards/AchievementChipList";
import { getPlayerAchievements } from "@/lib/players";

const POOL = getFantasyEligiblePlayers();
const CLUBS = getUniqueClubs(POOL);

type FantasySortKey = "rating" | "value" | "valueScore" | "name";

interface FantasyPlayerPickerProps {
  slot: SquadSlot;
  squad: SquadSlot[];
  onSelect: (player: Player) => void;
  onClose: () => void;
}

export function FantasyPlayerPicker({
  slot,
  squad,
  onSelect,
  onClose,
}: FantasyPlayerPickerProps) {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDeferredValue(searchInput);
  const [status, setStatus] = useState<PlayerCategory | "all">("all");
  const [positionFilter, setPositionFilter] = useState<Position | "all">("all");
  const [club, setClub] = useState("all");
  const [tier, setTier] = useState<TierFilter>("all");
  const [sortKey, setSortKey] = useState<FantasySortKey>("rating");

  const slotPositions = getDraftCandidatePositions(slot.position);

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
  }, [debouncedSearch, status, positionFilter, club, tier, slotPositions, sortKey]);

  const handleSelect = useCallback(
    (player: Player) => {
      playPlayerSelect();
      onSelect(player);
    },
    [onSelect]
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm">
      <div className="flex shrink-0 items-center justify-between border-b border-pitch-700/60 px-4 py-3">
        <div>
          <p className={TYPO.sectionLabel}>Select player</p>
          <h2 className="font-display text-lg font-bold text-white">
            {slot.label}
          </h2>
        </div>
        <button type="button" onClick={onClose} className={BTN.close}>
          Close
        </button>
      </div>

      <div className="shrink-0 space-y-3 border-b border-pitch-700/40 px-4 py-3">
        <input
          type="search"
          placeholder="Search by name…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className={RL_FILTER_INPUT_CLASS}
        />
        <div className="flex flex-wrap gap-2">
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
              { value: "rating", label: "Rating" },
              { value: "value", label: "Value" },
              { value: "valueScore", label: "Best value" },
              { value: "name", label: "Name" },
            ]}
          />
        </div>
        <p className="text-xs text-gray-500">
          {players.length} eligible · Out of position costs −5 OVR
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {players.length === 0 ? (
          <p className="py-12 text-center text-gray-500">
            No players match your filters within budget.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {players.map((player) => {
              const signed = isPlayerInSquad(squad, player.id);
              const affordable =
                canAffordPlayer(squad, player) ||
                slot.player?.id === player.id;
              const penalty = getPlacementPenalty(
                player.position,
                slot.position
              );
              const disabled = signed || !affordable;

              return (
                <li key={player.id}>
                  <div
                    className={`${CARD.base} flex h-full flex-col overflow-hidden ${
                      disabled ? "opacity-50" : ""
                    }`}
                  >
                    <PlayerCard player={player} equalHeight compactMobile />
                    <div className="border-t border-pitch-700/50 px-3 py-2">
                      <AchievementChipList
                        achievements={getPlayerAchievements(player)}
                        compactMobile
                      />
                      {penalty > 0 && (
                        <p className="mt-1 text-xs text-amber-400/90">
                          −{penalty} OVR out of position
                        </p>
                      )}
                      {!affordable && !signed && (
                        <p className="mt-1 text-xs text-red-400">
                          Over budget ({formatValue(player.value)})
                        </p>
                      )}
                      {signed && player.id !== slot.player?.id && (
                        <p className="mt-1 text-xs text-gray-500">
                          Already signed
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => handleSelect(player)}
                      className={`mx-3 mb-3 mt-auto ${BTN.base} ${BTN.primary} disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {slot.player?.id === player.id ? "Keep" : "Sign"}
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
      className={`${RL_FILTER_INPUT_CLASS} min-w-[7rem] py-1.5 text-xs`}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
