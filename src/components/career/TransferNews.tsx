"use client";

import { useEffect, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import {
  WINDOW_CLOSES_BEFORE_ROUND,
  formatMoney,
  deadlineDecisionPending,
  isDeadlineDay,
  isWindowOpen,
  roundsLeftInWindow,
  seasonDeals,
  type TransferDeal,
} from "@/lib/career";
import { useCareer } from "@/lib/career/context";
import { playTransferComplete, playTransferOffer, playUiClick } from "@/lib/sound";
import { ClubLink } from "./ClubSheet";
import { RatingPill } from "./bits";

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
          {from ? <ClubLink clubId={from.id}>{from.short}</ClubLink> : "Free agent"} → {to ? <ClubLink clubId={to.id}>{to.name}</ClubLink> : "released"}
        </span>
      </span>
      <span className="shrink-0 text-xs font-semibold text-white">{d.fee > 0 ? formatMoney(d.fee) : "Free"}</span>
    </li>
  );
}

/** Deadline Day: late deals land one by one, like the TV ticker. */
function DeadlineTicker({ deals }: { deals: TransferDeal[] }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    setShown(0);
    if (deals.length === 0) return;
    let i = 0;
    const t = window.setInterval(() => {
      i += 1;
      setShown(i);
      playTransferOffer();
      if (i >= deals.length) window.clearInterval(t);
    }, 650);
    return () => window.clearInterval(t);
  }, [deals.length]);
  return (
    <ul className="mt-2 divide-y divide-white/10">
      {deals.slice(0, shown).map((d) => (
        <DealRow key={`${d.playerId}-${d.at}`} d={d} />
      ))}
      {shown < deals.length ? <li className="py-1.5 text-xs font-semibold text-amber-200">Breaking…</li> : null}
    </ul>
  );
}

export function TransferWindowCard({ onOpenMarket }: { onOpenMarket: () => void }) {
  const { state, closeDeadline } = useCareer();
  const s = state!;
  if (!isWindowOpen(s)) return null;
  const deadline = isDeadlineDay(s);
  const pending = deadlineDecisionPending(s);
  const deals = seasonDeals(s);
  const left = roundsLeftInWindow(s);

  if (deadline) {
    const dd = deals.filter((d) => d.deadlineDay && !d.user);
    return (
      <section aria-label="Deadline Day" className="rounded-card bg-amber-400/10 p-4 ring-2 ring-amber-300/60">
        <p className="fl-number text-[30px] leading-none text-amber-300">DEADLINE DAY</p>
        <p className="mt-1 text-sm text-white">Last chance to do business. The window shuts when Round {WINDOW_CLOSES_BEFORE_ROUND} kicks off.</p>
        <DeadlineTicker deals={dd} />
        {pending ? (
          <>
            <p className="mt-3 text-sm font-semibold text-amber-200">
              The season is paused until you&rsquo;re done. Sign, sell or answer bids, then shut the window.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <GameButton
                size="md"
                variant="secondary"
                onClick={() => {
                  playUiClick();
                  onOpenMarket();
                }}
              >
                Late signing
              </GameButton>
              <GameButton
                size="md"
                onClick={() => {
                  playUiClick();
                  closeDeadline();
                }}
              >
                Shut the window
              </GameButton>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm font-semibold text-amber-200">Window shut. Round {WINDOW_CLOSES_BEFORE_ROUND} is next.</p>
        )}
      </section>
    );
  }

  return (
    <section aria-label="Transfer window" className="rounded-card bg-pitch-900 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[15px] font-bold text-white">Transfer window open</p>
        <span className="rounded-full bg-theme-primary/15 px-2.5 py-1 text-xs font-bold text-theme-primary">
          {left <= 1 ? "Deadline Day next" : `${left} rounds left`}
        </span>
      </div>
      {deals.length ? (
        <ul className="mt-1 divide-y divide-[color:var(--fl-line)]">
          {deals.slice(0, 3).map((d) => (
            <DealRow key={`${d.playerId}-${d.at}`} d={d} />
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-[color:var(--fl-muted)]">Clubs are circling. Deals land after every round.</p>
      )}
      <GameButton
        size="sm"
        variant="secondary"
        className="mt-3"
        onClick={() => {
          playUiClick();
          onOpenMarket();
        }}
      >
        Transfer market
      </GameButton>
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
      <p className="mt-1 text-xs text-[color:var(--fl-muted)]">The offer lapses once you play the next game.</p>
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
          No deals yet. The mid-season window opens after Round 10 and closes on Deadline Day, before Round {WINDOW_CLOSES_BEFORE_ROUND}.
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
