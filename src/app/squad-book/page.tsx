"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { StandardPageShell } from "@/components/ui/StandardPageShell";
import { GameTabs } from "@/components/ui/GameTabs";
import { GameButton } from "@/components/ui/GameButton";
import { GameModal } from "@/components/ui/GameModal";
import { ClubLogoBox } from "@/components/ClubBadge";
import { PAGE, LINK } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { formatClubFunds } from "@/lib/club-funds";
import type { ClubFundsEarnedLine } from "@/lib/club-funds";
import { ensurePlayersLoaded, getPlayerById } from "@/lib/players";
import { PlayerDetailModal } from "@/components/PlayerDetailModal";
import { getProfileIndex } from "@/components/PlayerProfileSections";
import { findPlayerCards } from "@/lib/player-profile";
import {
  DREAM_TEAM_SLOTS,
  claimCollectionRewards,
  claimSquadBookMilestones,
  claimableCollectionRewards,
  clearDreamTeam,
  computeSquadBookProgress,
  decadeLabel,
  dreamTeamCandidates,
  getSquadBookCatalog,
  setDreamTeamSlot,
  syncCollectionCosmetics,
  useSquadBook,
  type CollectionClaimResult,
  type SquadBookCatalog,
  type SquadBookCatalogCard,
  type SquadBookMilestone,
  type SquadBookSource,
} from "@/lib/squad-book";
import { CARD_RARITIES, RARITY_COLOUR, RARITY_LABEL, rarityRank, type CardRarity } from "@/lib/card-rarity";
import { COLLECTION_MIN_POOL, collectionClubColours, collectionTitleFor } from "@/lib/collection-rewards";
import { cosmeticById } from "@/lib/cosmetics";
import { equipCosmetic, useCosmetics } from "@/lib/storage/cosmetics-store";
import { PitchHero } from "@/components/ui/PitchHero";
import { AlbumGlyph } from "@/components/icons/rugby-icons";

type Tab = "collections" | "clubs" | "cards" | "dream";
const TABS: { id: Tab; label: string; shortLabel?: string }[] = [
  { id: "collections", label: "Collections", shortLabel: "Book" },
  { id: "clubs", label: "Clubs" },
  { id: "cards", label: "Cards" },
  { id: "dream", label: "Dream Team", shortLabel: "Dream 13" },
];
type Status = "all" | "collected" | "missing" | "favourites";
const PAGE_SIZE = 60;

const SOURCE_LABEL: Record<SquadBookSource, string> = { classic: "Classic", era: "Era", daily: "Daily", weekly: "Weekly" };

const SELECT = "min-h-[44px] w-full min-w-0 rounded-xl border border-pitch-600/60 bg-pitch-900 px-3 text-sm text-white";

