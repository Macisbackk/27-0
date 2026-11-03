"use client";

/**
 * Player card sheet body (v1.69, redesigned v1.72): about (flavour, your bond, favourite star),
 * key facts, your history with him, career honours and his cards. Rendered inside
 * PlayerDetailModal (Showcase + Squad Book). Read-only apart from the favourite star; never shown
 * inside a live draft.
 */

import { useEffect, useMemo, useState } from "react";
import type { Player } from "@/lib/types";
import { getRecruitablePlayers, isHiddenPlayer } from "@/lib/players";
import { getAllStats } from "@/lib/storage/stats";
import { setFavourite, useSquadBook, type SquadBookSource } from "@/lib/squad-book";
import { RARITY_COLOUR, RARITY_LABEL } from "@/lib/card-rarity";
import {
  buildPlayerProfile,
  combineHistoryBuckets,
  indexProfilePool,
  type PlayerHistoryMaps,
  type PlayerProfile,
  type ProfilePoolIndex,
  type ProfileSeasonCard,
} from "@/lib/player-profile";
import { CARD } from "@/lib/ui/design-system";

const SOURCE_LABEL: Record<SquadBookSource, string> = { classic: "Classic", era: "Era", daily: "Daily", weekly: "Weekly" };
/** Cards shown before "Show all". */
const CARDS_COLLAPSED = 4;

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

const HEADING = "mb-2 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--fl-muted)] sm:text-left";
const MUTED = "text-[color:var(--fl-muted)]";

function Section({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }) {
  return (
    <section className="min-w-0" data-testid={testId}>
      <h3 className={HEADING}>{title}</h3>
      {children}
    </section>
  );
}

