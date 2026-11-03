"use client";

import { useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { GameSegmentedControl } from "@/components/ui/GameSegmentedControl";
import {
  ACADEMY_LEAVE_AGE,
  BENCH_SIZE,
  CAPTAIN_BOOST,
  LINEUP_SLOTS,
  POS_LABEL,
  SQUAD_MAX,
  academyPlayers,
  chosenCaptain,
  clubRating,
  formatMoney,
  promotionCost,
  userCaptain,
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
import { ManagerSheet } from "./Sheet";

/** The Team tab in three short views instead of one long scroll (v1.57). */
type TeamView = "matchday" | "squad" | "academy";
/** Remembered while the hub is open, so coming back to Team shows the same view. */
let lastTeamView: TeamView = "matchday";

/** Which shirt the picker is filling: XIII slot 0–12 or bench spot 0–3. */
type ShirtPick = { kind: "xiii" | "bench"; index: number };

function Tags({ p, captain }: { p: CareerPlayer; captain?: boolean }) {
  return (
    <>
      {captain ? (
        <span className="ml-1.5 whitespace-nowrap rounded bg-accent-gold/20 px-1 text-[10px] font-bold text-accent-gold" title="Captain" aria-label="Captain">
          C
        </span>
      ) : null}
      {p.legend ? <span className="ml-1.5 whitespace-nowrap text-[10px] font-bold uppercase text-accent-gold">Legend</span> : null}
      {p.academy ? <span className="ml-1.5 whitespace-nowrap text-[10px] font-bold uppercase text-sky-300">Academy</span> : null}
      {p.ban ? (
        <span className="ml-1.5 whitespace-nowrap text-[10px] font-bold uppercase text-danger">
          Banned · {p.ban} game{p.ban > 1 ? "s" : ""}
        </span>
      ) : null}
      {p.injury ? (
        <span className="ml-1.5 whitespace-nowrap rounded bg-danger/15 px-1 text-[10px] font-bold uppercase text-danger" data-testid="injury-badge" title={`Injured: out for ${p.injury} game${p.injury > 1 ? "s" : ""}`}>
          ✚ Injured · {p.injury}
        </span>
      ) : null}
      {p.grew ? (
        <span className={`ml-1.5 whitespace-nowrap text-[10px] font-bold tabular-nums ${p.grew > 0 ? "text-success" : "text-gray-500"}`} title="Rating change since last season" data-testid="growth-badge">
          {p.grew > 0 ? `+${p.grew}` : p.grew}
        </span>
      ) : null}
    </>
  );
}

/** The academy list: promote a prospect to the squad, release him, or leave him to grow. */
function AcademyCard() {
  const { state, promoteAcademy, releaseAcademy } = useCareer();
  const [message, setMessage] = useState<string | null>(null);
  const [confirmRelease, setConfirmRelease] = useState<string | null>(null);
  const s = state!;
  const kids = academyPlayers(s).sort((a, b) => b.potential - a.potential || b.rating - a.rating);
  const squadSize = s.clubs[s.userClubId]!.squad.length;
  const full = squadSize >= SQUAD_MAX;
  return (
    <Card>
      <section aria-label="Academy" data-testid="academy">
        <Eyebrow>Academy · {kids.length}</Eyebrow>
        <p className="mt-1 text-xs text-gray-400">
          New kids join every pre-season. Promote them to play. First-team games help them grow. They leave at {ACADEMY_LEAVE_AGE}.
        </p>
        {/* Same room whether or not there's news, so the list doesn't jump on a tap. */}
        <p className={`mt-1 flex min-h-[2.25rem] items-center justify-center text-center text-[13px] leading-snug ${message ? "font-semibold text-theme-primary" : "text-gray-500"}`} role="status">
          {message ?? (kids.length ? "Promote to play him. Release to free a place." : "")}
        </p>
        {kids.length ? (
          <ul className="divide-y divide-pitch-800">
            {kids.map((p) => {
              const cost = promotionCost(s, p);
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2">
                  <span className="w-8 text-[11px] font-bold uppercase text-gray-400">{p.pos}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words leading-tight text-white">{p.name}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                      Age {p.age} · <Stars value={potentialStars(p.potential)} label={`Potential ${potentialStars(p.potential)} stars`} />
                    </span>
                  </span>
                  <RatingPill rating={p.rating} />
                  <span className="flex w-full justify-end gap-2 sm:w-auto">
                    <GameButton
                      size="sm"
                      fullWidth={false}
                      disabled={full}
                      onClick={() => {
                        const err = promoteAcademy(p.id);
                        setConfirmRelease(null);
                        setMessage(
                          err === "squad-full"
                            ? `Squad full (${SQUAD_MAX}). Sell or release someone first.`
                            : err === "budget"
                              ? `Not enough budget for his wages (${formatMoney(cost)}).`
                              : err
                                ? "Can't promote him right now."
                                : `${p.name} joins the squad.`
                        );
                      }}
                    >
                      Promote
                    </GameButton>
                    <GameButton
                      size="sm"
                      variant={confirmRelease === p.id ? "danger" : "secondary"}
                      fullWidth={false}
                      onClick={() => {
                        if (confirmRelease !== p.id) {
                          setConfirmRelease(p.id);
                          return;
                        }
                        releaseAcademy(p.id);
                        setConfirmRelease(null);
                        setMessage(`${p.name} released.`);
                      }}
                    >
                      {confirmRelease === p.id ? "Sure?" : "Release"}
                    </GameButton>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-center text-sm text-gray-400">No prospects right now.</p>
        )}
        {full && kids.length ? <p className="mt-2 text-center text-[11px] text-amber-300">Squad full ({SQUAD_MAX}). Make room to promote.</p> : null}
      </section>
    </Card>
  );
}

export function TeamTab() {
  const { state, setLineupSlot, setBenchSlot, autoPick, setCaptain } = useCareer();
  const [pick, setPick] = useState<ShirtPick | null>(null);
  const [pickCaptain, setPickCaptain] = useState(false);
  const [view, setViewState] = useState<TeamView>(lastTeamView);
  const setView = (v: TeamView) => {
    lastTeamView = v;
    setViewState(v);
  };
  const s = state!;
  const captainId = chosenCaptain(s);
  const leader = userCaptain(s);
  const captain = captainId ? s.players[captainId] : undefined;
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
  const group = (p: CareerPlayer) => (p.ban || p.injury ? 3 : pick?.kind !== "bench" ? 0 : inXiii.has(p.id) ? 2 : onBench.has(p.id) ? 1 : 0);
  const candidates = pick ? [...squad].sort((a, b) => group(a) - group(b) || fit(b) - fit(a)) : [];
  const currentId = pick ? (pick.kind === "xiii" ? s.lineup[pick.index] : bench[pick.index]) : undefined;
  const sheetTitle = !pick
    ? ""
    : pick.kind === "xiii"
      ? `Shirt ${pick.index + 1} · ${POS_LABEL[LINEUP_SLOTS[pick.index]!]}`
      : `Shirt ${14 + pick.index}`;

  return (
    <div className="flex flex-col gap-4">
      <GameSegmentedControl<TeamView>
        options={[
          { id: "matchday", label: "Starting 17" },
          { id: "squad", label: `Squad · ${others.length}` },
          { id: "academy", label: "Academy" },
        ]}
        value={view}
        onChange={setView}
        fullWidth
        ariaLabel="Team sections"
      />
      <section aria-label="Transfer window" className="rounded-card bg-pitch-900 px-4 py-2.5">
        <WindowStatusLine />
      </section>
      {view === "matchday" ? (
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
        <div className="mt-3 flex items-center justify-between gap-2 rounded-control bg-pitch-950 px-3 py-2" data-testid="captain">
          <p className="min-w-0 text-sm text-gray-300">
            <span className="font-semibold text-white">Captain:</span> {captain?.name ?? "—"}
            {leader && leader !== captainId ? (
              <span className="block text-[11px] text-amber-300">{s.players[leader]?.name} leads while he&apos;s out.</span>
            ) : (
              <span className="block text-[11px] text-gray-500">+{CAPTAIN_BOOST} team rating when he plays.</span>
            )}
          </p>
          <GameButton size="sm" variant="secondary" fullWidth={false} className="shrink-0 whitespace-nowrap" onClick={() => setPickCaptain(true)}>
            Change
          </GameButton>
        </div>
        <ol className="mt-2 divide-y divide-pitch-800">
          {LINEUP_SLOTS.map((pos, i) => {
            const p = s.players[s.lineup[i] ?? ""];
            const penalty = p ? slotPenalty(p, pos) : 0;
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setPick({ kind: "xiii", index: i })}
                  className="flex min-h-[44px] w-full items-center gap-3 py-2 text-left hover:bg-pitch-800/60"
                  aria-label={`Shirt ${i + 1}, ${POS_LABEL[pos]}: ${p?.name ?? "empty"}. Tap to change.`}
                >
                  <span className="w-6 text-right font-display text-sm font-bold text-gray-500">{i + 1}</span>
                  <span className="w-8 text-[11px] font-bold uppercase text-theme-primary">{pos}</span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block break-words text-white">
                      {p?.name ?? "—"}
                      {p ? <Tags p={p} captain={p.id === leader} /> : null}
                    </span>
                    {/* Notes on their own line, so the name never breaks around them. */}
                    {penalty || (p && contractOf(p) <= 1) ? (
                      <span className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] font-bold">
                        {penalty ? <span className="text-danger">Out of position ({p!.pos})</span> : null}
                        {p && contractOf(p) <= 1 ? <span className="text-amber-300">Final year</span> : null}
                      </span>
                    ) : null}
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
                    className="flex min-h-[44px] w-full items-center gap-3 py-2 text-left hover:bg-pitch-800/60"
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
      ) : null}

      {view === "squad" ? (
      <Card>
        <Eyebrow>Rest of the squad · {others.length}</Eyebrow>
        <p className="mt-1 text-xs text-gray-400">Not in your matchday 17. Pick them from a shirt on Starting 17.</p>
        <ul className="mt-2 divide-y divide-pitch-800">
          {others.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2">
              <span className="w-8 text-[11px] font-bold uppercase text-gray-400">{p.pos}</span>
              <span className="min-w-0 flex-1">
                <span className="block break-words leading-tight text-white">
                  {p.name}
                  <Tags p={p} />
                </span>
                <span className="block text-[11px] leading-snug text-gray-500">
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
      ) : null}

      {view === "academy" ? <AcademyCard /> : null}

      <ManagerSheet list open={pickCaptain} onClose={() => setPickCaptain(false)} eyebrow={`Captain · +${CAPTAIN_BOOST} team rating`} title="Pick your captain">
        <ul className="divide-y divide-pitch-800">
          {[...squad]
            .sort((a, b) => Number(inXiii.has(b.id)) - Number(inXiii.has(a.id)) || b.rating - a.rating)
            .map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={p.id === captainId}
                  onClick={() => {
                    playPlayerSelect();
                    setCaptain(p.id);
                    setPickCaptain(false);
                  }}
                  className="flex w-full items-center gap-3 px-1 py-2.5 text-left hover:bg-pitch-800/60 disabled:opacity-50"
                >
                  <span className="w-8 text-[11px] font-bold uppercase text-gray-400">{p.pos}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words leading-tight text-white">{p.name}</span>
                    <span className="block text-[11px] leading-snug text-gray-500">
                      {p.id === captainId ? "Captain" : inXiii.has(p.id) ? "In the XIII" : "Not in the XIII"} · Age {p.age}
                    </span>
                  </span>
                  <RatingPill rating={p.rating} />
                </button>
              </li>
            ))}
        </ul>
      </ManagerSheet>

      <ManagerSheet list open={pick != null} onClose={() => setPick(null)} eyebrow={pick?.kind === "bench" ? "Interchange" : "Starting XIII"} title={sheetTitle}>
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
              : p.injury
                ? `Injured · out for ${p.injury} game${p.injury > 1 ? "s" : ""}`
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
                  disabled={current || !!p.ban || !!p.injury}
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
                      {eff < p.rating ? <span className="ml-1.5 whitespace-nowrap text-[10px] text-danger">Out of position</span> : null}
                    </span>
                    <span className="block text-[11px] leading-snug text-gray-500">{where}</span>
                  </span>
                  <RatingPill rating={eff} delta={p.rating - eff || undefined} />
                </button>
              </li>
            );
          })}
        </ul>
      </ManagerSheet>
    </div>
  );
}
