"use client";

import { useMemo, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
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
  const [picked, setPicked] = useState<string[]>([]);
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
      <p className="mt-1 text-sm text-[color:var(--fl-muted)]">
        Up to {MAX_FRIENDLIES}. Each one gives your XIII +{SHARPNESS_PER_FRIENDLY} rating of match sharpness for the
        first three rounds, and brings in gate money at home.
      </p>
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
      <div className="mt-3 grid grid-cols-2 gap-2">
        <GameButton
          variant="secondary"
          size="md"
          onClick={() => {
            playUiClick();
            playFriendlies([]);
          }}
        >
          Skip pre-season
        </GameButton>
        <GameButton
          size="md"
          disabled={chosen.length === 0}
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
        Match sharpness: +{(pre.results.length * SHARPNESS_PER_FRIENDLY).toFixed(1)} rating for your first three games.
      </p>
    </section>
  );
}
