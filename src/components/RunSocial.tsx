"use client";

/**
 * End-of-run social bits shared by the Season and Play-off reviews:
 *  - "Challenge a mate": a `/play?challenge=<code>` link replaying this run's spins;
 *  - the head-to-head when this run *was* a challenge;
 *  - Daily pick rarity ("12% picked him").
 */
import { useEffect, useMemo, useState } from "react";
import type { SquadSlot } from "@/lib/types";
import type { ShareMatchResult, SharePlayoffFinish } from "@/lib/share-result";
import { buildShareResultText } from "@/lib/share-result";
import {
  buildChallengePayload,
  challengeHref,
  compareChallengeSides,
  encodeChallenge,
  formatChallengeFinish,
  formatChallengeRecord,
  inferChallengeSource,
  CHALLENGE_NAME_MAX,
  type ChallengePayload,
} from "@/lib/challenge-link";
import { getChallengeRuleScenario, loadChallengerName, saveChallengerName } from "@/lib/challenge-run";
import { getUsername } from "@/lib/storage/user";
import { isNameAllowed } from "@/lib/moderation/name-filter";
import { getPlayerById } from "@/lib/players";
import { getEffectivePeakRating } from "@/lib/squad-analysis";
import { buildPickRarity, findRarestPick, formatPickPercent, pickRarityLabel, type SlotRarity } from "@/lib/pick-rarity";
import { fetchDailyPickRarity } from "@/lib/storage/daily-pick-rarity";
import { ShareResultButton } from "./ShareResultButton";
import { TYPO } from "@/lib/ui/typography";

export interface RunOutcome {
  results: readonly ShareMatchResult[];
  position: number;
  /** Null while the play-offs are still to come. */
  finish: SharePlayoffFinish | null;
  playoffResults?: readonly ShareMatchResult[] | null;
}

/* ------------------------------------------------------------------ pick rarity */

export interface DailyPickRarityState {
  rarity: Map<number, SlotRarity> | null;
  rarest: { name: string; percentLabel: string } | null;
}

/** Daily runs only (seed `daily-<day>`): per-slot pick percentages for this run's picks. */
export function useDailyPickRarity(seed: string, squad: readonly SquadSlot[], enabled = true): DailyPickRarityState {
  const source = inferChallengeSource(seed);
  const dayKey = source.kind === "daily" ? source.key : null;
  const picksKey = squad.map((s) => `${s.slotIndex}:${s.player?.id ?? ""}`).join("|");
  const [rarity, setRarity] = useState<Map<number, SlotRarity> | null>(null);

  useEffect(() => {
    if (!enabled || !dayKey) return;
    let live = true;
    const picks = squad.filter((s) => s.player).map((s) => ({ slot: s.slotIndex, cardId: s.player!.id }));
    // Let the run's own picks reach the server first (recorded when the season is finalised).
    const timer = window.setTimeout(() => {
      void fetchDailyPickRarity(dayKey, picks).then((rows) => {
        if (!live) return;
        const map = buildPickRarity(rows, new Map(picks.map((p) => [p.slot, p.cardId])));
        setRarity(map.size > 0 ? map : null);
      });
    }, 800);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
    // picksKey stands in for squad
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, dayKey, picksKey]);

  const rarest = useMemo(() => {
    if (!rarity) return null;
    const r = findRarestPick(rarity);
    const name = r ? squad.find((s) => s.slotIndex === r.slot)?.player?.name : null;
    return r && name ? { name, percentLabel: formatPickPercent(r.percent) } : null;
  }, [rarity, squad]);

  return { rarity, rarest };
}