function Bar({ have, of, colour }: { have: number; of: number; colour?: string }) {
  const pct = of > 0 ? Math.min(100, Math.round((have / of) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-pitch-800" aria-hidden>
      <div className={`h-full rounded-full transition-[width] ${colour ? "" : "bg-theme-primary"}`} style={{ width: `${pct}%`, ...(colour ? { background: colour } : {}) }} />
    </div>
  );
}

function Section({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card bg-pitch-900 p-4 text-left">
      <h2 className="text-center text-[17px] font-bold text-white sm:text-left">{title}</h2>
      {intro ? <p className="mt-1 text-center text-sm text-[color:var(--fl-muted)] sm:text-left">{intro}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function RarityChip({ rarity, className = "" }: { rarity: CardRarity; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-px text-[10px] font-bold uppercase tracking-wide ${className}`}
      style={{ color: RARITY_COLOUR[rarity], background: `${RARITY_COLOUR[rarity]}22` }}
    >
      {RARITY_LABEL[rarity]}
    </span>
  );
}

/** One card tile: rarity-coloured edge when collected, a faint dashed one when not. */
function BookCard({
  card,
  collected,
  sub,
  onClick,
  favourite = false,
}: {
  card: SquadBookCatalogCard;
  collected: boolean;
  sub: string;
  onClick?: () => void;
  /** Starred from the player profile. */
  favourite?: boolean;
}) {
  const colour = RARITY_COLOUR[card.rarity];
  const body = (
    <>
      {collected ? (
        <ClubLogoBox club={card.club} size="xs" />
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pitch-800 text-[color:var(--fl-muted)]" aria-label="Not collected">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" />
          </svg>
        </span>
      )}
      <span className="min-w-0 flex-1 text-left">
        <span className={`block truncate text-sm font-semibold ${collected ? "text-white" : "text-[color:var(--fl-muted)]"}`}>
          {favourite ? (
            <span className="mr-1 text-amber-300" aria-label="Favourite">
              ★
            </span>
          ) : null}
          {card.name}
          {card.category !== "current" && card.year ? ` (${card.year})` : ""}
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
          <RarityChip rarity={card.rarity} className={collected ? "" : "opacity-60"} />
          <span className="truncate text-xs text-[color:var(--fl-muted)]">{sub}</span>
        </span>
      </span>
      {collected ? <span className="shrink-0 font-display text-base font-bold tabular-nums text-white">{card.rating}</span> : null}
    </>
  );
  const cls = `flex w-full min-w-0 items-center gap-2 rounded-tile border-2 p-2.5 ${collected ? "bg-pitch-900" : "border-dashed bg-pitch-950/40"}`;
  const style = collected
    ? { borderColor: colour, boxShadow: card.rarity === "legendary" ? `0 0 10px ${colour}55` : undefined }
    : { borderColor: `${colour}55` };
  return onClick ? (
    <button type="button" onClick={onClick} className={cls} style={style} data-rarity={card.rarity}>
      {body}
    </button>
  ) : (
    <div className={cls} style={style} data-rarity={card.rarity}>
      {body}
    </div>
  );
}

/** Reward chips for a group's milestones — ticked when paid. */
function MilestoneChips({ milestones, value, claimed }: { milestones: SquadBookMilestone[]; value: (m: SquadBookMilestone) => number; claimed: string[] }) {
  if (milestones.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {milestones.map((m) => {
        const done = claimed.includes(m.id) || value(m) >= m.target;
        return (
          <span
            key={m.id}
            title={m.label}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              done ? "bg-lime-300/15 text-lime-300" : "bg-pitch-800 text-[color:var(--fl-muted)]"
            }`}
          >
            {done ? (
              <>
                <span aria-hidden>✓ </span>
                <span className="sr-only">Done: </span>
              </>
            ) : null}
            {m.id.includes("-squad-") ? "Full squad" : m.kind === "set" ? "Complete" : m.target} · {formatClubFunds(m.reward)}
          </span>
        );
      })}
    </div>
  );
}

