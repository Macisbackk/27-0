"use client";

import { useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { MobileBottomSheet } from "@/components/ui/MobileOverlay";
import {
  LINEUP_SLOTS,
  POS_LABEL,
  effectiveRating,
  lineupRating,
  positionPenalty,
  potentialStars,
  squadOf,
} from "@/lib/career";
import { useCareer } from "@/lib/career/context";
import { playAutofill, playPlayerSelect } from "@/lib/sound";
import { Card, Eyebrow, RatingPill, Stars } from "./bits";

export function TeamTab() {
  const { state, setLineupSlot, autoPick } = useCareer();
  const [slot, setSlot] = useState<number | null>(null);
  const s = state!;
  const squad = squadOf(s, s.userClubId);
  const inXiii = new Set(s.lineup);
  const others = squad.filter((p) => !inXiii.has(p.id)).sort((a, b) => b.rating - a.rating);
  const rating = lineupRating(s.lineup, s.players);

  const pickSlot = slot != null ? LINEUP_SLOTS[slot]! : null;
  const candidates =
    pickSlot != null
      ? [...squad].sort((a, b) => effectiveRating(b, pickSlot) - effectiveRating(a, pickSlot))
      : [];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center justify-between gap-2">
          <div>
            <Eyebrow>Starting XIII</Eyebrow>
            <p className="mt-1 text-sm text-gray-300">
              Team rating <span className="font-display text-lg font-bold text-white">{rating.toFixed(1)}</span>
            </p>
          </div>
          <GameButton
            size="sm"
            variant="secondary"
            fullWidth={false}
            onClick={() => {
              playAutofill();
              autoPick();
            }}
          >
            Auto-pick best
          </GameButton>
        </div>
        <ol className="mt-3 divide-y divide-pitch-800">
          {LINEUP_SLOTS.map((pos, i) => {
            const p = s.players[s.lineup[i] ?? ""];
            const penalty = p ? positionPenalty(p.pos, pos) : 0;
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setSlot(i)}
                  className="flex w-full items-center gap-3 py-2 text-left hover:bg-pitch-800/60"
                  aria-label={`Shirt ${i + 1}, ${POS_LABEL[pos]}: ${p?.name ?? "empty"}. Tap to change.`}
                >
                  <span className="w-6 text-right font-display text-sm font-bold text-gray-500">{i + 1}</span>
                  <span className="w-8 text-[11px] font-bold uppercase text-theme-primary">{pos}</span>
                  <span className="min-w-0 flex-1 break-words leading-tight text-white">
                    {p?.name ?? "—"}
                    {p?.legend ? <span className="ml-1.5 text-[10px] font-bold uppercase text-accent-gold">Legend</span> : null}
                    {p?.academy ? <span className="ml-1.5 text-[10px] font-bold uppercase text-sky-300">Academy</span> : null}
                    {penalty ? <span className="ml-1.5 text-[10px] text-danger">plays {p!.pos}</span> : null}
                  </span>
                  {p ? <RatingPill rating={p.rating - penalty} delta={penalty || undefined} /> : null}
                </button>
              </li>
            );
          })}
        </ol>
      </Card>

      <Card>
        <Eyebrow>Rest of the squad · {others.length}</Eyebrow>
        <ul className="mt-2 divide-y divide-pitch-800">
          {others.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2">
              <span className="w-8 text-[11px] font-bold uppercase text-gray-400">{p.pos}</span>
              <span className="min-w-0 flex-1">
                <span className="block break-words leading-tight text-white">
                  {p.name}
                  {p.legend ? <span className="ml-1.5 text-[10px] font-bold uppercase text-accent-gold">Legend</span> : null}
                  {p.academy ? <span className="ml-1.5 text-[10px] font-bold uppercase text-sky-300">Academy</span> : null}
                </span>
                <span className="text-[11px] text-gray-500">
                  Age {p.age}
                  {p.apps ? ` · ${p.apps} apps, ${p.tries} tries` : ""}
                  {p.age <= 21 ? (
                    <span className="ml-2 inline-flex items-center gap-1">
                      Potential <Stars value={potentialStars(p.potential)} label={`Potential ${potentialStars(p.potential)} stars`} />
                    </span>
                  ) : null}
                </span>
              </span>
              <RatingPill rating={p.rating} />
            </li>
          ))}
        </ul>
      </Card>

      <MobileBottomSheet
        open={slot != null}
        onClose={() => setSlot(null)}
        title={slot != null ? `Shirt ${slot + 1} · ${POS_LABEL[LINEUP_SLOTS[slot]!]}` : ""}
      >
        <ul className="divide-y divide-pitch-800">
          {candidates.map((p) => {
            const eff = effectiveRating(p, pickSlot!);
            const current = s.lineup[slot ?? -1] === p.id;
            const elsewhere = !current && inXiii.has(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={current}
                  onClick={() => {
                    playPlayerSelect();
                    setLineupSlot(slot!, p.id);
                    setSlot(null);
                  }}
                  className="flex w-full items-center gap-3 px-1 py-2.5 text-left hover:bg-pitch-800/60 disabled:opacity-50"
                >
                  <span className="w-8 text-[11px] font-bold uppercase text-gray-400">{p.pos}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words leading-tight text-white">{p.name}</span>
                    <span className="text-[11px] text-gray-500">
                      {current ? "Selected here" : elsewhere ? `In the XIII (#${s.lineup.indexOf(p.id) + 1}) — will swap` : `Age ${p.age}`}
                    </span>
                  </span>
                  <RatingPill rating={eff} delta={p.rating - eff || undefined} />
                </button>
              </li>
            );
          })}
        </ul>
      </MobileBottomSheet>
    </div>
  );
}
