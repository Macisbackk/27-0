"use client";

import { useEffect, useRef, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { useArmed } from "@/hooks/useArmed";
import { GameSegmentedControl } from "@/components/ui/GameSegmentedControl";
import {
  clubRating,
  currentStage,
  isBigMatchday,
  ordinal,
  sortTable,
  userFixture,
  type CareerState,
  type Fixture,
  type Tactic,
} from "@/lib/career";
import { useCareer } from "@/lib/career/context";
import { playCupProgress, playFullTime, playSimulateRound, playTryScored, playUiClick } from "@/lib/sound";
import { LiveMatch } from "./LiveMatch";
import { ClubLink } from "./ClubSheet";
import { IncomingBidCard, TransferWindowCard } from "./TransferNews";
import { PreseasonCard, PreseasonResults } from "./Preseason";
import { LeagueOverCard, PromotionCard } from "./Stages";
import { Card, ClubBadge, Eyebrow, FormDots } from "./bits";

const TACTICS: Array<{ id: Tactic; label: string; hint: string }> = [
  { id: "attack", label: "Attack", hint: "More tries for you — and for them." },
  { id: "balanced", label: "Balanced", hint: "No frills. Let the better XIII win." },
  { id: "defend", label: "Defend", hint: "Grind it out. Fewer points both ways." },
];

function lastUserFixture(state: CareerState): Fixture | undefined {
  for (let i = state.matchdayIndex - 1; i >= 0; i--) {
    const f = userFixture(state.calendar[i], state.userClubId);
    if (f?.result) return f;
  }
  return undefined;
}

export function ResultCard({ state, fixture, title }: { state: CareerState; fixture: Fixture; title?: string }) {
  const r = fixture.result!;
  const home = state.clubs[fixture.home]!;
  const away = state.clubs[fixture.away]!;
  const isHome = fixture.home === state.userClubId;
  const us = isHome ? r.homeScore : r.awayScore;
  const them = isHome ? r.awayScore : r.homeScore;
  const verdict = us > them ? "Win" : us < them ? "Loss" : "Draw";
  const tone = us > them ? "text-success" : us < them ? "text-danger" : "text-gray-300";
  const scorers = (ids: string[]) => {
    const counts = new Map<string, number>();
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
    return [...counts.entries()].map(([id, n]) => `${state.players[id]?.name ?? "?"}${n > 1 ? ` ×${n}` : ""}`).join(", ");
  };
  const motm = r.motm ? state.players[r.motm] : undefined;
  return (
    <Card>
      <div className="flex items-center justify-between">
        <Eyebrow>{title ?? fixture.label}</Eyebrow>
        <span className={`font-display text-sm font-bold ${tone}`}>{verdict}{r.goldenPoint ? " · golden point" : ""}</span>
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex min-w-0 flex-col items-center gap-1 text-center">
          <ClubBadge club={home} />
          <ClubLink clubId={home.id} className="w-full truncate text-center text-xs text-gray-300">{home.name}</ClubLink>
        </div>
        <div className="font-display text-4xl font-bold tabular-nums text-white">
          {r.homeScore}<span className="mx-1 text-gray-500">–</span>{r.awayScore}
        </div>
        <div className="flex min-w-0 flex-col items-center gap-1 text-center">
          <ClubBadge club={away} />
          <ClubLink clubId={away.id} className="w-full truncate text-center text-xs text-gray-300">{away.name}</ClubLink>
        </div>
      </div>
      <dl className="mt-3 space-y-1 text-xs text-gray-400">
        {r.homeTries.length ? (
          <div><dt className="inline font-semibold text-gray-300">{home.short} tries: </dt><dd className="inline">{scorers(r.homeTries)}</dd></div>
        ) : null}
        {r.awayTries.length ? (
          <div><dt className="inline font-semibold text-gray-300">{away.short} tries: </dt><dd className="inline">{scorers(r.awayTries)}</dd></div>
        ) : null}
        {motm ? (
          <div><dt className="inline font-semibold text-accent-gold">Player of the Match: </dt><dd className="inline">{motm.name}</dd></div>
        ) : null}
      </dl>
    </Card>
  );
}

/** The one button that moves past a stage. Arms after mount so a double tap can't fall through. */
function StageBar({ label, onClick }: { label: string; onClick: () => void }) {
  const armed = useArmed();
  return (
    <div className="mobile-action-bar sm:static sm:border-0 sm:bg-transparent sm:p-0" role="toolbar">
      <div className="mobile-action-bar__inner flex flex-col gap-2">
        <GameButton
          size="lg"
          disabled={!armed}
          onClick={() => {
            playUiClick();
            onClick();
          }}
        >
          {label}
        </GameButton>
      </div>
    </div>
  );
}

export function MatchTab({ onOpenMarket }: { onOpenMarket: () => void }) {
  const { state, play, playLive, setTactic, passStage } = useCareer();
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const lastPlayedIndex = useRef<number | null>(null);
  const s = state!;
  const md = s.calendar[s.matchdayIndex];
  const fixture = userFixture(md, s.userClubId);
  const last = lastUserFixture(s);

  // Sound + celebration on the result of a match the user just played.
  useEffect(() => {
    if (lastPlayedIndex.current === null) {
      lastPlayedIndex.current = s.matchdayIndex;
      return;
    }
    if (s.matchdayIndex !== lastPlayedIndex.current) {
      lastPlayedIndex.current = s.matchdayIndex;
      const r = last?.result;
      if (!r) return;
      const isHome = last!.home === s.userClubId;
      const us = isHome ? r.homeScore : r.awayScore;
      const them = isHome ? r.awayScore : r.homeScore;
      if (us > them) {
        if (last!.kind !== "league") playCupProgress();
        else playTryScored();
      } else {
        playFullTime();
      }
    }
  }, [s.matchdayIndex, s.userClubId, last]);

  const run = (fn: () => void) => {
    if (busy) return;
    setBusy(true);
    playSimulateRound();
    // Let the button state paint before the (fast) synchronous sim.
    requestAnimationFrame(() => {
      fn();
      setBusy(false);
    });
  };

  const opponentId = fixture ? (fixture.home === s.userClubId ? fixture.away : fixture.home) : null;
  const opponent = opponentId ? s.clubs[opponentId] : null;
  const myRating = clubRating(s, s.userClubId);
  const theirRating = opponentId ? clubRating(s, opponentId) : 0;
  const myDiv = s.clubs[s.userClubId]!.division;
  const table = sortTable(s.tables[myDiv]);
  const theirRow = opponentId ? table.find((r) => r.clubId === opponentId) : undefined;
  const theirPos = opponentId ? table.findIndex((r) => r.clubId === opponentId) + 1 : 0;
  const edge = myRating - theirRating + (fixture?.home === s.userClubId ? 0.9 : -0.9);
  const outlook = edge > 2 ? "Favourites" : edge > 0.5 ? "Slight favourites" : edge > -0.5 ? "Coin flip" : edge > -2 ? "Underdogs" : "Big underdogs";
  const big = isBigMatchday(s, md);
  const stage = currentStage(s);
  // Coming into a round from another stage (pre-season results, Deadline Day, league over…) or
  // from another week (Continue / Quick sim), the buttons arm after a moment so the second tap of a
  // double tap can't start a match that's just appeared under the finger.
  const fixtureArmed = useArmed(450, `${stage}:${s.matchdayIndex}`, { armedOnMount: true });

  if (live && fixture) {
    return (
      <LiveMatch
        key={fixture.id}
        state={s}
        fixture={fixture}
        onDone={(played) => {
          playLive(played);
          setLive(false);
        }}
      />
    );
  }

  // One stage at a time: nothing from the next stage shows until this one is done.
  const stageBar = (label: string, onClick: () => void) => <StageBar key={`${stage}-${label}`} label={label} onClick={onClick} />;

  if (stage === "preseason") {
    return (
      <div className="flex flex-col gap-4">
        <PreseasonCard />
      </div>
    );
  }
  if (stage === "preseason-done") {
    return (
      <div className="flex flex-col gap-4">
        <PreseasonResults />
        {stageBar("Start the season", () => passStage("preseason"))}
      </div>
    );
  }
  if (stage === "deadline") {
    return (
      <div className="flex flex-col gap-4">
        <IncomingBidCard />
        <TransferWindowCard onOpenMarket={onOpenMarket} />
        {last ? <ResultCard state={s} fixture={last} title={`Last result · ${last.label}`} /> : null}
      </div>
    );
  }
  if (stage === "league-over") {
    const next = fixture;
    return (
      <div className="flex flex-col gap-4">
        <LeagueOverCard />
        {stageBar(
          next ? (next.kind === "mpg" ? "On to the Million Pound Game" : "On to the play-offs") : "Watch the play-offs",
          () => passStage("league-over")
        )}
      </div>
    );
  }
  if (stage === "promotion") {
    return (
      <div className="flex flex-col gap-4">
        <PromotionCard />
        {stageBar(fixture ? "On to the Grand Final" : "Watch the Grand Final", () => passStage("promotion"))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <IncomingBidCard />
      <TransferWindowCard onOpenMarket={onOpenMarket} />
      <Card className={big ? "border-accent-gold/60" : ""}>
        <div className="flex items-center justify-between gap-2">
          <Eyebrow>{md ? md.label : "Season complete"}</Eyebrow>
          {big ? <span className="rounded-full bg-accent-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-gold">Big game</span> : null}
        </div>
        {fixture && opponent ? (
          <>
            <div className="mt-3 flex items-center gap-3">
              <ClubBadge club={opponent} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-wide text-gray-400">{fixture.home === s.userClubId ? "Home vs" : "Away at"}</p>
                <p className="font-display text-xl font-bold leading-tight text-white sm:text-2xl"><ClubLink clubId={opponent.id}>{opponent.name}</ClubLink></p>
                {theirRow && fixture.kind === "league" ? (
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
                    {ordinal(theirPos)} · {theirRow.w}W {theirRow.l}L <FormDots form={theirRow.form} />
                  </p>
                ) : null}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 items-center gap-2 text-center">
              <div>
                <p className="font-display text-xl font-bold tabular-nums text-white">{myRating.toFixed(1)}</p>
                <p className="text-[10px] uppercase tracking-wide text-gray-500">You</p>
              </div>
              <p className={`text-sm font-semibold ${edge > 0.5 ? "text-success" : edge < -0.5 ? "text-danger" : "text-gray-300"}`}>{outlook}</p>
              <div>
                <p className="font-display text-xl font-bold tabular-nums text-white">{theirRating.toFixed(1)}</p>
                <p className="text-[10px] uppercase tracking-wide text-gray-500">Them</p>
              </div>
            </div>
          </>
        ) : md ? (
          <p className="mt-3 text-sm text-gray-300">
            No game for you this week. {md.fixtures.length || md.pendingDraw ? "The other fixtures are played." : ""}
          </p>
        ) : null}
      </Card>

      {fixture ? (
        <GameSegmentedControl<Tactic>
          label="Game plan"
          options={TACTICS.map((t) => ({ id: t.id, label: t.label }))}
          value={s.tactic}
          onChange={(t) => setTactic(t)}
          fullWidth
        />
      ) : null}
      {fixture ? <p className="-mt-2 text-center text-xs text-gray-400">{TACTICS.find((t) => t.id === s.tactic)!.hint}</p> : null}

      <div className="mobile-action-bar sm:static sm:border-0 sm:bg-transparent sm:p-0" role="toolbar">
        <div className="mobile-action-bar__inner flex flex-col gap-2">
          {fixture ? (
            <>
              <GameButton
                size="lg"
                disabled={busy || !fixtureArmed}
                onClick={() => {
                  playUiClick();
                  setLive(true);
                }}
              >
                Play match
              </GameButton>
              <GameButton size="sm" variant="secondary" disabled={busy || !fixtureArmed} onClick={() => run(play)}>
                {busy ? "Simulating…" : "Quick sim"}
              </GameButton>
            </>
          ) : (
            <GameButton size="lg" disabled={busy || !md || !fixtureArmed} onClick={() => run(play)}>
              Continue
            </GameButton>
          )}
        </div>
      </div>

      {last ? <ResultCard state={s} fixture={last} title={`Last result · ${last.label}`} /> : null}
    </div>
  );
}
