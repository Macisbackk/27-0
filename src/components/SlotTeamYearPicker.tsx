"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ClubLogoBox } from "@/components/ClubBadge";
import type { Player, SquadSlot } from "@/lib/types";
import { getAverageSquadRating } from "@/lib/squad-analysis";
import { getChemistryGain, getNewChemistryLinks } from "@/lib/game/chemistry";
import { getAgeAtYear, getPlayerAge } from "@/lib/players/player-age";
import { formatShortYear } from "@/lib/players/prime-year";
import { getClubColors } from "@/lib/clubs";
import type { SlotTeamYearPlayer } from "@/lib/game/slot-team-year-pick";
import type { SlotRevealTarget } from "@/lib/game/recruitment-slot-reveal";
import { playPlayerSelect, playUiClick } from "@/lib/sound";
import {
  formatPlayerChoiceMetadata,
  getPrimaryPlayerChoiceTags,
} from "@/lib/game/quick-mode-player-choice";
import { getClubKit } from "@/lib/club-kits";
import { ClubShirt } from "./ClubShirt";
import { GameButton } from "@/components/ui/GameButton";
import { TeamColourStrip } from "@/components/ui/TeamColourStrip";
import { EraRatingExplanation } from "./EraRatingExplanation";
import { CurrentRatingExplanation } from "./CurrentRatingExplanation";

interface SlotTeamYearPickerProps {
  target: SlotRevealTarget;
  entries: SlotTeamYearPlayer[];
  onSelect: (player: Player) => void;
  onBack?: () => void;
  onRespin?: () => boolean | void;
  respinsRemaining?: number;
  /** Retained for callers; count is shown only on the shared Respin button. */
  maxRespins?: number;
  disabled?: boolean;
  hardMode?: boolean;
  boosted?: boolean;
  eraMode?: boolean;
  /** Hide Current/Era “season’s form” rating note (e.g. Daily Challenge). */
  hideRatingNote?: boolean;
  /** The position being filled and the squad so far — for the header and team-rating preview. */
  slot?: SquadSlot | null;
  squad?: SquadSlot[];
}

function ageFor(player: Player, year: string): number | undefined {
  if (player.category === "current") return getPlayerAge(player);
  const y = Number.parseInt(year, 10);
  return Number.isFinite(y) ? getAgeAtYear(player, y) : undefined;
}

