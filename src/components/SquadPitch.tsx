"use client";

import type { SquadSlot } from "@/lib/types";
import { formatValue } from "@/lib/players";
import { POSITION_SHORT } from "@/lib/positions";
import { SquadPlayerCard } from "./SquadPlayerCard";

interface SquadPitchProps {
  squad: SquadSlot[];
  totalValue: number;
  filledCount: number;
  totalSlots: number;
}

export function SquadPitch({
  squad,
  totalValue,
  filledCount,
  totalSlots,
}: SquadPitchProps) {
  return (
    <div className="card-glass p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
          Your Squad
        </h3>
        <div className="text-right">
          <p className="text-lg font-bold text-accent-gold">
            {formatValue(totalValue)}
          </p>
          <p className="text-xs text-gray-500">
            {filledCount}/{totalSlots} filled
          </p>
        </div>
      </div>

      <div className="relative rounded-xl bg-pitch-900/60 p-3 sm:p-4">
        <div className="absolute inset-0 rounded-xl border border-accent-green/10" />

        <div className="relative space-y-2">
          <Row
            slots={squad.filter((s) => s.position === "FULLBACK")}
          />
          <Row
            slots={squad.filter((s) => s.position === "WING")}
          />
          <Row
            slots={squad.filter((s) => s.position === "CENTRE")}
          />
          <Row
            slots={[
              ...squad.filter((s) => s.position === "STAND_OFF"),
              ...squad.filter((s) => s.position === "SCRUM_HALF"),
            ]}
          />
          <Row
            slots={[
              ...squad.filter((s) => s.position === "PROP"),
              ...squad.filter((s) => s.position === "HOOKER"),
            ]}
          />
          <Row
            slots={squad.filter((s) => s.position === "SECOND_ROW")}
          />
          <Row
            slots={squad.filter((s) => s.position === "LOOSE_FORWARD")}
          />
        </div>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-pitch-700">
        <div
          className="h-full rounded-full bg-accent-green transition-all duration-500"
          style={{ width: `${(filledCount / totalSlots) * 100}%` }}
        />
      </div>
    </div>
  );
}

function Row({ slots }: { slots: SquadSlot[] }) {
  return (
    <div className="flex justify-center gap-2">
      {slots.map((slot) => (
        <Slot key={slot.slotIndex} slot={slot} />
      ))}
    </div>
  );
}

function Slot({ slot }: { slot: SquadSlot }) {
  if (slot.player) {
    return (
      <SquadPlayerCard player={slot.player} />
    );
  }

  return (
    <div className="flex h-[90px] w-[60px] shrink-0 flex-col items-center justify-center rounded-lg border-2 border-dashed border-pitch-600/40 bg-pitch-900/40 sm:h-[86px] sm:w-[56px]">
      <span className="font-display text-[10px] font-bold uppercase text-gray-500">
        {POSITION_SHORT[slot.position]}
      </span>
      <span className="mt-1 text-[10px] text-gray-600">Empty</span>
    </div>
  );
}
