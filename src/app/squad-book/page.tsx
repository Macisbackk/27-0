"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { StandardPageShell } from "@/components/ui/StandardPageShell";
import { GameTabs } from "@/components/ui/GameTabs";
import { GameButton } from "@/components/ui/GameButton";
import { ClubLogoBox } from "@/components/ClubBadge";
import { PAGE, LINK } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { formatClubFunds } from "@/lib/club-funds";
import type { ClubFundsEarnedLine } from "@/lib/club-funds";
import { ensurePlayersLoaded } from "@/lib/players";
import {
  claimSquadBookMilestones,
  computeSquadBookProgress,
  decadeLabel,
  getSquadBookCatalog,
  useSquadBook,
  type SquadBookCatalog,
  type SquadBookMilestone,
  type SquadBookSource,
} from "@/lib/squad-book";

type Tab = "collections" | "cards";
const TABS: { id: Tab; label: string }[] = [
  { id: "collections", label: "Collections" },
  { id: "cards", label: "Cards" },
];
type Status = "all" | "collected" | "missing";
const PAGE_SIZE = 60;

const SOURCE_LABEL: Record<SquadBookSource, string> = { classic: "Classic", era: "Era", daily: "Daily", weekly: "Weekly" };

function Bar({ have, of }: { have: number; of: number }) {
  const pct = of > 0 ? Math.min(100, Math.round((have / of) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-pitch-800" aria-hidden>
      <div className="h-full rounded-full bg-theme-primary transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  );
}

function Section({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card bg-pitch-900 p-4 text-left">
      <h2 className="text-[17px] font-bold text-white">{title}</h2>
      {intro ? <p className="mt-1 text-sm text-[color:var(--fl-muted)]">{intro}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
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
            {done ? "✓ " : ""}
            {m.id.includes("-squad-") ? "Full squad" : m.kind === "set" ? "Complete" : m.target} · {formatClubFunds(m.reward)}
          </span>
        );
      })}
    </div>
  );
}