export default function SquadBookPage() {
  const book = useSquadBook();
  const cosmetics = useCosmetics();
  const [catalog, setCatalog] = useState<SquadBookCatalog | null>(null);
  const [tab, setTab] = useState<Tab>("collections");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [club, setClub] = useState("all");
  const [decade, setDecade] = useState("all");
  const [rarity, setRarity] = useState<"all" | CardRarity>("all");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [paid, setPaid] = useState<ClubFundsEarnedLine[]>([]);
  const [clubView, setClubView] = useState<string | null>(null);
  const [clubShown, setClubShown] = useState(PAGE_SIZE);
  const [celebration, setCelebration] = useState<CollectionClaimResult | null>(null);
  const [pickSlot, setPickSlot] = useState<number | null>(null);
  const [pickQuery, setPickQuery] = useState("");
  const [profileId, setProfileId] = useState<string | null>(null);
  const profilePlayer = profileId ? getPlayerById(profileId) ?? null : null;

  useEffect(() => {
    let live = true;
    void ensurePlayersLoaded()
      .catch(() => undefined)
      .then(() => {
        if (!live) return;
        setCatalog(getSquadBookCatalog());
        // Pays anything reached on another device / before an update (once per milestone).
        const lines = claimSquadBookMilestones();
        if (lines.length) setPaid(lines);
        // A club title claimed on another device is owned here too.
        syncCollectionCosmetics();
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => setShown(PAGE_SIZE), [query, status, club, decade, rarity]);
  useEffect(() => setClubShown(PAGE_SIZE), [clubView]);

  const progress = useMemo(() => (catalog ? computeSquadBookProgress(book, catalog) : null), [book, catalog]);
  const claimable = useMemo(() => (catalog ? claimableCollectionRewards(book, catalog) : []), [book, catalog]);

  // Clubs tab: default to the club with the most players collected (or the first).
  const activeClub = useMemo(() => {
    if (!catalog || !progress) return null;
    if (clubView && catalog.clubs.includes(clubView)) return clubView;
    let best = catalog.clubs[0] ?? null;
    let bestHave = -1;
    for (const c of catalog.clubs) {
      const have = progress.byClubPlayers.get(c)?.have ?? 0;
      if (have > bestHave) {
        best = c;
        bestHave = have;
      }
    }
    return best;
  }, [catalog, progress, clubView]);

  /** Starred players: every card of a starred player shows the star (favourites hold one card id). */
  const favouriteIds = useMemo(() => {
    const out = new Set<string>();
    if (!catalog || book.favourites.length === 0) return out;
    const index = getProfileIndex();
    for (const id of book.favourites) {
      out.add(id);
      const p = getPlayerById(id);
      if (p) for (const card of findPlayerCards(p, index)) out.add(card.id);
    }
    return out;
  }, [catalog, book]);

  const filtered = useMemo(() => {
    if (!catalog) return [];
    const q = query.trim().toLowerCase();
    return catalog.cards
      .filter((c) => {
        const have = Boolean(book.cards[c.id]);
        if (status === "collected" && !have) return false;
        if (status === "missing" && have) return false;
        if (status === "favourites" && !(have && favouriteIds.has(c.id))) return false;
        if (club !== "all" && c.club !== club) return false;
        if (decade !== "all" && String(c.decade) !== decade) return false;
        if (rarity !== "all" && c.rarity !== rarity) return false;
        if (q && !c.name.toLowerCase().includes(q) && !c.club.toLowerCase().includes(q) && !String(c.year ?? "").includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        const ha = book.cards[a.id] ? 0 : 1;
        const hb = book.cards[b.id] ? 0 : 1;
        if (ha !== hb) return ha - hb;
        return a.club.localeCompare(b.club) || (b.year ?? 0) - (a.year ?? 0) || a.name.localeCompare(b.name);
      });
  }, [catalog, book, query, status, club, decade, rarity, favouriteIds]);

  /** The active club's pool, one row per player: their best card, collected if any card is. */
  const clubRows = useMemo(() => {
    if (!catalog || !activeClub) return [];
    const pool = catalog.clubPlayers.get(activeClub);
    if (!pool) return [];
    const rows: { key: string; card: SquadBookCatalogCard; collected: boolean; cards: number; have: number }[] = [];
    for (const [key, ids] of pool) {
      const cards = ids.map((id) => catalog.byId.get(id)!).filter(Boolean);
      const haveCards = cards.filter((c) => book.cards[c.id]);
      const pickFrom = haveCards.length ? haveCards : cards;
      const best = [...pickFrom].sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || b.rating - a.rating)[0];
      if (best) rows.push({ key, card: best, collected: haveCards.length > 0, cards: cards.length, have: haveCards.length });
    }
    return rows.sort(
      (a, b) => Number(b.collected) - Number(a.collected) || rarityRank(b.card.rarity) - rarityRank(a.card.rarity) || b.card.rating - a.card.rating || a.card.name.localeCompare(b.card.name)
    );
  }, [catalog, activeClub, book]);

  const dreamCards = useMemo(
    () => book.dreamTeam.map((id) => (id && catalog ? catalog.byId.get(id) ?? null : null)),
    [book.dreamTeam, catalog]
  );
  const dreamFilled = dreamCards.filter(Boolean) as SquadBookCatalogCard[];
  const dreamAvg = dreamFilled.length ? Math.round(dreamFilled.reduce((s, c) => s + c.rating, 0) / dreamFilled.length) : 0;

  const candidates = useMemo(() => {
    if (!catalog || pickSlot === null) return [];
    const q = pickQuery.trim().toLowerCase();
    return dreamTeamCandidates(book, catalog, pickSlot).filter(
      (c) => !q || c.name.toLowerCase().includes(q) || c.club.toLowerCase().includes(q) || String(c.year ?? "").includes(q)
    );
  }, [catalog, book, pickSlot, pickQuery]);

  const value = (m: SquadBookMilestone) => progress?.milestoneValue.get(m.id) ?? 0;
  const milestonesFor = (kind: SquadBookMilestone["kind"], group: string) =>
    catalog?.milestones.filter((m) => m.kind === kind && m.group === group) ?? [];
  const totalMilestones = catalog?.milestones.filter((m) => m.kind === "total") ?? [];
  const earned = catalog?.milestones.filter((m) => book.claimed.includes(m.id)).reduce((s, m) => s + m.reward, 0) ?? 0;

  const openClub = (c: string) => {
    setClubView(c);
    setTab("clubs");
  };
  const claim = (forClub?: string) => {
    const result = claimCollectionRewards(forClub);
    if (result.claimed.length) setCelebration(result);
  };

  return (
    <StandardPageShell>
      <div className={PAGE.section}>
        <header className="space-y-3">
          <PitchHero eyebrow="Collection" title="Squad Book" icon={<AlbumGlyph />} />
          <p className={PAGE.intro}>Every player you field in a finished season goes in the book.</p>
        </header>

        <section className="rounded-card bg-pitch-900 p-4 text-center">
          <p className="font-display text-4xl font-bold tabular-nums text-white">
            {progress?.collectedInCatalog ?? Object.keys(book.cards).length}
            <span className="text-xl text-[color:var(--fl-muted)]"> / {catalog?.cards.length ?? "…"}</span>
          </p>
          <p className="mt-1 text-sm text-[color:var(--fl-muted)]">cards collected</p>
          <div className="mx-auto mt-3 max-w-sm">
            <Bar have={progress?.collectedInCatalog ?? 0} of={catalog?.cards.length ?? 1} />
          </div>
          {progress ? (
            <ul className="mt-3 flex flex-wrap justify-center gap-1.5" aria-label="Cards by rarity">
              {CARD_RARITIES.map((r) => (
                <li
                  key={r}
                  className="rounded-full border px-2.5 py-0.5 text-xs font-semibold tabular-nums"
                  style={{ borderColor: RARITY_COLOUR[r], color: RARITY_COLOUR[r] }}
                >
                  {RARITY_LABEL[r]} {progress.byRarity[r]}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex justify-center">
            <MilestoneChips milestones={totalMilestones} value={value} claimed={book.claimed} />
          </div>
          {earned > 0 ? <p className="mt-2 text-xs text-[color:var(--fl-muted)]">{formatClubFunds(earned)} Club Funds earned from the book</p> : null}
          {paid.length ? (
            <p className="mt-2 text-sm font-semibold text-theme-primary" role="status">
              {paid.map((l) => `${l.label.replace(/^Squad Book: /, "")} +${formatClubFunds(l.amount)}`).join(" · ")}
            </p>
          ) : null}
          {claimable.length ? (
            <div className="mt-3 flex flex-col items-center gap-2">
              <p className="text-sm font-semibold text-amber-300" role="status">
                {claimable.length} collection reward{claimable.length === 1 ? "" : "s"} ready
              </p>
              <GameButton size="sm" fullWidth={false} onClick={() => claim()}>
                Claim all
              </GameButton>
            </div>
          ) : null}
        </section>

        <div className="flex justify-center">
          <GameTabs tabs={TABS} active={tab} onChange={setTab} ariaLabel="Squad Book sections" />
        </div>

        {!catalog || !progress ? (
          <p className={`text-center ${TYPO.bodySm}`}>Loading the book…</p>
        ) : tab === "collections" ? (
          <div className="flex flex-col gap-3">
            <Section title="Clubs" intro="Collect a club's players for Club Funds at 25%, 50% and 100%, plus a club title. Tap a club.">
              <ul className="grid gap-2 sm:grid-cols-2">
                {catalog.clubs.map((c) => {
                  const p = progress.byClub.get(c)!;
                  const pp = progress.byClubPlayers.get(c) ?? { have: 0, of: 0 };
                  const ready = claimable.filter((m) => m.group === c).length;
                  return (
                    <li key={c} className="rounded-tile bg-pitch-950/60 p-3">
                      <button type="button" onClick={() => openClub(c)} className="flex w-full min-w-0 items-center gap-3 text-left">
                        <ClubLogoBox club={c} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-white">{c}</span>
                            <span className="shrink-0 text-sm tabular-nums text-white">
                              {pp.have}
                              <span className="text-[color:var(--fl-muted)]">/{pp.of}</span>
                            </span>
                          </span>
                          <span className="mt-1.5 block">
                            <Bar have={pp.have} of={pp.of} />
                          </span>
                          <span className="mt-1 block text-xs text-[color:var(--fl-muted)]">
                            players · {p.have}/{p.of} cards
                            {p.currentOf > 0 ? ` · 2026 squad ${p.currentHave}/${p.currentOf}` : ""}
                          </span>
                          {ready ? (
                            <span className="mt-1 inline-flex rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-bold text-amber-300">
                              {ready} reward{ready === 1 ? "" : "s"} to claim
                            </span>
                          ) : null}
                        </span>
                      </button>
                      <MilestoneChips milestones={milestonesFor("club", c)} value={value} claimed={book.claimed} />
                    </li>
                  );
                })}
              </ul>
            </Section>

            <Section title="Decades" intro="Cards by the season on the card.">
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {catalog.decades.map((d) => {
                  const p = progress.byDecade.get(d)!;
                  return (
                    <li key={d} className="rounded-tile bg-pitch-950/60 p-3">
                      <button
                        type="button"
                        onClick={() => {
                          setDecade(String(d));
                          setTab("cards");
                        }}
                        className="w-full text-left"
                      >
                        <span className="block font-display text-xl font-bold text-white">{decadeLabel(d)}</span>
                        <span className="block text-sm tabular-nums text-white">
                          {p.have}
                          <span className="text-[color:var(--fl-muted)]">/{p.of}</span>
                        </span>
                        <span className="mt-1.5 block">
                          <Bar have={p.have} of={p.of} />
                        </span>
                      </button>
                      <MilestoneChips milestones={milestonesFor("decade", decadeLabel(d))} value={value} claimed={book.claimed} />
                    </li>
                  );
                })}
              </ul>
            </Section>

            <Section title="Sets" intro="Built from the honours on each card's own season.">
              <ul className="grid gap-2 sm:grid-cols-2">
                {catalog.sets.map((s) => {
                  const p = progress.bySet.get(s.id)!;
                  const done = book.claimed.includes(`set-${s.id}`) || p.have >= s.target;
                  return (
                    <li key={s.id} className="rounded-tile bg-pitch-950/60 p-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold text-white">{s.name}</span>
                        <span className="text-sm tabular-nums text-white">
                          {Math.min(p.have, s.target)}
                          <span className="text-[color:var(--fl-muted)]">/{s.target}</span>
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-[color:var(--fl-muted)]">{s.blurb}</p>
                      <div className="mt-1.5">
                        <Bar have={p.have} of={s.target} />
                      </div>
                      <p className={`mt-1.5 text-xs font-semibold ${done ? "text-lime-300" : "text-[color:var(--fl-muted)]"}`}>
                        {done ? (
                          <>
                            <span aria-hidden>✓ </span>
                            <span className="sr-only">Done: </span>
                          </>
                        ) : null}
                        Reward {formatClubFunds(s.reward)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </Section>
          </div>
        ) : tab === "clubs" && activeClub ? (
          (() => {
            const pp = progress.byClubPlayers.get(activeClub) ?? { have: 0, of: 0 };
            const tiers = milestonesFor("collection", activeClub);
            const colours = collectionClubColours(activeClub);
            const titleId = collectionTitleFor(activeClub);
            const titleItem = titleId ? cosmeticById(titleId) : undefined;
            const ownsTitle = Boolean(titleId && cosmetics.owned.includes(titleId));
            const titleOn = Boolean(titleId && cosmetics.equipped.title === titleId);
            const pct = pp.of ? Math.floor((pp.have / pp.of) * 100) : 0;
            return (
              <div className="flex flex-col gap-3">
                <label className="block">
                  <span className="sr-only">Club</span>
                  <select value={activeClub} onChange={(e) => setClubView(e.target.value)} aria-label="Club collection" className={SELECT}>
                    {catalog.clubs.map((c) => {
                      const p = progress.byClubPlayers.get(c);
                      return (
                        <option key={c} value={c}>
                          {c} ({p?.have ?? 0}/{p?.of ?? 0})
                        </option>
                      );
                    })}
                  </select>
                </label>

                <section
                  className="rounded-card bg-pitch-900 p-4 text-center"
                  style={colours ? { boxShadow: `inset 0 3px 0 ${colours.primary}` } : undefined}
                  data-testid="club-collection"
                >
                  <div className="flex flex-col items-center gap-2">
                    <ClubLogoBox club={activeClub} size="lg" />
                    <h2 className="text-lg font-bold text-white">{activeClub}</h2>
                  </div>
                  <p className="mt-2 font-display text-3xl font-bold tabular-nums text-white">
                    {pp.have}
                    <span className="text-lg text-[color:var(--fl-muted)]"> / {pp.of}</span>
                  </p>
                  <p className="text-sm text-[color:var(--fl-muted)]">players collected · {pct}%</p>
                  <div className="mx-auto mt-2 max-w-sm">
                    <Bar have={pp.have} of={pp.of} colour={colours && colours.primary !== "#000000" && colours.primary !== "#111111" ? colours.primary : undefined} />
                  </div>

                  {tiers.length === 0 ? (
                    <p className="mt-3 text-xs text-[color:var(--fl-muted)]">
                      Clubs with fewer than {COLLECTION_MIN_POOL} players have no reward track.
                    </p>
                  ) : (
                    <ol className="mx-auto mt-4 grid max-w-xl gap-2 sm:grid-cols-3">
                      {tiers.map((m) => {
                        const done = book.claimed.includes(m.id);
                        const ready = !done && value(m) >= m.target;
                        const cosmetic = m.cosmeticId ? cosmeticById(m.cosmeticId) : undefined;
                        return (
                          <li
                            key={m.id}
                            className={`rounded-tile border p-3 text-center ${
                              done ? "border-lime-300/40 bg-lime-300/5" : ready ? "border-amber-300/60 bg-amber-300/10" : "border-pitch-700/60 bg-pitch-950/60"
                            }`}
                          >
                            <p className="font-display text-xl font-bold text-white">{m.percent}%</p>
                            <p className="text-xs tabular-nums text-[color:var(--fl-muted)]">
                              {Math.min(value(m), m.target)}/{m.target} players
                            </p>
                            <p className="mt-1 text-sm font-semibold text-white">{formatClubFunds(m.reward)}</p>
                            {cosmetic ? <p className="text-xs font-semibold text-amber-300">+ “{cosmetic.name}” title</p> : null}
                            <div className="mt-2 flex justify-center">
                              {done ? (
                                <span className="text-xs font-semibold text-lime-300">
                                  <span aria-hidden>✓ </span>Claimed
                                </span>
                              ) : ready ? (
                                <GameButton size="sm" fullWidth={false} onClick={() => claim(activeClub)}>
                                  Claim
                                </GameButton>
                              ) : (
                                <span className="text-xs text-[color:var(--fl-muted)]">{m.target - value(m)} to go</span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}

                  {titleItem && ownsTitle ? (
                    <div className="mt-3 flex flex-col items-center gap-1.5">
                      <span className="inline-flex items-center rounded-full bg-amber-400/15 px-2.5 py-0.5 text-xs font-bold text-amber-300">{titleItem.name}</span>
                      <GameButton
                        size="sm"
                        variant={titleOn ? "secondary" : "theme"}
                        fullWidth={false}
                        onClick={() => equipCosmetic("title", titleOn ? null : titleItem.id)}
                      >
                        {titleOn ? "Take title off" : "Wear title"}
                      </GameButton>
                    </div>
                  ) : null}
                </section>

                <p className={`text-center ${TYPO.bodySm}`}>
                  Each player counts once, whichever of their {activeClub} cards you field.
                </p>
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {clubRows.slice(0, clubShown).map((row) => (
                    <li key={row.key}>
                      <BookCard
                        card={row.card}
                        collected={row.collected}
                        sub={row.collected ? `${row.have}/${row.cards} card${row.cards === 1 ? "" : "s"}` : row.cards > 1 ? `${row.cards} cards · locked` : "locked"}
                        favourite={favouriteIds.has(row.card.id)}
                        onClick={() => setProfileId(row.card.id)}
                      />
                    </li>
                  ))}
                </ul>
                {clubRows.length > clubShown ? (
                  <div className="flex justify-center">
                    <GameButton variant="secondary" size="sm" fullWidth={false} onClick={() => setClubShown((n) => n + PAGE_SIZE)}>
                      Show more
                    </GameButton>
                  </div>
                ) : null}
              </div>
            );
          })()
        ) : tab === "cards" ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search player, club or year"
                aria-label="Search cards"
                className="col-span-2 min-h-[44px] w-full min-w-0 rounded-xl border border-pitch-600/60 bg-pitch-900 px-3 text-sm text-white placeholder:text-[color:var(--fl-muted)] sm:col-span-1"
              />
              <select value={club} onChange={(e) => setClub(e.target.value)} aria-label="Club" className={`${SELECT} col-span-2 sm:col-span-1 sm:w-auto`}>
                <option value="all">All clubs</option>
                {catalog.clubs.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select value={decade} onChange={(e) => setDecade(e.target.value)} aria-label="Decade" className={`${SELECT} sm:w-auto`}>
                <option value="all">All decades</option>
                {catalog.decades.map((d) => (
                  <option key={d} value={String(d)}>
                    {decadeLabel(d)}
                  </option>
                ))}
              </select>
              <select value={rarity} onChange={(e) => setRarity(e.target.value as "all" | CardRarity)} aria-label="Rarity" className={`${SELECT} sm:w-auto`}>
                <option value="all">All rarities</option>
                {CARD_RARITIES.map((r) => (
                  <option key={r} value={r}>
                    {RARITY_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {(["all", "collected", "missing", "favourites"] as Status[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={status === s}
                  onClick={() => setStatus(s)}
                  className={`min-h-[40px] rounded-full px-3.5 text-sm font-semibold capitalize ${
                    status === s ? "bg-theme-primary text-[color:var(--theme-text-on-primary)]" : "bg-pitch-800 text-white"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <p className={`text-center ${TYPO.bodySm}`}>
              {filtered.length} card{filtered.length === 1 ? "" : "s"} · tap one for his profile
            </p>

            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.slice(0, shown).map((c) => {
                const entry = book.cards[c.id];
                return (
                  <li key={c.id}>
                    <BookCard
                      card={c}
                      collected={Boolean(entry)}
                      sub={entry ? `${c.club} · ${SOURCE_LABEL[entry.source]}${entry.times > 1 ? ` · ×${entry.times}` : ""}` : `${c.club} · locked`}
                      favourite={favouriteIds.has(c.id)}
                      onClick={() => setProfileId(c.id)}
                    />
                  </li>
                );
              })}
            </ul>
            {filtered.length > shown ? (
              <div className="flex justify-center">
                <GameButton variant="secondary" size="sm" fullWidth={false} onClick={() => setShown((n) => n + PAGE_SIZE)}>
                  Show more
                </GameButton>
              </div>
            ) : null}
            {filtered.length === 0 ? (
              <p className={`text-center ${TYPO.bodySm}`}>
                No cards match.{" "}
                {Object.keys(book.cards).length === 0 ? (
                  <Link href="/play" className={LINK.accent}>
                    Play a season
                  </Link>
                ) : null}
              </p>
            ) : null}
          </div>
        ) : tab === "dream" ? (
          <div className="flex flex-col gap-3">
            <section className="rounded-card bg-pitch-900 p-4 text-center">
              <h2 className="text-[17px] font-bold text-white">Your all-time Dream Team</h2>
              <p className="mt-1 text-sm text-[color:var(--fl-muted)]">
                Pick 13 from the cards you have collected. Saved on this device, and to your account when you are logged in.
              </p>
              <p className="mt-2 text-sm tabular-nums text-white">
                {dreamFilled.length}/13 picked{dreamFilled.length ? ` · average ${dreamAvg}` : ""}
              </p>
            </section>
            {Object.keys(book.cards).length === 0 ? (
              <p className={`text-center ${TYPO.bodySm}`}>
                Your book is empty.{" "}
                <Link href="/play" className={LINK.accent}>
                  Play a season
                </Link>{" "}
                to collect cards.
              </p>
            ) : null}
            <ol className="grid gap-2 sm:grid-cols-2">
              {DREAM_TEAM_SLOTS.map((slot, i) => {
                const card = dreamCards[i];
                return (
                  <li key={slot.number} className="flex min-w-0 items-center gap-2">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pitch-800 font-display text-base font-bold text-white" aria-label={`Number ${slot.number}`}>
                      {slot.number}
                    </span>
                    <span className="min-w-0 flex-1">
                      {card ? (
                        <BookCard card={card} collected sub={`${slot.label} · ${card.club}`} onClick={() => { setPickQuery(""); setPickSlot(i); }} />
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setPickQuery("");
                            setPickSlot(i);
                          }}
                          className="flex min-h-[56px] w-full items-center justify-center rounded-tile border-2 border-dashed border-pitch-700/70 bg-pitch-950/40 text-sm font-semibold text-[color:var(--fl-muted)]"
                        >
                          Pick a {slot.label.toLowerCase()}
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
            {dreamFilled.length ? (
              <div className="flex justify-center">
                <GameButton variant="secondary" size="sm" fullWidth={false} onClick={() => clearDreamTeam()}>
                  Clear the team
                </GameButton>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <GameModal open={pickSlot !== null} onClose={() => setPickSlot(null)} labelledBy="dream-pick-title">
        {pickSlot !== null ? (
          <div className="flex flex-col gap-3 text-center">
            <h2 id="dream-pick-title" className="text-lg font-bold text-white">
              No. {DREAM_TEAM_SLOTS[pickSlot].number} · {DREAM_TEAM_SLOTS[pickSlot].label}
            </h2>
            <input
              type="search"
              value={pickQuery}
              onChange={(e) => setPickQuery(e.target.value)}
              placeholder="Search your cards"
              aria-label="Search your cards"
              className="min-h-[44px] w-full min-w-0 rounded-xl border border-pitch-600/60 bg-pitch-900 px-3 text-sm text-white placeholder:text-[color:var(--fl-muted)]"
            />
            {candidates.length === 0 ? (
              <p className={TYPO.bodySm}>No collected {DREAM_TEAM_SLOTS[pickSlot].label.toLowerCase()}s yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {candidates.slice(0, 100).map((c) => (
                  <li key={c.id}>
                    <BookCard
                      card={c}
                      collected
                      sub={`${c.club}${book.dreamTeam.includes(c.id) ? " · in team" : ""}`}
                      onClick={() => {
                        setDreamTeamSlot(pickSlot, c.id);
                        setPickSlot(null);
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              {book.dreamTeam[pickSlot] ? (
                <GameButton
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  onClick={() => {
                    setDreamTeamSlot(pickSlot, null);
                    setPickSlot(null);
                  }}
                >
                  Empty this spot
                </GameButton>
              ) : null}
              <GameButton variant="secondary" size="sm" fullWidth={false} onClick={() => setPickSlot(null)}>
                Close
              </GameButton>
            </div>
          </div>
        ) : null}
      </GameModal>

      {profilePlayer ? <PlayerDetailModal player={profilePlayer} onClose={() => setProfileId(null)} /> : null}

      <GameModal open={celebration !== null} onClose={() => setCelebration(null)} labelledBy="collection-claim-title">
        {celebration ? (
          <div className="flex flex-col items-center gap-3 text-center" role="status">
            <span className="text-4xl" aria-hidden>
              🏆
            </span>
            <h2 id="collection-claim-title" className="font-display text-2xl font-bold text-white">
              Collection reward{celebration.claimed.length === 1 ? "" : "s"} claimed
            </h2>
            <ul className="flex w-full flex-col gap-1.5">
              {celebration.claimed.map((m) => (
                <li key={m.id} className="rounded-tile bg-pitch-950/60 px-3 py-2 text-sm text-white">
                  <span className="font-semibold">{m.label}</span>
                  <span className="block text-theme-primary">
                    {celebration.paid.some((l) => l.id === `squadbook-${m.id}`) ? `+${formatClubFunds(m.reward)} Club Funds` : "Already paid"}
                  </span>
                </li>
              ))}
            </ul>
            {celebration.cosmetics.map((id) => {
              const item = cosmeticById(id);
              if (!item) return null;
              const on = cosmetics.equipped.title === id;
              return (
                <div key={id} className="flex flex-col items-center gap-2">
                  <p className="text-sm text-[color:var(--fl-muted)]">New title unlocked</p>
                  <span className="inline-flex items-center rounded-full bg-amber-400/15 px-3 py-1 text-sm font-bold text-amber-300">{item.name}</span>
                  {!on ? (
                    <GameButton size="sm" fullWidth={false} onClick={() => equipCosmetic("title", id)}>
                      Wear it
                    </GameButton>
                  ) : (
                    <span className="text-xs font-semibold text-lime-300">Wearing it</span>
                  )}
                </div>
              );
            })}
            <GameButton variant="secondary" size="sm" fullWidth={false} onClick={() => setCelebration(null)}>
              Nice
            </GameButton>
          </div>
        ) : null}
      </GameModal>
    </StandardPageShell>
  );
}
