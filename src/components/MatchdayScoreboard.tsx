"use client";



import { HardModeBadge } from "./HardModeBadge";

import { formatValue } from "@/lib/players";

import type { GameDifficulty } from "@/lib/types";



interface MatchdayScoreboardProps {

  difficulty: GameDifficulty;

  filledCount: number;

  totalSlots: number;

  totalValue: number;

  hideScore?: boolean;

}



export function MatchdayScoreboard({

  difficulty,

  filledCount,

  totalSlots,

  totalValue,

  hideScore,

}: MatchdayScoreboardProps) {

  return (

    <div className="matchday-scoreboard relative overflow-hidden rounded-xl border border-white/10 px-4 py-3 shadow-2xl">

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-pitch-900/40 via-transparent to-pitch-900/40" />

      <div className="relative flex flex-wrap items-center justify-between gap-3">

        <div className="flex items-center gap-3">

          <div className="flex items-center gap-2">

            <span className="h-2 w-2 animate-pulse rounded-full bg-accent-green" />

            <span className="font-display text-[10px] font-bold uppercase tracking-[0.25em] text-accent-green">

              Super League

            </span>

          </div>

          <div>

            <p className="font-display text-sm font-black uppercase tracking-wider text-white sm:text-base">

              Squad Builder

            </p>

            <p className="text-[10px] uppercase tracking-wider text-gray-400">

              {filledCount} of {totalSlots} positions filled

            </p>

          </div>

          {difficulty === "HARD" && <HardModeBadge />}

        </div>



        <div className="flex items-center gap-4">

          <div className="text-center">

            <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500">

              Squad

            </p>

            <p className="font-display text-2xl font-black text-white">

              {filledCount}

              <span className="text-base text-gray-500">/{totalSlots}</span>

            </p>

          </div>



          <div className="scoreboard-value-panel rounded-lg px-4 py-2 text-right">

            <p className="text-[9px] font-bold uppercase tracking-wider text-accent-gold/80">

              Squad Value

            </p>

            <p

              className={`font-display text-xl font-black sm:text-2xl ${

                hideScore ? "text-gray-600" : "text-accent-gold"

              }`}

            >

              {hideScore ? "???" : totalValue > 0 ? formatValue(totalValue) : "—"}

            </p>

          </div>

        </div>

      </div>

    </div>

  );

}