export default function SquadBookPage() {
  const book = useSquadBook();
  const [catalog, setCatalog] = useState<SquadBookCatalog | null>(null);
  const [tab, setTab] = useState<Tab>("collections");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [club, setClub] = useState("all");
  const [decade, setDecade] = useState("all");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [paid, setPaid] = useState<ClubFundsEarnedLine[]>([]);

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
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => setShown(PAGE_SIZE), [query, status, club, decade]);

  const progress = useMemo(() => (catalog ? computeSquadBookProgress(book, catalog) : null), [book, catalog]);

  const filtered = useMemo(() => {
    if (!catalog) return [];
    const q = query.trim().toLowerCase();
    return catalog.cards
      .filter((c) => {
        const have = Boolean(book.cards[c.id]);
        if (status === "collected" && !have) return false;
        if (status === "missing" && have) return false;
        if (club !== "all" && c.club !== club) return false;
        if (decade !== "all" && String(c.decade) !== decade) return false;
        if (q && !c.name.toLowerCase().includes(q) && !c.club.toLowerCase().includes(q) && !String(c.year ?? "").includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        const ha = book.cards[a.id] ? 0 : 1;
        const hb = book.cards[b.id] ? 0 : 1;
        if (ha !== hb) return ha - hb;
        return a.club.localeCompare(b.club) || (b.year ?? 0) - (a.year ?? 0) || a.name.localeCompare(b.name);
      });
  }, [catalog, book, query, status, club, decade]);

  const value = (m: SquadBookMilestone) => progress?.milestoneValue.get(m.id) ?? 0;
  const milestonesFor = (kind: SquadBookMilestone["kind"], group: string) =>
    catalog?.milestones.filter((m) => m.kind === kind && m.group === group) ?? [];
  const totalMilestones = catalog?.milestones.filter((m) => m.kind === "total") ?? [];
  const earned = catalog?.milestones.filter((m) => book.claimed.includes(m.id)).reduce((s, m) => s + m.reward, 0) ?? 0;

  return (
    <StandardPageShell>
      <div className={PAGE.section}>
        <header className="text-center">
          <p className={TYPO.sectionLabel}>Collection</p>
          <h1 className={`mt-2 ${TYPO.pageTitle}`}>Squad Book</h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-gray-500">
            Every card you field in a finished Classic, Era, Daily or Weekly season goes in the book. Current and era cards of the same player count separately.
          </p>
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
          <MilestoneChips milestones={totalMilestones} value={value} claimed={book.claimed} />
          {earned > 0 ? <p className="mt-2 text-xs text-[color:var(--fl-muted)]">{formatClubFunds(earned)} Club Funds earned from the book</p> : null}
          {paid.length ? (
            <p className="mt-2 text-sm font-semibold text-theme-primary" role="status">
              {paid.map((l) => `${l.label.replace(/^Squad Book: /, "")} +${formatClubFunds(l.amount)}`).join(" · ")}
            </p>
          ) : null}
        </section>

        <div className="flex justify-center">
          <GameTabs tabs={TABS} active={tab} onChange={setTab} ariaLabel="Squad Book sections" />
        </div>

        {!catalog || !progress ? (
          <p className={`text-center ${TYPO.bodySm}`}>Loading the book…</p>
        ) : tab === "collections" ? (
          <div className="flex flex-col gap-3">
            <Section title="Clubs" intro="Field 10, 25 and 50 different cards from a club, and every player in its 2026 squad. Tap a club to see its cards.">
              <ul className="grid gap-2 sm:grid-cols-2">
                {catalog.clubs.map((c) => {
                  const p = progress.byClub.get(c)!;
                  return (
                    <li key={c} className="rounded-tile bg-pitch-950/60 p-3">
                      <button
                        type="button"
                        onClick={() => {
                          setClub(c);
                          setTab("cards");
                        }}
                        className="flex w-full min-w-0 items-center gap-3 text-left"
                      >
                        <ClubLogoBox club={c} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-white">{c}</span>
                            <span className="shrink-0 text-sm tabular-nums text-white">
                              {p.have}
                              <span className="text-[color:var(--fl-muted)]">/{p.of}</span>
                            </span>
                          </span>
                          <span className="mt-1.5 block">
                            <Bar have={p.have} of={p.of} />
                          </span>
                          {p.currentOf > 0 ? (
                            <span className="mt-1 block text-xs text-[color:var(--fl-muted)]">
                              2026 squad {p.currentHave}/{p.currentOf}
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
                        {done ? "✓ " : ""}Reward {formatClubFunds(s.reward)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </Section>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search player, club or year"
                aria-label="Search cards"
                className="min-h-[44px] w-full min-w-0 rounded-xl border border-pitch-600/60 bg-pitch-900 px-3 text-sm text-white placeholder:text-gray-500"
              />
              <select
                value={club}
                onChange={(e) => setClub(e.target.value)}
                aria-label="Club"
                className="min-h-[44px] rounded-xl border border-pitch-600/60 bg-pitch-900 px-3 text-sm text-white"
              >
                <option value="all">All clubs</option>
                {catalog.clubs.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={decade}
                onChange={(e) => setDecade(e.target.value)}
                aria-label="Decade"
                className="min-h-[44px] rounded-xl border border-pitch-600/60 bg-pitch-900 px-3 text-sm text-white"
              >
                <option value="all">All decades</option>
                {catalog.decades.map((d) => (
                  <option key={d} value={String(d)}>
                    {decadeLabel(d)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {(["all", "collected", "missing"] as Status[]).map((s) => (
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
              {filtered.length} card{filtered.length === 1 ? "" : "s"}
            </p>

            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.slice(0, shown).map((c) => {
                const entry = book.cards[c.id];
                return (
                  <li
                    key={c.id}
                    className={`flex min-w-0 items-center gap-2 rounded-tile p-2.5 ${entry ? "bg-pitch-900" : "border border-dashed border-pitch-700/70 bg-pitch-950/40"}`}
                  >
                    {entry ? (
                      <ClubLogoBox club={c.club} size="xs" />
                    ) : (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pitch-800 text-gray-600" aria-label="Not collected">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                          <circle cx="12" cy="8" r="4" />
                          <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" />
                        </svg>
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm font-semibold ${entry ? "text-white" : "text-gray-500"}`}>
                        {c.name}
                        {c.category !== "current" && c.year ? ` (${c.year})` : ""}
                      </span>
                      <span className="block truncate text-xs text-[color:var(--fl-muted)]">
                        {entry ? `${c.club} · ${SOURCE_LABEL[entry.source]}${entry.times > 1 ? ` · ×${entry.times}` : ""}` : `${c.club} · locked`}
                      </span>
                    </span>
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
        )}
      </div>
    </StandardPageShell>
  );
}