export function SlotTeamYearPicker({
  target,
  entries,
  onSelect,
  onBack,
  onRespin,
  respinsRemaining = 0,
  disabled,
  hardMode,
  boosted = false,
  eraMode = false,
  hideRatingNote = false,
  slot = null,
  squad,
}: SlotTeamYearPickerProps) {
  const [respinLocked, setRespinLocked] = useState(false);

  useEffect(() => {
    setRespinLocked(false);
  }, [entries]);

  const clubColors = useMemo(
    () => getClubColors(target.team),
    [target.team]
  );
  const shortYear = formatShortYear(target.year);

  const sortedEntries = useMemo(
    () =>
      [...entries].sort((a, b) => b.player.peakRating - a.player.peakRating),
    [entries]
  );

  // Chemistry gained by signing each option into this slot (adjacent club / era-year links).
  const chemistryFor = useMemo(() => {
    if (!slot || !squad || hardMode) {
      return () => ({ gain: 0, links: [] as ReturnType<typeof getNewChemistryLinks> });
    }
    return (player: Player) => ({
      gain: getChemistryGain(squad, slot.slotIndex, player),
      links: getNewChemistryLinks(squad, slot.slotIndex, player),
    });
  }, [slot, squad, hardMode]);

  // "Top" = best rating plus chemistry gain, not the raw OVR.
  const topScore = useMemo(
    () =>
      sortedEntries.reduce(
        (best, { player }) =>
          Math.max(best, player.peakRating + chemistryFor(player).gain),
        -Infinity
      ),
    [sortedEntries, chemistryFor]
  );

  // Team rating if you sign each player (only once someone is already in the side).
  const impactFor = useMemo(() => {
    if (!slot || !squad || hardMode) return () => null;
    const filled = squad.filter((s) => s.player).length;
    if (filled === 0) return () => null;
    const before = getAverageSquadRating(squad);
    return (player: Player) => {
      const after = getAverageSquadRating(
        squad.map((s) => (s.slotIndex === slot.slotIndex ? { ...s, player } : s))
      );
      return { after, delta: Math.round((after - before) * 10) / 10 };
    };
  }, [slot, squad, hardMode]);

  const canRespin =
    !!onRespin && !disabled && respinsRemaining > 0 && !respinLocked;
  const showRespin = !!onRespin && !hardMode;
  const respinLabel =
    respinsRemaining > 0
      ? `Respin (${respinsRemaining})`
      : "No respins";

  const handleRespin = () => {
    if (!canRespin || !onRespin) return;
    setRespinLocked(true);
    playUiClick();
    const ok = onRespin();
    // Failed boosted respins leave entries unchanged — unlock so the player is not stuck.
    if (ok === false) {
      setRespinLocked(false);
    }
  };

  return (
    <motion.div
      className="slot-picker w-full min-w-0"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      <div className="slot-picker__card overflow-hidden rounded-card bg-pitch-900">
        <TeamColourStrip club={target.team} />
        <header
          className="flex items-center gap-3 px-4 pb-3 pt-3.5"
          style={{
            background: `linear-gradient(180deg, ${clubColors.primary}1f 0%, transparent 85%)`,
          }}
        >
          <ClubLogoBox club={target.team} size="sm" showAbbrev={false} />
          <div className="min-w-0 flex-1 text-left">
            <p className="text-[13px] font-semibold text-theme-primary">
              {slot ? `Pick your ${slot.label}` : "Pick your signing"}
            </p>
            <h2 className="truncate font-display text-xl font-bold leading-tight text-white">
              {target.team} <span className="text-theme-primary">{shortYear}</span>
            </h2>
          </div>
          <span className="shrink-0 rounded-full bg-pitch-950 px-2.5 py-1 text-xs font-bold text-[color:var(--fl-muted)]">
            {entries.length} {entries.length === 1 ? "option" : "options"}
          </span>
        </header>

        <div className="px-3 pb-3">
          {entries.length === 0 ? (
            <p className="py-10 text-center text-gray-500">
              No players available from this squad.
            </p>
          ) : (
            <>
              <ul className="fl-stagger flex flex-col gap-2" aria-label="Players you can sign">
                {sortedEntries.map(({ player }) => {
                  const chemistry = chemistryFor(player);
                  const isTopPick =
                    !hardMode &&
                    sortedEntries.length > 1 &&
                    Math.abs(player.peakRating + chemistry.gain - topScore) < 0.001;
                  const age = ageFor(player, target.year);
                  const meta = formatPlayerChoiceMetadata(player, { clubOverride: target.team, hardMode });
                  const tags = hardMode
                    ? []
                    : getPrimaryPlayerChoiceTags(player, { boosted, topPick: false, allowEasterEggTags: true });
                  const impact = impactFor(player);
                  const metaLine = [meta.positionLabel, meta.nationalityAbbrev, age !== undefined ? `Age ${age}` : null]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <li key={player.id}>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          playPlayerSelect();
                          onSelect(player);
                        }}
                        aria-label={`Sign ${player.name}${hardMode ? "" : `, rated ${player.peakRating}`}`}
                        className={`slot-picker__row fl-pressable group flex w-full items-center gap-3 rounded-tile bg-pitch-950 p-2.5 pr-3 text-left transition hover:bg-pitch-800 disabled:opacity-50 ${
                          isTopPick ? "slot-picker__row--top" : ""
                        }`}
                      >
                        <ClubShirt
                          kit={getClubKit(target.team)}
                          label={hardMode ? "?" : String(player.peakRating)}
                          size={50}
                          className="shrink-0 drop-shadow-[0_3px_6px_rgba(0,0,0,0.45)]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-[16px] font-bold leading-tight text-white">
                              {player.name}
                            </span>
                            {isTopPick ? (
                              <span className="shrink-0 rounded-full bg-theme-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-theme-primary">
                                Top
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 block truncate text-[13px] text-[color:var(--fl-muted)]">
                            {metaLine}
                          </span>
                          {impact || chemistry.gain > 0 || tags.length > 0 ? (
                            <span className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-[12px] font-semibold">
                              {impact ? (
                                <span className="tabular-nums text-gray-300">
                                  Team {impact.after.toFixed(1)}{" "}
                                  <span
                                    className={
                                      impact.delta > 0.05
                                        ? "text-theme-primary"
                                        : impact.delta < -0.05
                                          ? "text-red-400"
                                          : "text-[color:var(--fl-muted)]"
                                    }
                                  >
                                    {impact.delta > 0.05 ? "▲" : impact.delta < -0.05 ? "▼" : "•"}
                                    {Math.abs(impact.delta).toFixed(1)}
                                  </span>
                                </span>
                              ) : null}
                              {chemistry.gain > 0 ? (
                                <span
                                  className="rounded-full bg-lime-400/15 px-1.5 py-0.5 text-[11px] font-bold leading-none text-lime-300"
                                  title={chemistry.links
                                    .map((l) => (l.reason === "club" ? `Same club (${l.label})` : `Same era year (${l.label})`))
                                    .join(" · ")}
                                >
                                  +{chemistry.gain.toFixed(1)} link
                                </span>
                              ) : null}
                              {tags.map((tag) => (
                                <span
                                  key={tag.id}
                                  className={`quick-player-card__tag quick-player-card__tag--${tag.tone}`}
                                >
                                  {tag.label}
                                </span>
                              ))}
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 rounded-full bg-theme-primary px-3.5 py-2 text-sm font-bold text-[color:var(--theme-text-on-primary)]">
                          Sign
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {hideRatingNote ? null : (
                <div className="mt-2 px-1 text-center">
                  {eraMode ? <EraRatingExplanation compact /> : <CurrentRatingExplanation compact />}
                </div>
              )}

              <div className="mt-3 flex items-center gap-2">
                {onBack ? (
                  <GameButton variant="secondary" size="md" fullWidth onClick={onBack} disabled={disabled}>
                    Back
                  </GameButton>
                ) : null}
                {showRespin ? (
                  <GameButton
                    variant="secondary"
                    size="md"
                    fullWidth
                    disabled={!canRespin}
                    onClick={handleRespin}
                  >
                    {respinLabel}
                  </GameButton>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