export function DailyPickRarityPanel({ squad, rarity }: { squad: readonly SquadSlot[]; rarity: Map<number, SlotRarity> | null }) {
  if (!rarity || rarity.size === 0) return null;
  const rarest = findRarestPick(rarity);
  const rows = [...squad].filter((s) => s.player).sort((a, b) => a.slotIndex - b.slotIndex);
  return (
    <section className="w-full rounded-card bg-pitch-900 px-4 py-3 text-left" aria-labelledby="pick-rarity-title">
      <h2 id="pick-rarity-title" className={`${TYPO.eyebrow} text-accent-gold`}>
        Pick rarity
      </h2>
      <p className="mt-0.5 text-xs text-[color:var(--fl-muted)]">How many Daily coaches picked the same player today.</p>
      <ul className="mt-2 divide-y divide-white/[0.06]">
        {rows.map((s) => {
          const r = rarity.get(s.slotIndex);
          const isRarest = rarest?.slot === s.slotIndex;
          return (
            <li key={s.slotIndex} className="flex min-w-0 items-center gap-2 py-1.5 text-sm">
              <span className="w-10 shrink-0 text-xs font-bold text-[color:var(--fl-muted)]">{s.label}</span>
              <span className="min-w-0 flex-1 truncate font-semibold text-white">{s.player!.name}</span>
              <span className={`shrink-0 tabular-nums ${isRarest ? "font-bold text-accent-gold" : "text-gray-300"}`}>
                {r ? pickRarityLabel(r) : "–"}
                {isRarest ? <span aria-hidden> 💎</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ challenge a mate */

export function ChallengeMatePanel({
  seed,
  era,
  squad,
  outcome,
}: {
  seed: string;
  era: boolean;
  squad: readonly SquadSlot[];
  outcome: RunOutcome;
}) {
  const [name, setName] = useState("");
  useEffect(() => {
    setName(loadChallengerName() || getUsername() || "");
  }, []);
  const trimmed = name.trim();
  const nameOk = trimmed === "" || isNameAllowed(trimmed);

  const text = useMemo(() => {
    try {
      const payload = buildChallengePayload({
        seed,
        era,
        name: nameOk ? trimmed : "",
        results: outcome.results,
        position: outcome.position,
        finish: outcome.finish,
        playoffResults: outcome.playoffResults,
        squad: squad.map((s) => ({ slotIndex: s.slotIndex, playerId: s.player?.id })),
      });
      const code = encodeChallenge(payload);
      const rule = getChallengeRuleScenario(payload);
      return buildShareResultText({
        kind: payload.kind,
        era: rule?.eraMode ?? era,
        dateKey: payload.kind === "daily" ? payload.key ?? undefined : undefined,
        weekKey: payload.kind === "weekly" ? payload.key ?? undefined : undefined,
        ruleTitle: rule?.ruleTitle,
        results: outcome.results,
        leaguePosition: outcome.position,
        playoffResults: outcome.playoffResults,
        playoffFinish: outcome.finish,
        challengeHref: challengeHref(code),
      });
    } catch {
      return null;
    }
  }, [seed, era, nameOk, trimmed, outcome, squad]);

  if (!text) return null;
  return (
    <section className="w-full rounded-card bg-pitch-900 px-4 py-3 text-left" aria-labelledby="challenge-mate-title">
      <h2 id="challenge-mate-title" className={`${TYPO.eyebrow} text-accent-gold`}>
        Challenge a mate
      </h2>
      <p className="mt-0.5 text-xs text-[color:var(--fl-muted)]">
        They get your spins. Compare squads at the end.
      </p>
      <label className="mt-2 block text-xs font-semibold text-[color:var(--fl-muted)]" htmlFor="challenge-name">
        Your name on the link
      </label>
      <input
        id="challenge-name"
        value={name}
        maxLength={CHALLENGE_NAME_MAX}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Macauley"
        autoComplete="nickname"
        className="mt-1 min-h-[44px] w-full min-w-0 rounded-xl border border-pitch-600/60 bg-pitch-950 px-3 text-sm text-white placeholder:text-[color:var(--fl-muted)]"
      />
      {!nameOk ? <p className="mt-1 text-xs text-red-300">Pick another name — that one isn&apos;t allowed.</p> : null}
      <ShareResultButton
        className="mt-2"
        text={text}
        variant="secondary"
        ariaLabel="Share a challenge link"
        disabled={!nameOk}
        onBeforeShare={() => saveChallengerName(trimmed)}
        label={
          <>
            <span aria-hidden className="mr-1.5">⚔️</span>
            Challenge a mate
          </>
        }
      />
    </section>
  );
}

/* ------------------------------------------------------------------ head-to-head */

export function ChallengeComparison({
  challenge,
  squad,
  outcome,
}: {
  challenge: ChallengePayload;
  squad: readonly SquadSlot[];
  outcome: RunOutcome;
}) {
  const mine = useMemo(() => {
    let wins = 0;
    let losses = 0;
    let draws = 0;
    for (const r of outcome.results) {
      if (r === "W") wins++;
      else if (r === "L") losses++;
      else if (r === "D") draws++;
    }
    return { wins, losses, draws, position: outcome.position, finish: outcome.finish ?? ("Missed Play-Offs" as const) };
  }, [outcome]);
  const verdict = compareChallengeSides(mine, challenge);
  const slots = [...squad].sort((a, b) => a.slotIndex - b.slotIndex);

  return (
    <section className="w-full rounded-card border border-accent-gold/30 bg-pitch-900 px-4 py-3 text-left" aria-labelledby="challenge-h2h-title">
      <h2 id="challenge-h2h-title" className={`${TYPO.eyebrow} text-accent-gold`}>
        Challenge · head to head
      </h2>
      <p className="mt-1 font-display text-[20px] font-bold leading-tight text-white">
        {verdict > 0 ? `You beat ${challenge.name}!` : verdict < 0 ? `${challenge.name} wins this one` : "Dead level"}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        {[
          { who: "You", record: formatChallengeRecord(mine), finish: formatChallengeFinish(mine), won: verdict > 0 },
          { who: challenge.name, record: formatChallengeRecord(challenge), finish: formatChallengeFinish(challenge), won: verdict < 0 },
        ].map((side) => (
          <div key={side.who} className={`min-w-0 rounded-tile px-2 py-2 ${side.won ? "bg-accent-gold/15" : "bg-pitch-950"}`}>
            <p className="truncate text-xs font-bold uppercase tracking-wide text-[color:var(--fl-muted)]">{side.who}</p>
            <p className="fl-number text-[28px] leading-none text-white">{side.record}</p>
            <p className="mt-1 text-xs text-gray-300">{side.finish}</p>
          </div>
        ))}
      </div>
      <table className="mt-3 w-full table-fixed text-sm">
        <caption className="sr-only">Both squads by position</caption>
        <thead>
          <tr className="text-xs text-[color:var(--fl-muted)]">
            <th scope="col" className="w-10 pb-1 text-left font-semibold">Pos</th>
            <th scope="col" className="pb-1 text-left font-semibold">You</th>
            <th scope="col" className="pb-1 text-left font-semibold">
              <span className="block truncate">{challenge.name}</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">
          {slots.map((slot) => {
            const theirId = challenge.squad[slot.slotIndex] ?? "";
            const theirs = theirId ? getPlayerById(theirId) : undefined;
            const same = Boolean(theirId && slot.player?.id === theirId);
            const myRating = slot.player ? Math.round(getEffectivePeakRating(slot)) : null;
            const theirRating = theirs ? Math.round(getEffectivePeakRating({ ...slot, player: theirs, runRatingPenalty: undefined })) : null;
            return (
              <tr key={slot.slotIndex} className={same ? "text-accent-gold" : ""}>
                <th scope="row" className="py-1 text-left text-xs font-bold text-[color:var(--fl-muted)]">
                  {slot.label}
                </th>
                <td className="truncate py-1 pr-1 font-semibold text-white">
                  {slot.player?.name ?? "–"}
                  {myRating ? <span className="ml-1 text-xs tabular-nums text-gray-400">{myRating}</span> : null}
                </td>
                <td className="truncate py-1 font-semibold text-white">
                  {theirs?.name ?? (theirId ? "Unknown card" : "–")}
                  {theirRating ? <span className="ml-1 text-xs tabular-nums text-gray-400">{theirRating}</span> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-[color:var(--fl-muted)]">Unranked. It doesn&apos;t use your Daily run.</p>
    </section>
  );
}

/** Everything social for a finished run, in review order. */
export function RunSocialPanel({
  seed,
  era,
  squad,
  outcome,
  challenge,
  rarity,
  canChallenge,
}: {
  seed: string;
  era: boolean;
  squad: readonly SquadSlot[];
  outcome: RunOutcome;
  challenge?: ChallengePayload | null;
  rarity?: Map<number, SlotRarity> | null;
  /** False for modes a link can't replay (hidden modes, Draft, Ball Knower). */
  canChallenge: boolean;
}) {
  return (
    <div className="flex w-full flex-col gap-3">
      {challenge ? <ChallengeComparison challenge={challenge} squad={squad} outcome={outcome} /> : null}
      <DailyPickRarityPanel squad={squad} rarity={rarity ?? null} />
      {canChallenge ? <ChallengeMatePanel seed={seed} era={era} squad={squad} outcome={outcome} /> : null}
    </div>
  );
}
