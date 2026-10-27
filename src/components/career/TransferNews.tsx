"use client";

import { useEffect, useRef, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import {
  DEADLINE_MINUTES,
  WINDOW_CLOSES_BEFORE_ROUND,
  clockLabel,
  formatMoney,
  deadlineClock,
  deadlineDecisionPending,
  isDeadlineDay,
  isWindowOpen,
  liveOffers,
  roundsUntilDeadline,
  seasonDeals,
  type DeadlineEvent,
  type TransferDeal,
} from "@/lib/career";
import { useCareer } from "@/lib/career/context";
import { playTransferComplete, playTransferOffer, playUiClick, playWarning } from "@/lib/sound";
import { ClubLink } from "./ClubSheet";
import { ClubBadge, RatingPill } from "./bits";

/** Deadline Day clock speed: 10 minutes of the day every 2 seconds (12 hours ≈ 2½ minutes). */
const TICK_MS = 2000;
const TICK_MINUTES = 10;

/** Runs Deadline Day's clock while it's live (only in the visible tab, so two tabs don't double it). */
export function useDeadlineDriver() {
  const { state, tickDeadline } = useCareer();
  const running = !!state && deadlineDecisionPending(state) && !deadlineClock(state).paused;
  const tick = useRef(tickDeadline);
  tick.current = tickDeadline;
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") tick.current(TICK_MINUTES);
    }, TICK_MS);
    return () => window.clearInterval(t);
  }, [running]);
}

export function DealRow({ d }: { d: TransferDeal }) {
  const { state } = useCareer();
  const s = state!;
  const to = d.to ? s.clubs[d.to] : null;
  const from = d.from ? s.clubs[d.from] : null;
  return (
    <li className="flex items-center gap-2.5 py-1.5 text-left text-sm">
      <RatingPill rating={d.rating} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-white">{d.playerName}</span>
        <span className="block truncate text-xs text-[color:var(--fl-muted)]">
          {from ? <ClubLink clubId={from.id}>{from.short}</ClubLink> : "Free agent"} →{" "}
          {to ? <ClubLink clubId={to.id}>{to.name}</ClubLink> : d.playerId.startsWith("legend-") ? "Legend Vault" : d.fee > 0 ? "free agency" : "released"}
        </span>
      </span>
      <span className="shrink-0 text-xs font-semibold text-white">{d.fee > 0 ? formatMoney(d.fee) : "Free"}</span>
    </li>
  );
}

const FEED_TONE: Record<DeadlineEvent["kind"], string> = {
  deal: "text-white",
  offer: "text-theme-primary",
  you: "text-amber-200 font-semibold",
  market: "text-sky-200",
  info: "text-[color:var(--fl-muted)]",
};

/** The big countdown: hours and minutes until the window shuts. */
export function DeadlineClockFace({ compact = false }: { compact?: boolean }) {
  const { state } = useCareer();
  const s = state!;
  const clock = deadlineClock(s);
  const left = clock.minutesLeft;
  const late = left <= 60;
  const pct = Math.max(0, Math.min(100, (left / DEADLINE_MINUTES) * 100));
  return (
    <div className={compact ? "flex items-center gap-3" : ""}>
      <p className={`fl-number tabular-nums leading-none ${compact ? "text-[28px]" : "text-[52px]"} ${late ? "text-danger" : "text-amber-300"}`} aria-live="off">
        {clockLabel(left)}
      </p>
      <div className={compact ? "min-w-0 flex-1" : "mt-1"}>
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--fl-muted)]">
          {left === 0 ? "Window shut" : clock.paused ? "Clock paused" : late ? "Final hour" : "until the window shuts"}
        </p>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
          <div className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${late ? "bg-danger" : "bg-amber-300"}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

