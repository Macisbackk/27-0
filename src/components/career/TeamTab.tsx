"use client";

import { useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { MobileBottomSheet } from "@/components/ui/MobileOverlay";
import {
  BENCH_SIZE,
  LINEUP_SLOTS,
  POS_LABEL,
  clubRating,
  contractLabel,
  contractOf,
  effectiveRating,
  slotPenalty,
  potentialStars,
  squadOf,
  userBench,
  type CareerPlayer,
} from "@/lib/career";
import { useCareer } from "@/lib/career/context";
import { playAutofill, playPlayerSelect } from "@/lib/sound";
import { Card, Eyebrow, RatingPill, Stars } from "./bits";
import { WindowStatusLine } from "./TransferNews";

/** Which shirt the picker is filling: XIII slot 0–12 or bench spot 0–3. */
type ShirtPick = { kind: "xiii" | "bench"; index: number };

function Tags({ p }: { p: CareerPlayer }) {
  return (
    <>
      {p.legend ? <span className="ml-1.5 text-[10px] font-bold uppercase text-accent-gold">Legend</span> : null}
      {p.academy ? <span className="ml-1.5 text-[10px] font-bold uppercase text-sky-300">Academy</span> : null}
      {p.ban ? (
        <span className="ml-1.5 text-[10px] font-bold uppercase text-danger">
          Banned · {p.ban} game{p.ban > 1 ? "s" : ""}
        </span>
      ) : null}
    </>
  );
}

export function TeamTab() {
  const { state, setLineupSlot, setBenchSlot, autoPick } = useCareer();
  const [pick, setPick] = useState<ShirtPick | null>(null);
  const s = state!;
  const squad = squadOf(s, s.userClubId);
  const bench = userBench(s);
  const inXiii = new Set(s.lineup);
  const onBench = new Set(bench);
  const others = squad.filter((p) => !inXiii.has(p.id) && !onBench.has(p.id)).sort((a, b) => b.rating - a.rating);
  const rating = clubRating(s, s.userClubId);

  // XIII shirts sort by fit for the slot. Bench spots list the rest of the squad first, then the
  // other bench men, then starters (by rating: a bench man covers anywhere).
  const pickSlot = pick?.kind === "xiii" ? LINEUP_SLOTS[pick.index]! : null;
  const fit = (p: CareerPlayer) => (pickSlot ? effectiveRating(p, pickSlot) : p.rating);
  const group = (p: CareerPlayer) => (p.ban ? 3 : pick?.kind !== "bench" ? 0 : inXiii.has(p.id) ? 2 : onBench.has(p.id) ? 1 : 0);
  const candidates = pick ? [...squad].sort((a, b) => group(a) - group(b) || fit(b) - fit(a)) : [];
  const currentId = pick ? (pick.kind === "xiii" ? s.lineup[pick.index] : bench[pick.index]) : undefined;
  const sheetTitle = !pick
    ? ""
    : pick.kind === "xiii"
      ? `Shirt ${pick.index + 1} · ${POS_LABEL[LINEUP_SLOTS[pick.index]!]}`
      : `Shirt ${14 + pick.index} · Interchange`;

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Transfer window" className="rounded-card bg-pitch-900 px-4 py-2.5">
        <WindowStatusLine />
      </section>
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
            const penalty = p ? slotPenalty(p, pos) : 0;
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setPick({ kind: "xiii", index: i })}
                  className="flex w-full items-center gap-3 py-2 text-left hover:bg-pitch-800/60"
                  aria-label={`Shirt ${i + 1}, ${POS_LABEL[pos]}: ${p?.name ?? "empty"}. Tap to change.`}
                >
                  <span className="w-6 text-right font-display text-sm font-bold text-gray-500">{i + 1}</span>
                  <span className="w-8 text-[11px] font-bold uppercase text-theme-primary">{pos}</span>
                  <span className="min-w-0 flex-1 break-words leading-tight text-white">
                    {p?.name ?? "—"}
                    {p ? <Tags p={p} /> : null}
                    {penalty ? <span className="ml-1.5 text-[10px] text-danger">Out of position ({p!.pos})</span> : null}
                    {p && contractOf(p) <= 1 ? <span className="ml-1.5 text-[10px] font-bold text-amber-300">Final year</span> : null}
                  </span>
                  {p ? <RatingPill rating={p.rating - penalty} delta={penalty || undefined} /> : null}
                </button>
              </li>
            );
          })}
        </ol>

        <section aria-label="Interchange" data-testid="interchange" className="mt-3 border-t border-pitch-700 pt-3">
          <Eyebrow>Interchange</Eyebrow>
          <ol className="mt-1 divide-y divide-pitch-800">
            {Array.from({ length: BENCH_SIZE }, (_, i) => {
              const p = s.players[bench[i] ?? ""];
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setPick({ kind: "bench", index: i })}
                    className="flex w-full items-center gap-3 py-2 text-left hover:bg-pitch-800/60"
                    aria-label={`Shirt ${14 + i}, interchange: ${p?.name ?? "empty"}. Tap to change.`}
                  >
                    <span className="w-6 text-right font-display text-sm font-bold text-gray-500">{14 + i}</span>
                    <span className="w-8 text-[11px] font-bold uppercase text-gray-400">{p?.pos ?? "—"}</span>
                    <span className="min-w-0 flex-1 break-words leading-tight text-white">
                      {p?.name ?? "Empty"}
                      {p ? <Tags p={p} /> : null}
                    </span>
                    {p ? <RatingPill rating={p.rating} /> : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
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
                  <Tags p={p} />
                </span>
                <span className="text-[11px] text-gray-500">
                  Age {p.age} · <span className={contractOf(p) <= 1 ? "text-amber-300" : ""}>{contractLabel(contractOf(p))}</span>
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

      <MobileBottomSheet open={pick != null} onClose={() => setPick(null)} title={sheetTitle}>
        <ul className="divide-y divide-pitch-800">
          {candidates.map((p) => {
            const eff = fit(p);
            const current = currentId === p.id;
            const xiiiAt = s.lineup.indexOf(p.id);
            const benchAt = bench.indexOf(p.id);
            // Where the man being replaced ends up, and how he rates there, before you confirm.
            const outgoing = currentId ? s.players[currentId] : undefined;
            const movesTo = xiiiAt >= 0 ? LINEUP_SLOTS[xiiiAt]! : null;
            const outEff = outgoing && movesTo ? effectiveRating(outgoing, movesTo) : null;
            const swapNote = !outgoing
              ? ""
              : movesTo
                ? ` · ${outgoing.name} to ${movesTo} (${outEff}${outEff! < outgoing.rating ? ", out of position" : ""})`
                : benchAt >= 0
                  ? ` · ${outgoing.name} to the bench`
                  : ` · ${outgoing.name} to the squad`;
            const where = p.ban
              ? `Banned · ${p.ban} game${p.ban > 1 ? "s" : ""}`
              : current
                ? "Selected here"
                : xiiiAt >= 0
                  ? `In the XIII (#${xiiiAt + 1})${swapNote}`
                  : benchAt >= 0
                    ? `On the bench (#${14 + benchAt})${swapNote}`
                    : `Age ${p.age}${swapNote}`;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={current || !!p.ban}
                  onClick={() => {
                    playPlayerSelect();
                    if (pick!.kind === "xiii") setLineupSlot(pick!.index, p.id);
                    else setBenchSlot(pick!.index, p.id);
                    setPick(null);
                  }}
                  className="flex w-full items-center gap-3 px-1 py-2.5 text-left hover:bg-pitch-800/60 disabled:opacity-50"
                >
                  <span className="w-8 text-[11px] font-bold uppercase text-gray-400">{p.pos}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words leading-tight text-white">
                      {p.name}
                      {eff < p.rating ? <span className="ml-1.5 text-[10px] text-danger">Out of position</span> : null}
                    </span>
                    <span className="text-[11px] text-gray-500">{where}</span>
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
