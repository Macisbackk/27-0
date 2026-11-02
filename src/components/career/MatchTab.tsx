"use client";

import { useEffect, useRef, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { useArmed } from "@/hooks/useArmed";
import { GameSegmentedControl } from "@/components/ui/GameSegmentedControl";
import {
  autoPickTeam,
  clubRating,
  currentStage,
  isBigMatchday,
  leagueOverPicture,
  teamRating,
  ordinal,
  sortTable,
  userFixture,
  userStreak,
  type CareerState,
  type Fixture,
  type Tactic,
} from "@/lib/career";
import { useCareer } from "@/lib/career/context";
import { playAutofill, playCupProgress, playFullTime, playSimulateRound, playTryScored, playUiClick } from "@/lib/sound";
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

const STREAK_WORD = { W: ["win", "wins"], L: ["defeat", "defeats"], D: ["draw", "draws"] } as const;

/** What changed since the last tap: places moved and challenges completed. */
export interface ResultFlash {
  moved: number;
  challenges: string[];
}

/** "Smith 2, Jones": our try scorers, most first. */
function scorerLine(state: CareerState, tries: string[]): string {
  const counts = new Map<string, number>();
  for (const id of tries) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, n]) => `${state.players[id]?.name ?? "?"}${n > 1 ? ` ${n}` : ""}`)
    .join(", ");
}

/**
 * The last result, big and clear at the top of the Match tab until the next game is played:
 * the score, won/lost/drawn, who and where, try scorers (or golden point), form run, Player of the
 * Match, places moved and any challenge it completed.
 */
