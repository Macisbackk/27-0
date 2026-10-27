"use client";

import { useMemo, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { useArmed } from "@/hooks/useArmed";
import {
  DIVISION_LABEL,
  MAX_FRIENDLIES,
  SHARPNESS_PER_FRIENDLY,
  clubRating,
  formatMoney,
  friendlyOptions,
  preseasonOpen,
  type FriendlyOption,
} from "@/lib/career";
import { useCareer } from "@/lib/career/context";
import { playUiClick } from "@/lib/sound";
import { ClubBadge } from "./bits";

const TONE: Record<FriendlyOption["label"], string> = {
  "Big test": "text-amber-300",
  "Even game": "text-gray-200",
  "Easy run-out": "text-theme-primary",
};

/** Before Round 1: pick up to two warm-up games for sharpness and gate money. */
export function PreseasonCard() {
  const { state, playFriendlies } = useCareer();
  const s = state!;
  const options = useMemo(() => friendlyOptions(s), [s.seed, s.year, s.userClubId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Pre-pick the two best-paying games so the common case is one tap ("Play 2"); the full list
  // sits behind "Change".
  const recommended = useMemo(
    () => [...options].sort((a, b) => b.money - a.money).slice(0, MAX_FRIENDLIES).map((o) => o.opponentId),
    [options]
  );
  const [picked, setPicked] = useState<string[]>(recommended);
  const [changing, setChanging] = useState(false);
  // Arms after a moment: a double tap on "Take charge" used to land on "Skip pre-season".
  const armed = useArmed(600);
  if (!preseasonOpen(s)) return null;

  const toggle = (id: string) => {
    playUiClick();
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_FRIENDLIES ? [...p.slice(1), id] : [...p, id]));
  };
  const chosen = options.filter((o) => picked.includes(o.opponentId));
  const cash = chosen.reduce((t, o) => t + o.money, 0);

  return (
    <section aria-label="Pre-season friendlies" className="fl-rise rounded-card bg-pitch-900 p-4">
      <p className="text-[13px] font-semibold text-theme-primary">Pre-season</p>
      <h2 className="mt-0.5 text-[18px] font-bold text-white">Pick your friendlies</h2>
      <div className="mt-1 text-sm text-[color:var(--fl-muted)]">
        Up to {MAX_FRIENDLIES}. Each adds +{SHARPNESS_PER_FRIENDLY} rating for 3 rounds, plus cash.{" "}
        <details className="inline">
          <summary className="inline cursor-pointer font-semibold text-gray-300 underline-offset-2 hover:underline">More</summary>
          <span className="mt-1 block">Home games pay gate money. Away games pay a fee. Big tests pay more.</span>
        </details>
      </div>
      {!changing ? (
        <div className="mt-3">
          <ul className="space-y-1.5" aria-label="Your friendlies">
            {chosen.length ? (
              chosen.map((o) => {
                const club = s.clubs[o.opponentId]!;
                return (
                  <li key={o.opponentId} className="flex items-center gap-2 rounded-control bg-pitch-950 p-2 text-sm">
                    <ClubBadge club={club} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-white">
                      {o.home ? "v" : "at"} {club.name}{" "}
                      <span className={`text-xs font-semibold ${TONE[o.label]}`}>· {o.label}</span>
                    </span>
                    <span className="shrink-0 text-xs font-bold tabular-nums text-theme-primary">+{formatMoney(o.money)}</span>
                  </li>
                );
              })
            ) : (
              <li className="text-sm text-gray-400">No friendlies picked.</li>
            )}
          </ul>
          <button
            type="button"
            onClick={() => {
              playUiClick();
              setChanging(true);
            }}
            aria-expanded={false}
            className="mt-2 text-sm font-semibold text-theme-primary underline-offset-2 hover:underline"
          >
            Change
          </button>
        </div>
      ) : (
      <ul className="fl-stagger mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const club = s.clubs[o.opponentId]!;
          const on = picked.includes(o.opponentId);
          return (
            <li key={o.opponentId}>
              <button
                type="button"
                onClick={() => toggle(o.opponentId)}
                aria-pressed={on}
                className={`fl-pressable flex w-full items-center gap-3 rounded-control p-2.5 text-left transition ${
                  on ? "bg-theme-primary/15 ring-2 ring-theme-primary" : "bg-pitch-950 hover:bg-pitch-800"
                }`}
              >
                <ClubBadge club={club} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold text-white">{club.name}</span>
                  <span className="block text-xs text-[color:var(--fl-muted)]">
                    <span className={`font-semibold ${TONE[o.label]}`}>{o.label}</span> · {o.home ? "Home" : "Away"} ·{" "}
                    {DIVISION_LABEL[club.division]} · {clubRating(s, club.id).toFixed(1)}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-bold tabular-nums text-theme-primary">+{formatMoney(o.money)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <GameButton
          variant="secondary"
          size="md"
          disabled={!armed}
          onClick={() => {
            playUiClick();
            playFriendlies([]);
          }}
        >
          Skip pre-season
        </GameButton>
        <GameButton
          size="md"
          disabled={!armed || chosen.length === 0}
          onClick={() => {
            playUiClick();
            playFriendlies(chosen);
          }}
        >
          {chosen.length ? `Play ${chosen.length} · +${formatMoney(cash)}` : "Pick a friendly"}
        </GameButton>
      </div>
    </section>
  );
}

/** Pre-season results, shown until Round 1 kicks off. */
export function PreseasonResults() {
  const { state } = useCareer();
  const s = state!;
  const pre = s.preseason;
  if (!pre || pre.year !== s.year || !pre.results.length || s.matchdayIndex > 0) return null;
  return (
    <section aria-label="Pre-season results" className="fl-rise rounded-card bg-pitch-900 p-4">
      <p className="text-[13px] font-semibold text-theme-primary">Pre-season done</p>
      <ul className="mt-2 space-y-1.5">
        {pre.results.map((r) => {
          const club = s.clubs[r.opponentId]!;
          const tone = r.us > r.them ? "text-success" : r.us < r.them ? "text-danger" : "text-gray-300";
          return (
            <li key={r.opponentId} className="flex items-center gap-2 text-sm">
              <ClubBadge club={club} size="sm" />
              <span className="min-w-0 flex-1 truncate text-white">
                {r.home ? "v" : "at"} {club.name}
              </span>
              <span className={`font-bold tabular-nums ${tone}`}>
                {r.us}–{r.them}
              </span>
              <span className="w-14 text-right text-xs text-[color:var(--fl-muted)]">+{formatMoney(r.money)}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-[color:var(--fl-muted)]">
        Sharpness: +{(pre.results.length * SHARPNESS_PER_FRIENDLY).toFixed(1)} rating for your first 3 games.
      </p>
    </section>
  );
}
