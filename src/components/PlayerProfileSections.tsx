"use client";

/**
 * Expanded player card body (v1.68): personality, your history with him, every card season he has
 * and his career honours. Rendered inside PlayerDetailModal (Showcase + Squad Book). Read-only apart
 * from the favourite star; never shown inside a live draft.
 */

import { useEffect, useMemo, useState } from "react";
import type { Player } from "@/lib/types";
import { getRecruitablePlayers, isHiddenPlayer } from "@/lib/players";
import { getAllStats } from "@/lib/storage/stats";
import { setFavourite, useSquadBook, type SquadBookSource } from "@/lib/squad-book";
import { RARITY_COLOUR, RARITY_LABEL, type CardRarity } from "@/lib/card-rarity";
import {
  buildPlayerProfile,
  combineHistoryBuckets,
  indexProfilePool,
  type PlayerHistoryMaps,
  type PlayerProfile,
  type ProfilePoolIndex,
} from "@/lib/player-profile";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

const SOURCE_LABEL: Record<SquadBookSource, string> = { classic: "Classic", era: "Era", daily: "Daily", weekly: "Weekly" };
const SEASONS_SHOWN = 12;

let poolCache: { size: number; index: ProfilePoolIndex } | null = null;

/** Name index of the live card pool (rebuilt if the registry grows). */
export function getProfileIndex(): ProfilePoolIndex {
  const pool = getRecruitablePlayers();
  if (!poolCache || poolCache.size !== pool.length) {
    poolCache = { size: pool.length, index: indexProfilePool(pool.filter((p) => !isHiddenPlayer(p))) };
  }
  return poolCache.index;
}

function readHistory(): PlayerHistoryMaps {
  try {
    const s = getAllStats();
    // Same buckets as the Stats page (Fantasy is a separate game).
    return combineHistoryBuckets([s.normal, s.hard, s.eraNormal, s.draftNormal, s.draftHard]);
  } catch {
    return combineHistoryBuckets([]);
  }
}