export function ResultStrip({ state, fixture, flash }: { state: CareerState; fixture: Fixture; flash?: ResultFlash | null }) {
  const r = fixture.result!;
  const isHome = fixture.home === state.userClubId;
  const us = isHome ? r.homeScore : r.awayScore;
  const them = isHome ? r.awayScore : r.homeScore;
  const me = state.clubs[state.userClubId]!;
  const opp = state.clubs[isHome ? fixture.away : fixture.home]!;
  const result = us > them ? "W" : us < them ? "L" : "D";
  const verdict = result === "W" ? "Won" : result === "L" ? "Lost" : "Drew";
  const tone = result === "W" ? "text-success" : result === "L" ? "text-danger" : "text-gray-200";
  const ring = result === "W" ? "ring-success/50" : result === "L" ? "ring-danger/50" : "ring-white/20";
  const pill = result === "W" ? "bg-success/15 text-success" : result === "L" ? "bg-danger/15 text-red-200" : "bg-white/10 text-gray-200";
  const streak = userStreak(state);
  const motm = r.motm ? state.players[r.motm] : undefined;
  const ourTries = isHome ? r.homeTries : r.awayTries;
  const ourReds = (isHome ? r.homeSentOff : r.awaySentOff) ?? [];
  const summary = r.goldenPoint
    ? result === "W"
      ? "Golden point win."
      : "Lost in golden point."
    : ourTries.length
      ? `Tries: ${scorerLine(state, ourTries)}.`
      : "No tries for you.";
  const chips: Array<{ text: string; tone: string }> = [];
  if (streak && streak.length >= 2) {
    chips.push({
      text: `${streak.length} ${STREAK_WORD[streak.kind][1]} in a row`,
      tone: streak.kind === "W" ? "bg-success/15 text-success" : streak.kind === "L" ? "bg-danger/15 text-red-200" : "bg-white/10 text-gray-200",
    });
  }
  if (flash && flash.moved > 0) chips.push({ text: `Up ${flash.moved} ${flash.moved === 1 ? "place" : "places"}`, tone: "bg-success/15 text-success" });
  if (flash && flash.moved < 0) chips.push({ text: `Down ${-flash.moved} ${flash.moved === -1 ? "place" : "places"}`, tone: "bg-danger/15 text-red-200" });
  return (
    <section aria-label="Last result" className={`fl-rise rounded-card bg-pitch-900 px-4 py-4 text-center ring-2 ${ring}`}>
      <p className="text-xs font-semibold text-theme-primary">Last result · {fixture.label}</p>
      <div className="mt-2 flex items-center justify-center gap-3">
        <ClubBadge club={isHome ? me : opp} size="md" />
        <p className={`font-display text-4xl font-bold tabular-nums leading-none sm:text-5xl ${tone}`}>
          {r.homeScore}–{r.awayScore}
        </p>
        <ClubBadge club={isHome ? opp : me} size="md" />
      </div>
      <p className="mt-2 text-[15px] font-bold leading-tight text-white">
        <span className={`mr-1.5 rounded-full px-2 py-0.5 text-[12px] uppercase tracking-wide ${pill}`}>{verdict}</span>
        {isHome ? "v" : "at"} <ClubLink clubId={opp.id}>{opp.name}</ClubLink>
      </p>
      <p className="mt-1.5 text-[13px] text-gray-300">{summary}</p>
      {ourReds.length ? (
        <p className="mt-1 text-[12px] font-semibold text-danger">
          Sent off: {ourReds.map((id) => state.players[id]?.name ?? "?").join(", ")}. Banned next game.
        </p>
      ) : null}
      {chips.length || motm ? (
        <p className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-[12px]">
          {chips.map((c) => (
            <span key={c.text} className={`rounded-full px-2 py-0.5 font-bold ${c.tone}`}>{c.text}</span>
          ))}
          {motm ? (
            <span className="rounded-full bg-accent-gold/15 px-2 py-0.5 font-bold text-accent-gold">Player of the Match: {motm.name}</span>
          ) : null}
        </p>
      ) : null}
      {flash?.challenges.length ? (
        <ul className="mt-2 space-y-1">
          {flash.challenges.map((t) => (
            <li key={t} className="rounded-control bg-accent-gold/10 px-2.5 py-1.5 text-[13px] font-semibold text-accent-gold">
              ✓ Challenge done: {t}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
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
  const { state, play, playLive, setTactic, passStage, autoPick } = useCareer();
  // Places moved and challenges completed by the last tap (kept while this tab is open).
  const before = useRef<{ index: number; pos: number; done: string[] } | null>(null);
  const [flash, setFlash] = useState<ResultFlash | null>(null);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const lastPlayedIndex = useRef<number | null>(null);
  const s = state!;
  const md = s.calendar[s.matchdayIndex];
  const fixture = userFixture(md, s.userClubId);
  const last = lastUserFixture(s);

  const myDivision = s.clubs[s.userClubId]!.division;
  const myPos = sortTable(s.tables[myDivision]).findIndex((r) => r.clubId === s.userClubId) + 1;
  const myPlayed = s.tables[myDivision].find((r) => r.clubId === s.userClubId)?.p ?? 0;
  const doneIds = s.challenges.filter((c) => c.done).map((c) => c.id).join(",");
  useEffect(() => {
    const prev = before.current;
    // A position only means something once a league game has been played.
    const now = { index: s.matchdayIndex, pos: myPlayed > 0 ? myPos : 0, done: doneIds ? doneIds.split(",") : [] };
    before.current = now;
    if (!prev || prev.index === now.index) return;
    if (now.index < prev.index) {
      setFlash(null);
      return;
    }
    const fresh = s.challenges.filter((c) => c.done && !prev.done.includes(c.id)).map((c) => c.title);
    setFlash({ moved: prev.pos && now.pos ? prev.pos - now.pos : 0, challenges: fresh });
  }, [s.matchdayIndex, myPos, myPlayed, doneIds, s.challenges]);

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

  // A better 17 is sitting in the squad (after a signing, a sale or a renewal).
  const best = fixture ? autoPickTeam(s) : null;
  const bestGain = best ? teamRating(best.lineup, best.bench, s.players) - myRating : 0;

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
        <TransferWindowCard onOpenMarket={onOpenMarket} />
      </div>
    );
  }
  if (stage === "preseason-done") {
    return (
      <div className="flex flex-col gap-4">
        <PreseasonResults />
        <TransferWindowCard onOpenMarket={onOpenMarket} />
        {stageBar("Start the season", () => passStage("preseason"))}
      </div>
    );
  }
  if (stage === "deadline") {
    return (
      <div className="flex flex-col gap-4">
        <IncomingBidCard />
        <TransferWindowCard onOpenMarket={onOpenMarket} />
        {last ? <ResultStrip state={s} fixture={last} /> : null}
      </div>
    );
  }
  if (stage === "league-over") {
    const next = fixture;
    const pic = leagueOverPicture(s);
    const bye = pic.division === "super-league" && pic.position <= 2;
    return (
      <div className="flex flex-col gap-4">
        {last ? <ResultStrip state={s} fixture={last} flash={flash} /> : null}
        <LeagueOverCard />
        {stageBar(
          next
            ? next.kind === "mpg"
              ? "On to the Million Pound Game"
              : "On to the play-offs"
            : bye
              ? "On to the semi-finals"
              : "Watch the play-offs",
          () => passStage("league-over")
        )}
      </div>
    );
  }
  if (stage === "promotion") {
    return (
      <div className="flex flex-col gap-4">
        {last ? <ResultStrip state={s} fixture={last} flash={flash} /> : null}
        <PromotionCard />
        {stageBar(fixture ? "On to the Grand Final" : "Watch the Grand Final", () => passStage("promotion"))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Order (v1.54): last result → next match → game plan → stronger-team nudge → transfers. */}
      {last ? <ResultStrip state={s} fixture={last} flash={flash} /> : null}
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
      {fixture && bestGain >= 0.3 ? (
        <section aria-label="Stronger team available" className="flex items-center gap-3 rounded-card bg-pitch-900 p-3 ring-1 ring-theme-primary/40">
          <p className="min-w-0 flex-1 text-[13px] text-gray-300">
            Your best team is <span className="font-bold text-theme-primary">+{bestGain.toFixed(1)}</span> stronger.
          </p>
          <GameButton
            size="sm"
            fullWidth={false}
            onClick={() => {
              playAutofill();
              autoPick();
            }}
          >
            Pick best team
          </GameButton>
        </section>
      ) : null}

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
      <IncomingBidCard />
      <TransferWindowCard onOpenMarket={onOpenMarket} />
      {s.matchdayIndex === 0 ? <PreseasonResults /> : null}
    </div>
  );
}
