"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ClubLogoBox } from "@/components/ClubBadge";
import type { Player, SquadSlot } from "@/lib/types";
import { getAverageSquadRating } from "@/lib/squad-analysis";
import {
  CHEMISTRY_PAIRS,
  getChemistryGain,
  getChoiceScore,
  getNewChemistryLinks,
} from "@/lib/game/chemistry";
import { formatSpinReelTeamName } from "@/lib/clubs/spin-reel-team-name";
import { formatPlayerPositionLabel } from "@/lib/players/player-positions";
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
  /** False in Era, where chemistry has no effect (v1.40): no link tags, "Top" is rating only. */
  showChemistry?: boolean;
  /**
   * Classic club choice: each entry carries its own club (`entry.target`), so the header names
   * the position, not a club, and every row shows its club.
   */
  clubChoice?: boolean;
  /** Hide Current/Era “season’s form” rating note (e.g. Daily Challenge). */
  hideRatingNote?: boolean;
  /** The position being filled and the squad so far — for the header and team-rating preview. */
  slot?: SquadSlot | null;
  squad?: SquadSlot[];
  /**
   * One option and no way to respin (spent, "No respins" rule, Ball Knower): sign it after a
   * short "Only option" note instead of asking for a pointless choice.
   */
  autoSignSingle?: boolean;
}

const AUTO_SIGN_SINGLE_MS = 1200;