function useHistory(): PlayerHistoryMaps | null {
  const [history, setHistory] = useState<PlayerHistoryMaps | null>(null);
  useEffect(() => {
    const read = () => setHistory(readHistory());
    read();
    window.addEventListener("stats-merged", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("stats-merged", read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return history;
}

const formatDate = (ms: number) => {
  try {
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(ms));
  } catch {
    return "";
  }
};

function RarityPill({ rarity }: { rarity: CardRarity }) {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-1.5 py-px text-[10px] font-bold uppercase tracking-wide"
      style={{ color: RARITY_COLOUR[rarity], background: `${RARITY_COLOUR[rarity]}22` }}
    >
      {RARITY_LABEL[rarity]}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className={`${TYPO.sectionTitle} mb-2 text-center sm:text-left`}>{children}</h3>;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={`min-w-0 text-center ${CARD.inset} ${SPACING.cardPaddingSm}`}>
      <p className={TYPO.statLabel}>{label}</p>
      <p className="mt-0.5 font-display text-xl font-bold tabular-nums text-white">{value}</p>
      {sub ? <p className="text-[11px] text-[color:var(--fl-muted)]">{sub}</p> : null}
    </div>
  );
}

export function PlayerProfileSections({
  player,
  activeCardId,
  onSelectCard,
}: {
  player: Player;
  /** The card the sheet is showing (highlighted in the season list). */
  activeCardId?: string;
  /** Tap a season row to show that card. */
  onSelectCard?: (id: string) => void;
}) {
  const book = useSquadBook();
  const history = useHistory();
  const [showAll, setShowAll] = useState(false);

  const profile: PlayerProfile = useMemo(
    () => buildPlayerProfile({ player, index: getProfileIndex(), book, history }),
    [player, book, history]
  );

  useEffect(() => setShowAll(false), [player.name]);

  const y = profile.yours;
  const colour = RARITY_COLOUR[profile.rarity];
  const games = y.wins + y.losses;
  const seasons = showAll ? profile.cards : profile.cards.slice(-SEASONS_SHOWN);
  const h = profile.honours;
  const honourRows: { label: string; detail?: string }[] = [
    ...(h.hallOfFame ? [{ label: "Rugby League Hall of Fame" }] : []),
    ...(h.manOfSteel.length ? [{ label: "Man of Steel", detail: h.manOfSteel.join(", ") }] : []),
    ...(h.lanceTodd ? [{ label: "Lance Todd Trophy" }] : []),
    ...(h.superLeagueChampion.length ? [{ label: "Super League Champion", detail: h.superLeagueChampion.join(", ") }] : []),
    ...(h.challengeCup.length ? [{ label: "Challenge Cup Winner", detail: h.challengeCup.join(", ") }] : []),
    ...(h.leagueLeaders.length ? [{ label: "League Leaders", detail: h.leagueLeaders.join(", ") }] : []),
    ...(h.dreamTeam.length ? [{ label: "Dream Team", detail: h.dreamTeam.join(", ") }] : []),
    ...(h.goldenBoot.length ? [{ label: "Golden Boot", detail: h.goldenBoot.join(", ") }] : []),
    ...(profile.career.intlCaps ? [{ label: "International caps", detail: String(profile.career.intlCaps) }] : []),
  ];
  const careerBits = [
    profile.career.appearances ? `${profile.career.appearances} appearances` : null,
    profile.career.tries ? `${profile.career.tries} tries` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="mt-4 flex min-w-0 flex-col gap-4" data-testid="player-profile">
      {/* Personality */}
      <section
        className={`relative min-w-0 rounded-tile border-2 p-3 text-center sm:text-left ${profile.collected ? "bg-pitch-900" : "border-dashed bg-pitch-950/40"}`}
        style={{
          borderColor: profile.collected ? colour : `${colour}66`,
          boxShadow: profile.collected && profile.rarity === "legendary" ? `0 0 12px ${colour}44` : undefined,
        }}
        data-rarity={profile.rarity}
        data-testid="player-profile-personality"
      >
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-between">
          <RarityPill rarity={profile.rarity} />
          {profile.collected ? (
            <button
              type="button"
              aria-pressed={y.favourite}
              onClick={() => setFavourite(activeCardId && profile.cardIds.includes(activeCardId) ? [activeCardId, ...profile.cardIds] : profile.cardIds, !y.favourite)}
              className={`inline-flex min-h-[40px] items-center gap-1 rounded-full px-3 text-xs font-semibold ${
                y.favourite ? "bg-amber-400/15 text-amber-300" : "bg-pitch-800 text-white"
              }`}
            >
              <span aria-hidden>{y.favourite ? "★" : "☆"}</span>
              {y.favourite ? "Favourite" : "Make favourite"}
            </button>
          ) : null}
        </div>
        {profile.flavour ? <p className="mt-2 text-sm leading-relaxed text-white">{profile.flavour}</p> : null}
        {profile.collected && profile.bond ? <p className="mt-1.5 text-sm font-semibold text-theme-primary">{profile.bond}</p> : null}
        {profile.traits.length ? (
          <ul className="mt-2 flex flex-wrap justify-center gap-1.5 sm:justify-start" aria-label="Traits">
            {profile.traits.map((t) => (
              <li key={t.id} className="rounded-full bg-pitch-800 px-2 py-0.5 text-[11px] font-semibold text-white">
                {t.label}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-2 text-xs text-[color:var(--fl-muted)]">
          {profile.collected
            ? y.firstCollectedAt
              ? `In your Squad Book since ${formatDate(y.firstCollectedAt)}${y.firstCollectedSource ? ` (${SOURCE_LABEL[y.firstCollectedSource]})` : ""} · ${y.collectedCards}/${y.totalCards} of his cards`
              : `${y.collectedCards}/${y.totalCards} of his cards in your Squad Book`
            : "Not in your Squad Book yet: field him in a finished season to collect him."}
        </p>
      </section>

      {/* Your history */}
      <section className="min-w-0" data-testid="player-profile-history">
        <SectionTitle>With you</SectionTitle>
        {y.seasons > 0 || y.timesFielded > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Seasons" value={String(Math.max(y.seasons, y.timesFielded))} sub="finished with you" />
              <Stat label="Record" value={games ? `${y.wins}-${y.losses}` : "—"} sub={games ? `${Math.round((y.wins / games) * 100)}% wins` : undefined} />
              <Stat label="27-0s" value={String(y.perfectSeasons)} />
              <Stat label="Tries" value={String(y.tries)} sub="regular season" />
            </div>
            <p className="mt-1.5 text-center text-[11px] text-[color:var(--fl-muted)] sm:text-left">
              Records come from Classic, Era, Ball Knower and Draft seasons. 27-0s and tries are counted from v1.68.
            </p>
          </>
        ) : (
          <p className={`text-center ${TYPO.bodySm} sm:text-left`}>You haven&apos;t finished a season with him yet.</p>
        )}
      </section>

      {/* Season records */}
      <section className="min-w-0" data-testid="player-profile-seasons">
        <SectionTitle>{profile.cards.length === 1 ? "His card" : `His ${profile.cards.length} cards`}</SectionTitle>
        {profile.peak ? (
          <p className={`mb-2 text-center ${TYPO.bodySm} sm:text-left`}>
            Peak rating <span className="font-semibold text-white">{profile.peak.rating}</span>
            {profile.peak.year !== null ? ` · ${profile.peak.year}` : ""} · {profile.peak.club}
            {profile.clubs.length > 1 ? ` · ${profile.clubs.length} clubs` : ""}
          </p>
        ) : null}
        {profile.cards.length > SEASONS_SHOWN && !showAll ? (
          <div className="mb-2 flex justify-center sm:justify-start">
            <button type="button" onClick={() => setShowAll(true)} className="min-h-[40px] rounded-full bg-pitch-800 px-3 text-xs font-semibold text-white">
              Show all {profile.cards.length}
            </button>
          </div>
        ) : null}
        <ol className="flex flex-col gap-1.5">
          {seasons.map((c) => {
            const active = c.id === (activeCardId ?? player.id);
            const body = (
              <>
                <span className="w-11 shrink-0 font-display text-sm font-bold tabular-nums text-white">{c.year ?? "—"}</span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-semibold text-white">{c.club}</span>
                  <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1">
                    <RarityPill rarity={c.rarity} />
                    <span className="text-[11px] text-[color:var(--fl-muted)]">{c.positionLabel}</span>
                    {c.honours.map((label) => (
                      <span key={label} className="rounded-full bg-amber-400/10 px-1.5 text-[10px] font-semibold text-amber-300">
                        {label}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-display text-base font-bold tabular-nums text-white">{c.rating}</span>
                  <span className={`block text-[10px] font-semibold ${c.collected ? "text-lime-300" : "text-[color:var(--fl-muted)]"}`}>
                    {c.collected ? `✓${c.timesFielded > 1 ? ` ×${c.timesFielded}` : ""}` : "locked"}
                  </span>
                </span>
              </>
            );
            const cls = `flex min-h-[44px] w-full min-w-0 items-center gap-2 rounded-tile border px-2.5 py-2 ${
              active ? "bg-pitch-800" : "bg-pitch-950/60"
            }`;
            const style = { borderColor: active ? RARITY_COLOUR[c.rarity] : "transparent" };
            return (
              <li key={c.id}>
                {onSelectCard && !active ? (
                  <button type="button" className={cls} style={style} onClick={() => onSelectCard(c.id)} aria-label={`Show ${c.year ?? ""} ${c.club} card`}>
                    {body}
                  </button>
                ) : (
                  <div className={cls} style={style} aria-current={active ? "true" : undefined}>
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {/* Career honours */}
      {honourRows.length || careerBits.length ? (
        <section className={`min-w-0 ${CARD.inset} ${SPACING.cardPaddingSm}`} data-testid="player-profile-honours">
          <SectionTitle>Career honours</SectionTitle>
          {honourRows.length ? (
            <dl className="flex flex-col gap-1.5 text-sm">
              {honourRows.map((row) => (
                <div key={row.label} className="flex min-w-0 flex-col items-center gap-0.5 sm:flex-row sm:justify-between sm:gap-3">
                  <dt className="font-semibold text-white">{row.label}</dt>
                  {row.detail ? <dd className="min-w-0 break-words text-center tabular-nums text-[color:var(--fl-muted)] sm:text-right">{row.detail}</dd> : null}
                </div>
              ))}
            </dl>
          ) : null}
          {careerBits.length ? (
            <p className={`mt-2 text-center ${TYPO.bodySm} sm:text-left`}>Career: {careerBits.join(" · ")}</p>
          ) : null}
          <p className="mt-1.5 text-center text-[11px] text-[color:var(--fl-muted)] sm:text-left">From the game&apos;s honours and player data.</p>
        </section>
      ) : null}
    </div>
  );
}
