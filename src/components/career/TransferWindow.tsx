"use client";

import { useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { useArmed } from "@/hooks/useArmed";
import { GameSegmentedControl } from "@/components/ui/GameSegmentedControl";
import {
  SQUAD_MAX,
  SQUAD_MIN,
  formatMoney,
  legendAsPlayer,
  legendById,
  potentialStars,
  prestigeRatingCap,
  WINDOW_CLOSES_BEFORE_ROUND,
  deadlineDecisionPending,
  isFreeAgentListing,
  sellPrice,
  signingCost,
  squadOf,
  wagesDueNow,
  type MarketListing,
  type TransferError,
} from "@/lib/career";
import { useCareer } from "@/lib/career/context";
import { playLegendAppears, playSeasonStart, playTransferComplete, playWarning } from "@/lib/sound";
import { Card, ClubBadge, RatingPill, Stars, CAREER_PAGE_CLASS, CareerBackLink } from "./bits";
import { ClubLink } from "./ClubSheet";
import { DeadlineClockFace, DeadlineOffers } from "./TransferNews";
import { ShirtGlyph } from "@/components/icons/rugby-icons";
import { PitchHero } from "@/components/ui/PitchHero";

const ERROR_TEXT: Record<TransferError, string> = {
  budget: "Not enough budget for that deal.",
  "squad-full": `Squad is full (${SQUAD_MAX}). Sell someone first.`,
  "squad-min": `You need at least ${SQUAD_MIN} players.`,
  "not-available": "That player is no longer available.",
  lineup: "Couldn't update the team.",
  "window-shut": "The transfer window is shut.",
};

/** £45k → "£45k/yr wages". */
const wagesText = (n: number) => `${formatMoney(n)}/yr wages`;

/**
 * The market. `summer` = the summer window screen (after departures); `preseason` = the same
 * window reached from the pre-season hub; `deadline` = Deadline Day.
 */
export function TransferWindow({ mode = "summer", onClose }: { mode?: "summer" | "preseason" | "deadline"; onClose?: () => void } = {}) {
  const midseason = mode === "deadline";
  const { state, market, buy, sell, finishTransfers } = useCareer();
  const armed = useArmed();
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [message, setMessage] = useState<string | null>(null);
  const s = state!;
  const me = s.clubs[s.userClubId]!;
  const squad = squadOf(s, s.userClubId).sort((a, b) => a.rating - b.rating);

  const onBuy = (l: MarketListing) => {
    const err = buy(l);
    if (err) {
      playWarning();
      setMessage(ERROR_TEXT[err]);
    } else {
      if (l.legend) playLegendAppears();
      else playTransferComplete();
      const name = s.players[l.playerId]?.name ?? legendById(l.playerId.replace(/^legend-/, ""))?.name ?? "a legend";
      setMessage(isFreeAgentListing(l) ? `Signed ${name} on a free (${wagesText(l.wages)}).` : `Signed ${name}!`);
    }
  };

  return (
    <div className={CAREER_PAGE_CLASS}>
      {mode !== "summer" && onClose ? (
        <nav aria-label="Manager navigation" className="-mb-2 flex">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[40px] items-center gap-1 rounded-full px-2 text-sm font-semibold text-gray-300 hover:bg-pitch-800 hover:text-white"
          >
            <span aria-hidden>‹</span> Manager hub
          </button>
        </nav>
      ) : (
        <CareerBackLink label="Home (progress saved)" />
      )}
      <PitchHero
        icon={<ShirtGlyph />}
        eyebrow={
          midseason ? `Deadline Day · before Round ${WINDOW_CLOSES_BEFORE_ROUND}` : mode === "preseason" ? <>Transfer window · pre-season {s.year}</> : <>Transfer window · before {s.year}</>
        }
        title={midseason ? "Last chance" : "Build your squad"}
      />

      {midseason && deadlineDecisionPending(s) ? (
        <section aria-label="Deadline Day clock" className="flex flex-col gap-3 rounded-card bg-pitch-900 p-3 ring-2 ring-amber-300/60">
          <DeadlineClockFace compact />
          <DeadlineOffers />
        </section>
      ) : null}

      <Card className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Budget</p>
          <p className={`font-display text-xl font-bold ${s.budget < 0 ? "text-danger" : "text-white"}`}>{formatMoney(s.budget)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Squad</p>
          <p className="font-display text-xl font-bold text-white">{me.squad.length}<span className="text-sm text-gray-500">/{SQUAD_MAX}</span></p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Prestige</p>
          <p className="mt-1"><Stars value={s.prestige} /></p>
        </div>
        <p className="col-span-3 text-xs text-gray-400">
          Players rated up to <span className="font-semibold text-white">{prestigeRatingCap(s.prestige)}</span> will join you. Free agents and legends always will.
        </p>
        <p className="col-span-3 text-xs text-gray-400" data-testid="wage-note">
          Free agents cost no fee, only wages.{" "}
          {mode === "summer"
            ? "Wages go on the bill when the season starts."
            : "The rest of this season's wages are paid when he signs, and saved when a player leaves."}
        </p>
      </Card>

      <GameSegmentedControl<"buy" | "sell">
        options={[
          { id: "buy", label: "Buy" },
          { id: "sell", label: "Sell" },
        ]}
        value={tab}
        onChange={(t) => {
          setTab(t);
          setMessage(null);
        }}
        ariaLabel="Transfers"
      />
      {message ? <p className="text-center text-sm text-theme-primary" role="status">{message}</p> : null}

      {tab === "buy" ? (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
          {market.length === 0 ? <li className="text-center text-sm text-gray-400">No players available right now.</li> : null}
          {market.map((l) => {
            const card = l.legend ? legendById(l.playerId.replace(/^legend-/, "")) : undefined;
            const p = s.players[l.playerId] ?? (card ? legendAsPlayer(card) : undefined);
            const from = l.fromClubId ? s.clubs[l.fromClubId] : null;
            const free = isFreeAgentListing(l);
            const cost = signingCost(s, l);
            const affordable = s.budget >= cost.total;
            const dueNow = cost.wagesNow > 0 ? ` · ${formatMoney(cost.wagesNow)} due now` : "";
            return (
              <li key={l.playerId} data-free-agent={free ? "true" : undefined} className={`flex items-center gap-3 rounded-tile px-3 py-2.5 text-left ${l.legend ? "bg-pitch-900 ring-1 ring-accent-gold/60" : "bg-pitch-900"}`}>
                {from ? <ClubBadge club={from} size="sm" /> : <span title={l.legend ? "Legend" : "Free agent"} aria-label={l.legend ? "Legend" : "Free agent"} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-pitch-700 text-[10px] font-bold text-gray-300">{l.legend ? "★" : "FA"}</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-white">
                    {p?.name ?? "Unknown"}
                    {l.legend ? <span className="ml-1.5 text-[10px] font-bold uppercase text-accent-gold">Legend</span> : null}
                  </span>
                  <span className="block text-[11px] text-gray-400">
                    {p ? `${p.pos} · Age ${p.age}` : ""}
                    {card ? ` · ${card.club} great` : ""}
                    {p && p.age <= 21 ? <> · <Stars value={potentialStars(p.potential)} /></> : null}
                    {from ? <> · <ClubLink clubId={from.id}>{from.short}</ClubLink></> : l.legend ? "" : " · Free agent"}
                  </span>
                  <span className="block text-[11px] text-gray-400">
                    {free ? (
                      <><span className="font-semibold text-success">Free</span> · {wagesText(l.wages)}{dueNow}</>
                    ) : (
                      <>{l.legend ? "Signing fee" : "Fee"} {formatMoney(l.price)} · {wagesText(l.wages)}{dueNow}</>
                    )}
                  </span>
                </span>
                {p ? <RatingPill rating={p.rating} /> : null}
                <GameButton size="sm" fullWidth={false} variant={affordable ? "theme" : "secondary"} disabled={!affordable} onClick={() => onBuy(l)}>
                  {free ? "Free" : formatMoney(l.price)}
                </GameButton>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
          {squad.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-tile bg-pitch-900 px-3 py-2.5 text-left">
              <span className="w-8 text-[11px] font-bold uppercase text-gray-400">{p.pos}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-white">
                  {p.name}
                  {p.legend ? <span className="ml-1.5 text-[10px] font-bold uppercase text-accent-gold">Legend</span> : null}
                  {p.academy ? <span className="ml-1.5 text-[10px] font-bold uppercase text-sky-300">Academy</span> : null}
                </span>
                <span className="text-[11px] text-gray-400">
                  Age {p.age}
                  {p.age <= 21 ? <> · <Stars value={potentialStars(p.potential)} /></> : null}
                  {wagesDueNow(s, p) > 0 ? ` · saves ${formatMoney(wagesDueNow(s, p))} wages` : ""}
                </span>
              </span>
              <RatingPill rating={p.rating} />
              <GameButton
                size="sm"
                variant="secondary"
                fullWidth={false}
                disabled={me.squad.length <= SQUAD_MIN}
                onClick={() => {
                  const r = sell(p.id);
                  if (r.error) {
                    playWarning();
                    setMessage(ERROR_TEXT[r.error]);
                  } else {
                    playTransferComplete();
                    const fee = r.fee != null ? ` for ${formatMoney(r.fee)}` : "";
                    const to = r.soldTo ? s.clubs[r.soldTo]?.name : null;
                    setMessage(
                      p.legend
                        ? `Sold ${p.name}${fee}. He goes back to the Legend Vault.`
                        : to
                          ? `${p.name} joins ${to}${fee}. They were ${r.reason ?? "after him"}.`
                          : `Sold ${p.name}${fee}. He's now a free agent.`
                    );
                  }
                }}
              >
                {(() => {
                  const price = sellPrice(s, p.id);
                  return price > 0 ? `Sell ${formatMoney(price)}` : "Let go (free)";
                })()}
              </GameButton>
            </li>
          ))}
        </ul>
      )}

      <div className="mobile-action-bar sm:static sm:border-0 sm:bg-transparent sm:p-0" role="toolbar">
        <div className="mobile-action-bar__inner">
          {mode !== "summer" ? (
            <GameButton size="lg" onClick={() => onClose?.()}>
              {midseason ? "Back to Deadline Day" : "Back to pre-season"}
            </GameButton>
          ) : (
            <GameButton
              size="lg"
              disabled={!armed}
              onClick={() => {
                playSeasonStart();
                finishTransfers();
              }}
            >
              Start {s.year} season
            </GameButton>
          )}
        </div>
      </div>
    </div>
  );
}