function surname(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
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
  showChemistry = true,
  clubChoice = false,
  hideRatingNote = false,
  slot = null,
  squad,
  autoSignSingle = false,
}: SlotTeamYearPickerProps) {
  const [respinLocked, setRespinLocked] = useState(false);
  const onlyOption = entries.length === 1 ? entries[0].player : null;
  const willAutoSign = Boolean(onlyOption) && autoSignSingle;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onlyOptionRef = useRef(onlyOption);
  onlyOptionRef.current = onlyOption;
  const onlyOptionId = onlyOption?.id ?? null;

  useEffect(() => {
    if (!willAutoSign || !onlyOptionId || disabled) return;
    const t = window.setTimeout(() => {
      const player = onlyOptionRef.current;
      if (player && player.id === onlyOptionId) onSelectRef.current(player);
    }, AUTO_SIGN_SINGLE_MS);
    return () => window.clearTimeout(t);
  }, [willAutoSign, onlyOptionId, disabled]);

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
    if (!slot || !squad || hardMode || !showChemistry) {
      return () => ({ gain: 0, links: [] as ReturnType<typeof getNewChemistryLinks>, partners: [] as string[] });
    }
    return (player: Player) => {
      const links = getNewChemistryLinks(squad, slot.slotIndex, player);
      const partners = links
        .map((l) => squad.find((s) => s.slotIndex === (l.slotA === slot.slotIndex ? l.slotB : l.slotA))?.player?.name)
        .filter((n): n is string => Boolean(n))
        .map(surname);
      return {
        gain: getChemistryGain(squad, slot.slotIndex, player),
        links,
        partners,
      };
    };
  }, [slot, squad, hardMode, showChemistry]);

  // "Top" = best rating plus what its chemistry is worth (a link ≈ 2 rating points), not raw OVR.
  const topScore = useMemo(
    () =>
      sortedEntries.reduce(
        (best, { player }) =>
          Math.max(best, getChoiceScore(player.peakRating, chemistryFor(player).gain)),
        -Infinity
      ),
    [sortedEntries, chemistryFor]
  );

  // One short centred line on chemistry for club choice (only where this slot can link).
  const chemistryHint = useMemo(() => {
    if (!clubChoice || !showChemistry || hardMode || !slot) return null;
    const linkable = CHEMISTRY_PAIRS.some(([a, b]) => a === slot.slotIndex || b === slot.slotIndex);
    if (!linkable) return null;
    return sortedEntries.some(({ player }) => chemistryFor(player).gain > 0)
      ? "Green tag = club link (chemistry)."
      : "Same club side by side = chemistry.";
  }, [clubChoice, showChemistry, hardMode, slot, sortedEntries, chemistryFor]);
  const clubCount = new Set(entries.map((e) => (e.target ?? target).team)).size;

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
        {clubChoice ? (
          <header className="px-4 pb-2 pt-3 text-center">
            <h2 className="font-display text-xl font-bold leading-tight text-white">
              {slot ? `Pick your ${slot.label}` : "Pick your signing"}
            </h2>
            <p className="mt-0.5 text-xs font-semibold text-[color:var(--fl-muted)]">
              {onlyOption
                ? `Only option${slot ? ` for ${slot.label}` : ""}`
                : `${clubCount} clubs, pick one`}
              {" · spin locked in"}
            </p>
            {chemistryHint ? (
              <p className="mt-1 text-[13px] font-semibold text-lime-300">{chemistryHint}</p>
            ) : null}
          </header>
        ) : (
        <>
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
            <h2 className="line-clamp-2 break-words font-display text-xl font-bold leading-tight text-white">
              {target.team} <span className="whitespace-nowrap text-theme-primary">{shortYear}</span>
            </h2>
            <p className="mt-0.5 text-xs font-semibold text-[color:var(--fl-muted)]">
              {onlyOption
                ? `Only option${slot ? ` for ${slot.label}` : ""}`
                : `${entries.length} options`}
              {" · spin locked in"}
            </p>
          </div>
        </header>
        </>
        )}

        <div className="px-3 pb-3">
          {entries.length === 0 ? (
            <p className="py-10 text-center text-gray-500">
              No players available from this squad.
            </p>
          ) : (
            <>
              {onlyOption ? (
                <p className="mb-2 rounded-tile bg-theme-primary/10 px-3 py-2 text-center text-[13px] font-semibold text-theme-primary" role="status">
                  {willAutoSign
                    ? `Only option — signing ${onlyOption.name}…`
                    : `Only one ${slot?.label ?? "player"} on offer — sign or respin.`}
                </p>
              ) : null}
              <ul className="fl-stagger flex flex-col gap-2" aria-label="Players you can sign">
                {sortedEntries.map(({ player, target: entryTarget }) => {
                  const club = (entryTarget ?? target).team;
                  const chemistry = chemistryFor(player);
                  const isTopPick =
                    !hardMode &&
                    sortedEntries.length > 1 &&
                    Math.abs(getChoiceScore(player.peakRating, chemistry.gain) - topScore) < 0.001;
                  const age = ageFor(player, (entryTarget ?? target).year);
                  const meta = formatPlayerChoiceMetadata(player, { clubOverride: club, hardMode });
                  const tags = hardMode
                    ? []
                    : getPrimaryPlayerChoiceTags(player, { boosted, topPick: false, allowEasterEggTags: true });
                  const impact = impactFor(player);
                  // No nation code: it pushed the age off a phone screen.
                  const metaLine = [
                    clubChoice ? formatSpinReelTeamName(club) : null,
                    // Club choice adds the club, so the short position keeps it to one line on a phone.
                    clubChoice ? formatPlayerPositionLabel(player, { short: true }) : meta.positionLabel,
                    age !== undefined ? `Age ${age}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <li key={player.id}>
                      <button
                        type="button"
                        data-club={club}
                        disabled={disabled}
                        onClick={() => {
                          playPlayerSelect();
                          onSelect(player);
                        }}
                        aria-label={`Sign ${player.name}${clubChoice ? ` from ${club}` : ""}${hardMode ? "" : `, rated ${player.peakRating}`}`}
                        className={`slot-picker__row fl-pressable group flex w-full items-center gap-3 rounded-tile bg-pitch-950 p-2.5 pr-3 text-left transition hover:bg-pitch-800 disabled:opacity-50 ${
                          isTopPick ? "slot-picker__row--top" : ""
                        }`}
                      >
                        <ClubShirt
                          kit={getClubKit(club)}
                          label={hardMode ? "?" : String(player.peakRating)}
                          size={50}
                          className="shrink-0 drop-shadow-[0_3px_6px_rgba(0,0,0,0.45)]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className="line-clamp-2 break-words text-[16px] font-bold leading-tight text-white">
                              {player.name}
                            </span>
                            {isTopPick ? (
                              <span className="shrink-0 rounded-full bg-theme-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-theme-primary">
                                Top
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 block break-words text-[13px] leading-snug text-[color:var(--fl-muted)]">
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
                                  className="inline-flex max-w-full items-center rounded-full bg-lime-400/15 px-1.5 py-0.5 text-[11px] font-bold leading-tight text-lime-300"
                                  title={chemistry.links
                                    .map((l) => (l.reason === "club" ? `Same club (${l.label})` : `Same era year (${l.label})`))
                                    .join(" · ")}
                                  aria-label={`Chemistry +${chemistry.gain.toFixed(1)}${chemistry.partners.length ? ` with ${chemistry.partners.join(" and ")}` : ""}`}
                                >
                                  +{chemistry.gain.toFixed(1)} link
                                  {chemistry.partners.length ? ` · ${chemistry.partners.join(", ")}` : ""}
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

              {/* Club choice: the rating note is under the pitch already; keeps 3 rows on a phone. */}
              {hideRatingNote || clubChoice ? null : (
                <div className="mt-2 px-1 text-center">
                  {eraMode ? <EraRatingExplanation compact /> : <CurrentRatingExplanation compact />}
                </div>
              )}

              <div className="mt-3 flex items-center gap-2">
                {onBack ? (
                  <GameButton variant="secondary" size="md" fullWidth onClick={onBack} disabled={disabled}>
                    Back to pitch
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
