"use client";

import Link from "next/link";
import type { RunState } from "@/lib/types";
import { formatValue } from "@/lib/players";
import { SquadPitch } from "./SquadPitch";

interface ResultsModalProps {
  run: RunState;
  mode: "CLASSIC";
  onClose: () => void;
}

export function ResultsModal({ run, mode, onClose }: ResultsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="card-glass max-h-[90vh] w-full max-w-lg overflow-y-auto p-6 animate-fade-up">
        <div className="text-center">
          <p className="text-sm uppercase tracking-wider text-gray-500">
            Run Complete
          </p>
          <h2 className="mt-1 text-4xl font-black text-gradient">
            {formatValue(run.totalValue)}
          </h2>
          <p className="mt-1 text-sm text-gray-400">Total Squad Value</p>
        </div>

        <div className="mt-4 rounded-xl bg-pitch-900/50 p-4 text-center">
          <p className="text-xs text-gray-500">Players Signed</p>
          <p className="text-2xl font-bold text-white">{run.filledCount}</p>
          <p className="text-xs text-gray-500">of {run.totalSlots}</p>
        </div>

        <div className="mt-4">
          <SquadPitch
            squad={run.squad}
            totalValue={run.totalValue}
            filledCount={run.filledCount}
            totalSlots={run.totalSlots}
          />
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/play"
            className="btn-primary flex-1 text-center"
          >
            Play Again
          </Link>
          <Link
            href="/leaderboard"
            className="btn-secondary flex-1 text-center"
          >
            Leaderboard
          </Link>
          <button onClick={onClose} className="btn-secondary flex-1">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