/** Compact stat grid: label over value, centred, no boxes (one inset panel holds the grid). */
function StatGrid({ items, cols }: { items: { label: string; value: string }[]; cols: 2 | 3 | 4 }) {
  const grid = cols === 4 ? "grid-cols-2 sm:grid-cols-4" : cols === 3 ? "grid-cols-3" : "grid-cols-2";
  return (
    <dl className={`${CARD.inset} grid ${grid} gap-x-2 gap-y-3 px-3 py-3`}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0 text-center">
          <dt className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${MUTED}`}>{it.label}</dt>
          <dd className="mt-0.5 break-words font-display text-lg font-bold leading-tight tabular-nums text-white">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PlayerProfileSections({
  player,
  activeCardId,
  onSelectCard,
  facts = [],
}: {
  player: Player;
  /** The card the sheet is showing (highlighted in the card list). */
  activeCardId?: string;
  /** Tap a card row to show that card. */
  onSelectCard?: (id: string) => void;
  /** Card facts from the sheet (age, years active), shown first in the key-facts grid. */
  facts?: { label: string; value: string }[];
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
  const games = y.wins + y.losses;
  const activeId = activeCardId ?? player.id;
  const h = profile.honours;

  const keyFacts = [
    ...facts.filter((f) => f.value && f.value.trim()),
    ...(profile.career.appearances ? [{ label: "Apps", value: String(profile.career.appearances) }] : []),
    ...(profile.career.tries ? [{ label: "Tries", value: String(profile.career.tries) }] : []),
    ...(profile.career.intlCaps ? [{ label: "Intl caps", value: String(profile.career.intlCaps) }] : []),
    ...(profile.peak && profile.cards.length > 1 ? [{ label: "Peak", value: `${profile.peak.rating}${profile.peak.year !== null ? ` ('${String(profile.peak.year).slice(-2)})` : ""}` }] : []),
  ];

  const honourRows: { label: string; detail?: string }[] = [
    ...(h.hallOfFame ? [{ label: "Rugby League Hall of Fame" }] : []),
    ...(h.manOfSteel.length ? [{ label: "Man of Steel", detail: h.manOfSteel.join(", ") }] : []),
    ...(h.lanceTodd ? [{ label: "Lance Todd Trophy" }] : []),
    ...(h.superLeagueChampion.length ? [{ label: "Super League Champion", detail: h.superLeagueChampion.join(", ") }] : []),
    ...(h.challengeCup.length ? [{ label: "Challenge Cup", detail: h.challengeCup.join(", ") }] : []),
    ...(h.leagueLeaders.length ? [{ label: "League Leaders", detail: h.leagueLeaders.join(", ") }] : []),
    ...(h.dreamTeam.length ? [{ label: "Dream Team", detail: h.dreamTeam.join(", ") }] : []),
    ...(h.goldenBoot.length ? [{ label: "Golden Boot", detail: h.goldenBoot.join(", ") }] : []),
  ];

  // Collapsed: the active card plus the most recent others, in year order.
  const visibleCards = useMemo<ProfileSeasonCard[]>(() => {
    if (showAll || profile.cards.length <= CARDS_COLLAPSED + 1) return profile.cards;
    const keep = new Set<string>([activeId]);
    for (let i = profile.cards.length - 1; i >= 0 && keep.size < CARDS_COLLAPSED; i -= 1) keep.add(profile.cards[i].id);
    return profile.cards.filter((c) => keep.has(c.id));
  }, [profile.cards, showAll, activeId]);
  const hidden = profile.cards.length - visibleCards.length;

  const collectionLine = profile.collected
    ? [
        y.firstCollectedAt ? `Collected ${formatDate(y.firstCollectedAt)}${y.firstCollectedSource ? ` in ${SOURCE_LABEL[y.firstCollectedSource]}` : ""}` : "Collected",
        `${y.collectedCards} of ${y.totalCards} card${y.totalCards === 1 ? "" : "s"}`,
      ].join(" · ")
    : "Not collected yet. Field him in a finished season to add him to your Squad Book.";

  return (
    <div className="mt-5 flex min-w-0 flex-col gap-6" data-testid="player-profile">
      {/* About */}
      <section className="min-w-0 text-center sm:text-left" data-testid="player-profile-personality" data-rarity={profile.rarity}>
        {profile.flavour ? <p className="text-[15px] leading-relaxed text-white">{profile.flavour}</p> : null}
        {profile.collected && profile.bond ? <p className="mt-2 text-sm font-semibold text-theme-primary">{profile.bond}</p> : null}
        {profile.traits.length ? (
          <p className={`mt-2 text-xs font-semibold ${MUTED}`} aria-label="Traits">
            {profile.traits.map((t) => t.label).join(" · ")}
          </p>
        ) : null}
        <div className="mt-3 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <p className={`text-xs ${MUTED}`}>{collectionLine}</p>
          {profile.collected ? (
            <button
              type="button"
              aria-pressed={y.favourite}
              onClick={() => setFavourite(profile.cardIds.includes(activeId) ? [activeId, ...profile.cardIds] : profile.cardIds, !y.favourite)}
              className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold ${
                y.favourite ? "bg-amber-400/15 text-amber-300" : "bg-pitch-800 text-white"
              }`}
            >
              <span aria-hidden>{y.favourite ? "★" : "☆"}</span>
              {y.favourite ? "Favourite" : "Make favourite"}
            </button>
          ) : null}
        </div>
      </section>

      {keyFacts.length ? (
        <Section title="Key facts">
          <StatGrid items={keyFacts} cols={3} />
        </Section>
      ) : null}

      <Section title="With you" testId="player-profile-history">
        {y.seasons > 0 || y.timesFielded > 0 ? (
          <>
            <StatGrid
              cols={4}
              items={[
                { label: "Seasons", value: String(Math.max(y.seasons, y.timesFielded)) },
                { label: "Record", value: games ? `${y.wins}-${y.losses}` : "—" },
                { label: "27-0s", value: String(y.perfectSeasons) },
                { label: "Tries", value: String(y.tries) },
              ]}
            />
            <p className={`mt-1.5 text-center text-[11px] ${MUTED} sm:text-left`}>
              {games ? `${Math.round((y.wins / games) * 100)}% wins. ` : ""}Classic, Era, Ball Knower and Draft seasons; 27-0s and tries from v1.68.
            </p>
          </>
        ) : (
          <p className={`text-center text-sm ${MUTED} sm:text-left`}>You haven&apos;t finished a season with him yet.</p>
        )}
      </Section>

      {honourRows.length ? (
        <Section title="Honours" testId="player-profile-honours">
          <dl className={`${CARD.inset} divide-y divide-[color:var(--mobile-divider,rgba(255,255,255,0.08))] px-3`}>
            {honourRows.map((row) => (
              <div key={row.label} className="flex min-w-0 flex-col items-center gap-0.5 py-2.5 text-center sm:flex-row sm:items-baseline sm:justify-between sm:gap-4 sm:text-left">
                <dt className="text-sm font-semibold text-white">{row.label}</dt>
                {row.detail ? <dd className={`min-w-0 break-words text-xs tabular-nums ${MUTED} sm:text-right`}>{row.detail}</dd> : null}
              </div>
            ))}
          </dl>
        </Section>
      ) : null}

      <Section title={profile.cards.length === 1 ? "His card" : `His cards (${profile.cards.length})`} testId="player-profile-seasons">
        <ol className={`${CARD.inset} divide-y divide-[color:var(--mobile-divider,rgba(255,255,255,0.08))] overflow-hidden px-0`}>
          {visibleCards.map((c) => {
            const active = c.id === activeId;
            const sub = [
              c.positionLabel,
              ...c.honours,
              c.collected ? `✓ ${c.timesFielded > 1 ? `×${c.timesFielded}` : "collected"}` : "locked",
            ].join(" · ");
            const body = (
              <>
                <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: RARITY_COLOUR[c.rarity] }} title={RARITY_LABEL[c.rarity]} aria-hidden />
                <span className="w-10 shrink-0 font-display text-sm font-bold tabular-nums text-white">{c.year ?? "—"}</span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block break-words text-sm font-semibold leading-snug text-white">{c.club}</span>
                  <span className={`block break-words text-[11px] leading-snug ${c.collected ? MUTED : `${MUTED} opacity-70`}`}>{sub}</span>
                </span>
                <span className="shrink-0 font-display text-base font-bold tabular-nums text-white">{c.rating}</span>
              </>
            );
            const cls = `flex min-h-[48px] w-full min-w-0 items-center gap-2.5 px-3 py-2 ${active ? "bg-white/[0.06]" : ""}`;
            return (
              <li key={c.id}>
                {onSelectCard && !active ? (
                  <button type="button" className={cls} onClick={() => onSelectCard(c.id)} aria-label={`Show ${c.year ?? ""} ${c.club} card (${RARITY_LABEL[c.rarity]})`}>
                    {body}
                  </button>
                ) : (
                  <div className={cls} aria-current={active ? "true" : undefined}>
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        {hidden > 0 || (showAll && profile.cards.length > CARDS_COLLAPSED + 1) ? (
          <div className="mt-2 flex justify-center">
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="min-h-[40px] rounded-full bg-pitch-800 px-4 text-xs font-semibold text-white"
              aria-expanded={showAll}
            >
              {showAll ? "Show fewer" : `Show all ${profile.cards.length}`}
            </button>
          </div>
        ) : null}
      </Section>

      <p className={`text-center text-[11px] ${MUTED} sm:text-left`}>Facts and honours from the game&apos;s player and honours data.</p>
    </div>
  );
}