/** Live offers for your players, each with its own lapse time. */
export function DeadlineOffers() {
  const { state, acceptOffer, rejectOffer } = useCareer();
  const s = state!;
  const offers = liveOffers(s);
  const clock = deadlineClock(s);
  const [note, setNote] = useState<string | null>(null);
  if (offers.length === 0) return note ? <p className="text-center text-sm text-theme-primary" role="status">{note}</p> : null;
  return (
    <section aria-label="Offers for your players" className="flex flex-col gap-2">
      {note ? <p className="text-center text-sm text-theme-primary" role="status">{note}</p> : null}
      {offers.map((o) => {
        const club = s.clubs[o.clubId];
        const p = s.players[o.playerId];
        if (!club || !p) return null;
        const lapses = clock.minutesLeft - o.expiresAt;
        return (
          <div key={o.id} className="fl-rise rounded-tile bg-pitch-900 p-3 text-left ring-2 ring-theme-primary/50">
            <div className="flex items-center gap-2.5">
              <ClubBadge club={club} size="sm" />
              <p className="min-w-0 flex-1 text-sm text-white">
                <ClubLink clubId={club.id} className="font-bold">{club.name}</ClubLink>
                {o.raised ? <span className="ml-1.5 rounded-full bg-amber-300/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-200">Bidding war</span> : null}
                <span className="block text-[13px] text-[color:var(--fl-muted)]">
                  want <span className="font-semibold text-white">{p.name}</span> ({p.pos}, {p.rating}){o.reason ? ` · ${o.reason}` : ""}
                </span>
              </p>
              <span className="shrink-0 text-right">
                <span className="block font-display text-lg font-bold text-theme-primary">{formatMoney(o.fee)}</span>
                <span className={`block text-[11px] tabular-nums ${lapses <= 30 ? "text-danger" : "text-[color:var(--fl-muted)]"}`}>lapses in {clockLabel(lapses)}</span>
              </span>
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <GameButton size="sm" variant="secondary" onClick={() => { playUiClick(); rejectOffer(o.id); setNote(null); }}>
                Turn it down
              </GameButton>
              <GameButton
                size="sm"
                onClick={() => {
                  const err = acceptOffer(o.id);
                  if (err) {
                    playWarning();
                    setNote(err === "squad-min" ? "You can't go below 20 players." : err === "no-room" ? `${club.name} have no room now.` : "That offer has gone.");
                  } else {
                    playTransferComplete();
                    setNote(`${p.name} joins ${club.name} for ${formatMoney(o.fee)}.`);
                  }
                }}
              >
                Accept
              </GameButton>
            </div>
          </div>
        );
      })}
    </section>
  );
}

