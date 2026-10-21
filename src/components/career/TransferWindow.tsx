"use client";

import { useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { GameSegmentedControl } from "@/components/ui/GameSegmentedControl";
import {
  SQUAD_MAX,
  SQUAD_MIN,
  formatMoney,
  legendAsPlayer,
  legendById,
  potentialStars,
  prestigeRatingCap,
  sellPrice,
  squadOf,
  type MarketListing,
  type TransferError,
} from "@/lib/career";
import { useCareer } from "@/lib/career/context";
import { playLegendAppears, playSeasonStart, playTransferComplete, playWarning } from "@/lib/sound";
import { Card, ClubBadge, Eyebrow, RatingPill, Stars } from "./bits";

const ERROR_TEXT: Record<TransferError, string> = {
  budget: "Not enough budget for that deal.",
  "squad-full": `Squad is full (${SQUAD_MAX}). Sell someone first.`,
  "squad-min": `You need at least ${SQUAD_MIN} players.`,
  "not-available": "That player is no longer available.",
  lineup: "Couldn't update the team.",
};

export function TransferWindow() {
  const { state, market, buy, sell, finishTransfers } = useCareer();
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
      setMessage(`Signed ${s.players[l.playerId]?.name ?? "a legend"}!`);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-28">
      <header className="text-center">
        <Eyebrow>Transfer window · before {s.year}</Eyebrow>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white">Build your squad</h1>
      </header>

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
          Players rated up to <span className="font-semibold text-white">{prestigeRatingCap(s.prestige)}</span> will join a club of your prestige. Unlocked legends always will.
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
        <ul className="grid gap-2">
          {market.length === 0 ? <li className="text-center text-sm text-gray-400">No players available right now.</li> : null}
          {market.map((l) => {
            const card = l.legend ? legendById(l.playerId.replace(/^legend-/, "")) : undefined;
            const p = s.players[l.playerId] ?? (card ? legendAsPlayer(card) : undefined);
            const from = l.fromClubId ? s.clubs[l.fromClubId] : null;
            const affordable = s.budget >= l.price;
            return (
              <li key={l.playerId} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${l.legend ? "border-accent-gold/60 bg-accent-gold/5" : "border-pitch-700 bg-pitch-900/80"}`}>
                {from ? <ClubBadge club={from} size="sm" /> : <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-pitch-700 text-[10px] font-bold text-gray-300">{l.legend ? "★" : "FA"}</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-white">
                    {p?.name ?? "Unknown"}
                    {l.legend ? <span className="ml-1.5 text-[10px] font-bold uppercase text-accent-gold">Legend</span> : null}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {p ? `${p.pos} · Age ${p.age}` : ""}
                    {card ? ` · ${card.club} great` : ""}
                    {p && p.age <= 21 ? <> · <Stars value={potentialStars(p.potential)} /></> : null}
                    {from ? ` · ${from.short}` : l.legend ? "" : " · Free agent"}
                  </span>
                </span>
                {p ? <RatingPill rating={p.rating} /> : null}
                <GameButton size="sm" fullWidth={false} variant={affordable ? "theme" : "secondary"} disabled={!affordable} onClick={() => onBuy(l)}>
                  {formatMoney(l.price)}
                </GameButton>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="grid gap-2">
          {squad.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl border border-pitch-700 bg-pitch-900/80 px-3 py-2.5">
              <span className="w-8 text-[11px] font-bold uppercase text-gray-400">{p.pos}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-white">
                  {p.name}
                  {p.legend ? <span className="ml-1.5 text-[10px] font-bold uppercase text-accent-gold">Legend</span> : null}
                  {p.academy ? <span className="ml-1.5 text-[10px] font-bold uppercase text-sky-300">Academy</span> : null}
                </span>
                <span className="text-[11px] text-gray-400">Age {p.age}{p.age <= 21 ? <> · <Stars value={potentialStars(p.potential)} /></> : null}</span>
              </span>
              <RatingPill rating={p.rating} />
              <GameButton
                size="sm"
                variant="secondary"
                fullWidth={false}
                disabled={me.squad.length <= SQUAD_MIN}
                onClick={() => {
                  const err = sell(p.id);
                  if (err) {
                    playWarning();
                    setMessage(ERROR_TEXT[err]);
                  } else {
                    playTransferComplete();
                    setMessage(`Sold ${p.name}.`);
                  }
                }}
              >
                Sell {formatMoney(sellPrice(s, p.id))}
              </GameButton>
            </li>
          ))}
        </ul>
      )}

      <div className="mobile-action-bar sm:static sm:border-0 sm:bg-transparent sm:p-0" role="toolbar">
        <div className="mobile-action-bar__inner">
          <GameButton
            size="lg"
            onClick={() => {
              playSeasonStart();
              finishTransfers();
            }}
          >
            Start the {s.year} season
          </GameButton>
        </div>
      </div>
    </div>
  );
}
