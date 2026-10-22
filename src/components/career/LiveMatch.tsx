"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { repairLineup, sheetFor, type CareerState, type Fixture } from "@/lib/career";
import {
  createLiveMatch,
  liveResult,
  playToEnd,
  resolveCall,
  stepMinute,
  type LiveEvent,
  type LiveMatch as LiveMatchState,
} from "@/lib/career/live-match";
import type { PlayedResult } from "@/lib/career/season";
import { rngFor, type Rng } from "@/lib/career/rng";
import {
  playFullTime,
  playGoldenPointWin,
  playHalfTime,
  playMatchStarted,
  playTryScored,
  playUiClick,
} from "@/lib/sound";
import { ClubBadge } from "./bits";

type Speed = "normal" | "fast";

/** Milliseconds per match minute, and the pause after a try so it lands. */
const TICK: Record<Speed, number> = { normal: 260, fast: 90 };
const TRY_PAUSE: Record<Speed, number> = { normal: 900, fast: 350 };

/**
 * The user's fixture, played live: an 80-minute clock that runs in ~25 seconds,
 * stopping for three big calls (a penalty, the half-time team talk, a late-game call).
 */
export function LiveMatch({
  state,
  fixture,
  onDone,
}: {
  state: CareerState;
  fixture: Fixture;
  onDone: (played: PlayedResult) => void;
}) {
  const rngRef = useRef<Rng | null>(null);
  const matchRef = useRef<LiveMatchState | null>(null);
  const resultRef = useRef<PlayedResult | null>(null);
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [speed, setSpeed] = useState<Speed>("normal");

  if (!rngRef.current || !matchRef.current) {
    const rng = rngFor(state.seed, state.year, fixture.id, "live");
    const lineup = repairLineup(state, state.lineup);
    const sheet = (clubId: string) =>
      clubId === state.userClubId ? { ...sheetFor(state, clubId), lineup } : sheetFor(state, clubId);
    rngRef.current = rng;
    matchRef.current = createLiveMatch({
      home: sheet(fixture.home),
      away: sheet(fixture.away),
      homeName: state.clubs[fixture.home]!.name,
      awayName: state.clubs[fixture.away]!.name,
      userSide: fixture.home === state.userClubId ? "home" : "away",
      knockout: fixture.kind !== "league",
      players: state.players,
      rng,
    });
  }
  const m = matchRef.current;
  const rng = rngRef.current;

  useEffect(() => {
    playMatchStarted();
  }, []);

  // The clock: one minute per tick until a call is waiting or the match ends.
  useEffect(() => {
    if (m.finished || m.pending) return;
    const last = m.events[m.events.length - 1];
    const justScored = last?.kind === "try" && last.minute === m.minute && m.minute > 0;
    const delay = justScored ? TRY_PAUSE[speed] : m.minute === 0 ? 700 : TICK[speed];
    const timer = window.setTimeout(() => {
      const before = m.events.length;
      stepMinute(m, rng, state.players);
      for (const e of m.events.slice(before)) {
        if (e.kind === "try" && e.side === m.userSide) playTryScored();
        if (e.kind === "whistle" && e.minute === 40) playHalfTime();
        if (e.kind === "drop-goal" && m.goldenPoint && e.side === m.userSide) playGoldenPointWin();
      }
      if (m.finished) playFullTime();
      bump();
    });
    return () => window.clearTimeout(timer);
  });

  const choose = (optionId: string) => {
    playUiClick();
    const before = m.events.length;
    resolveCall(m, optionId, rng, state.players);
    if (m.events.slice(before).some((e) => e.kind === "try" && e.side === m.userSide)) playTryScored();
    bump();
  };

  const skip = () => {
    playUiClick();
    playToEnd(m, rng, state.players);
    playFullTime();
    bump();
  };

  const finish = () => {
    if (!resultRef.current) resultRef.current = { fixtureId: fixture.id, result: liveResult(m, rng, state.players) };
    onDone(resultRef.current);
  };

  const home = state.clubs[fixture.home]!;
  const away = state.clubs[fixture.away]!;
  const us = m.userSide === "home" ? m.homeScore : m.awayScore;
  const them = m.userSide === "home" ? m.awayScore : m.homeScore;
  const clock = m.finished ? "FT" : m.minute === 40 && m.pending?.id === "team-talk" ? "HT" : `${m.minute}'`;
  // Momentum from the home side's point of view: + fills left (home), − fills right (away).
  const homeMomentum = m.userSide === "home" ? m.momentum : -m.momentum;
  const feed = [...m.events].reverse().slice(0, 7);

  return (
    <div className="flex flex-col gap-3">
      <section aria-label="Scoreboard" className="rounded-[20px] bg-pitch-900 p-4">
        <div className="flex items-center justify-between text-xs text-[color:var(--fl-muted)]">
          <span>{fixture.label}</span>
          <span className={`rounded-full px-2.5 py-1 font-bold tabular-nums ${m.finished ? "bg-pitch-950 text-white" : "bg-theme-primary/15 text-theme-primary"}`}>
            {clock}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <div className="flex min-w-0 flex-col items-center gap-1 text-center">
            <ClubBadge club={home} />
            <span className="w-full truncate text-xs font-semibold text-white">{home.name}</span>
          </div>
          <p className="fl-number text-[44px] leading-none tabular-nums text-white" aria-live="polite">
            {m.homeScore}
            <span className="mx-1.5 text-[color:var(--fl-muted)]">–</span>
            {m.awayScore}
          </p>
          <div className="flex min-w-0 flex-col items-center gap-1 text-center">
            <ClubBadge club={away} />
            <span className="w-full truncate text-xs font-semibold text-white">{away.name}</span>
          </div>
        </div>
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-pitch-950" aria-hidden>
          <div className="h-full rounded-full bg-theme-primary transition-[width] duration-200" style={{ width: `${(m.minute / 80) * 100}%` }} />
        </div>
        <div className="mt-2.5" aria-hidden>
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-pitch-950">
            <div className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
            {homeMomentum > 0 ? (
              <div
                className="absolute inset-y-0 right-1/2 rounded-l-full transition-[width] duration-300"
                style={{ width: `${Math.min(50, homeMomentum * 50)}%`, background: home.primary }}
              />
            ) : (
              <div
                className="absolute inset-y-0 left-1/2 rounded-r-full transition-[width] duration-300"
                style={{ width: `${Math.min(50, -homeMomentum * 50)}%`, background: away.primary }}
              />
            )}
          </div>
          <p className="mt-1 text-center text-[11px] text-[color:var(--fl-muted)]">Momentum</p>
        </div>
      </section>

      {m.pending ? (
        <section aria-label={m.pending.title} className="rounded-[20px] bg-pitch-900 p-4 ring-2 ring-theme-primary/60">
          <p className="text-[13px] font-semibold text-theme-primary">{m.pending.title}</p>
          <p className="mt-1 text-[15px] font-semibold text-white">{m.pending.prompt}</p>
          <div className="mt-3 flex flex-col gap-2">
            {m.pending.options.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => choose(o.id)}
                className="btn-press flex min-h-[52px] w-full flex-col items-start justify-center rounded-[14px] bg-pitch-800 px-4 py-2.5 text-left transition hover:bg-pitch-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/60"
              >
                <span className="text-[15px] font-bold text-white">{o.label}</span>
                <span className="text-xs text-[color:var(--fl-muted)]">{o.hint}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {m.finished ? (
        <section aria-label="Full time" className="rounded-[20px] bg-pitch-900 p-4 text-center">
          <p className={`text-[22px] font-bold ${us > them ? "text-success" : us < them ? "text-danger" : "text-white"}`}>
            {us > them ? "Win!" : us < them ? "Defeat" : "Draw"}
            {m.goldenPoint ? " · golden point" : ""}
          </p>
          <p className="mt-1 text-sm text-[color:var(--fl-muted)]">
            Your calls paid off {m.callsWon} of {m.callsDone.length}.
          </p>
        </section>
      ) : null}

      <section aria-label="Match feed" className="rounded-[20px] bg-pitch-900 p-2">
        <ul className="flex flex-col">
          {feed.map((e, i) => (
            <FeedRow key={`${m.events.length - i}`} event={e} homeColor={home.primary} awayColor={away.primary} fresh={i === 0} />
          ))}
        </ul>
      </section>

      <div className="mobile-action-bar sm:static sm:border-0 sm:bg-transparent sm:p-0" role="toolbar">
        <div className="mobile-action-bar__inner flex flex-col gap-2">
          {m.finished ? (
            <GameButton size="lg" onClick={finish}>
              Continue
            </GameButton>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <GameButton
                size="sm"
                variant="secondary"
                onClick={() => {
                  playUiClick();
                  setSpeed((s) => (s === "normal" ? "fast" : "normal"));
                }}
              >
                {speed === "normal" ? "Speed: normal" : "Speed: fast"}
              </GameButton>
              <GameButton size="sm" variant="secondary" onClick={skip}>
                Skip to full time
              </GameButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FeedRow({ event, homeColor, awayColor, fresh }: { event: LiveEvent; homeColor: string; awayColor: string; fresh: boolean }) {
  const dot = event.side === "home" ? homeColor : event.side === "away" ? awayColor : "transparent";
  const tone =
    event.kind === "try" || event.kind === "drop-goal"
      ? "font-bold text-white"
      : event.kind === "call"
        ? "text-theme-primary"
        : event.kind === "whistle"
          ? "font-semibold text-white"
          : "text-[color:var(--fl-muted)]";
  return (
    <li className={`flex items-start gap-2.5 rounded-[12px] px-2.5 py-2 text-[13px] leading-snug ${fresh ? "bg-pitch-800" : ""}`}>
      <span className="w-7 shrink-0 text-right font-semibold tabular-nums text-[color:var(--fl-muted)]">{event.minute}&rsquo;</span>
      <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} />
      <span className={`min-w-0 flex-1 ${tone}`}>{event.text}</span>
    </li>
  );
}