/** What's happened today, newest first. */
function DeadlineFeed({ max = 8 }: { max?: number }) {
  const { state } = useCareer();
  const clock = deadlineClock(state!);
  const items = clock.feed.slice(0, max);
  return (
    <ul aria-label="Deadline Day feed" className="mt-3 divide-y divide-white/10 text-left">
      {items.map((e, i) => (
        <li key={`${e.at}-${i}-${e.text}`} className={`flex gap-2.5 py-1.5 text-[13px] ${i === 0 ? "fl-rise" : ""}`}>
          <span className="w-10 shrink-0 tabular-nums text-[11px] leading-5 text-[color:var(--fl-muted)]">{clockLabel(e.at)}</span>
          <span className={`min-w-0 flex-1 ${FEED_TONE[e.kind]}`}>{e.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** Deadline Day: a 12-hour clock with deals, offers and new names landing as it counts down. */
export function DeadlineDayCard({ onOpenMarket }: { onOpenMarket: () => void }) {
  const { state, closeDeadline, pauseDeadline, tickDeadline } = useCareer();
  const s = state!;
  const pending = deadlineDecisionPending(s);
  const clock = deadlineClock(s);
  // A ping when a new offer lands, and a warning at the final hour.
  const lastTop = useRef<string | null>(null);
  const top = clock.feed[0];
  const topKey = top ? `${top.at}-${top.text}` : null;
  const topKind = top?.kind;
  useEffect(() => {
    if (lastTop.current && topKey && topKey !== lastTop.current && topKind === "offer") playTransferOffer();
    lastTop.current = topKey;
  }, [topKey, topKind]);
  const finalHour = clock.minutesLeft <= 60 && clock.minutesLeft > 0;
  const warned = useRef(false);
  useEffect(() => {
    if (finalHour && !warned.current) {
      warned.current = true;
      playWarning();
    }
  }, [finalHour]);

  return (
    <section aria-label="Deadline Day" className="rounded-card bg-pitch-900 p-4 ring-2 ring-amber-300/60">
      <div className="flex items-start justify-between gap-3">
        <p className="fl-number text-[26px] leading-none text-amber-300">DEADLINE DAY</p>
        {pending ? (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${clock.paused ? "bg-white/10 text-[color:var(--fl-muted)]" : "bg-danger/20 text-red-200"}`}>
            {clock.paused ? null : <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" aria-hidden />}
            {clock.paused ? "Paused" : "Live"}
          </span>
        ) : null}
      </div>
      <div className="mt-3">
        <DeadlineClockFace />
      </div>
      {pending ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <GameButton size="sm" variant="secondary" onClick={() => { playUiClick(); pauseDeadline(!clock.paused); }}>
              {clock.paused ? "Resume the clock" : "Pause the clock"}
            </GameButton>
            <GameButton size="sm" variant="secondary" disabled={clock.minutesLeft <= 60} onClick={() => { playUiClick(); tickDeadline(60); }}>
              Skip an hour
            </GameButton>
          </div>
          <div className="mt-3">
            <DeadlineOffers />
          </div>
          <DeadlineFeed />
          <p className="mt-3 text-sm text-amber-200">
            The season waits for 0:00. Buy, sell, or shut the window early.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <GameButton size="md" variant="secondary" onClick={() => { playUiClick(); onOpenMarket(); }}>
              Buy and sell
            </GameButton>
            <GameButton size="md" onClick={() => { playUiClick(); closeDeadline(); }}>
              Shut the window
            </GameButton>
          </div>
        </>
      ) : (
        <>
          <DeadlineFeed max={6} />
          <p className="mt-3 text-sm font-semibold text-amber-200">Window shut. Round {WINDOW_CLOSES_BEFORE_ROUND} is next.</p>
        </>
      )}
    </section>
  );
}

export function TransferWindowCard({ onOpenMarket }: { onOpenMarket: () => void }) {
  const { state } = useCareer();
  const s = state!;
  // Deadline Day keeps its card after the window shuts, as a round-up of the day.
  if (isDeadlineDay(s)) return <DeadlineDayCard onOpenMarket={onOpenMarket} />;
  // In-season transfers happen on Deadline Day only: a heads-up in the run-up to it.
  const until = roundsUntilDeadline(s);
  if (until === null || until > 5) return null;
  return (
    <section aria-label="Deadline Day coming" className="flex items-center gap-3 rounded-card bg-pitch-900 p-4">
      <span className="fl-number shrink-0 text-[26px] leading-none text-amber-300">{until}</span>
      <p className="min-w-0 text-left text-sm text-[color:var(--fl-muted)]">
        <span className="font-semibold text-white">{until === 1 ? "Round" : "Rounds"} until Deadline Day.</span> Your only chance to
        buy and sell this season.
      </p>
    </section>
  );
}

export function IncomingBidCard() {
  const { state, acceptBid, rejectBid } = useCareer();
  const s = state!;
  const bid = s.incomingBid;
  if (!bid || !isWindowOpen(s)) return null;
  const club = s.clubs[bid.clubId];
  const p = s.players[bid.playerId];
  if (!club || !p) return null;
  return (
    <section aria-label="Transfer bid" className="rounded-card bg-pitch-900 p-4 ring-2 ring-theme-primary/50">
      <p className="text-[13px] font-semibold text-theme-primary">Bid received</p>
      <p className="mt-1 text-[15px] text-white">
        <ClubLink clubId={club.id} className="font-bold">{club.name}</ClubLink> want <span className="font-bold">{p.name}</span> ({p.pos}, {p.rating}) and offer{" "}
        <span className="font-bold text-theme-primary">{formatMoney(bid.fee)}</span>.
      </p>
      <p className="mt-1 text-xs text-[color:var(--fl-muted)]">Ends when the window shuts.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <GameButton size="sm" variant="secondary" onClick={() => { playUiClick(); rejectBid(); }}>
          Turn it down
        </GameButton>
        <GameButton size="sm" onClick={() => { playTransferComplete(); acceptBid(); }}>
          Accept
        </GameButton>
      </div>
    </section>
  );
}

/** Club tab: every deal this season, newest first. */
export function TransferRoundUp() {
  const { state } = useCareer();
  const s = state!;
  const deals = seasonDeals(s);
  return (
    <section aria-label="Transfer round-up" className="rounded-card bg-pitch-900 p-4 text-left">
      <p className="text-[15px] font-bold text-white">Transfer round-up</p>
      {deals.length === 0 ? (
        <p className="mt-1 text-sm text-[color:var(--fl-muted)]">
          {roundsUntilDeadline(s) === null && !isDeadlineDay(s)
            ? "No deals this season."
            : `No deals yet. Trade on Deadline Day, before Round ${WINDOW_CLOSES_BEFORE_ROUND}.`}
        </p>
      ) : (
        <ul className="mt-1 divide-y divide-[color:var(--fl-line)]">
          {deals.slice(0, 12).map((d) => (
            <DealRow key={`${d.playerId}-${d.at}`} d={d} />
          ))}
        </ul>
      )}
    </section>
  );
}
