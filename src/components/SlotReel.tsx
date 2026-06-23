"use client";

import { useMemo } from "react";
import {
  SLOT_REEL_ITEM_HEIGHT_PX,
  SLOT_REEL_VISIBLE_ROWS,
  buildSlotReelStrip,
  computeSlotReelScrollY,
} from "@/lib/game/slot-reel";

export interface SlotReelProps {
  strip: string[];
  scrollIndex: number;
  locked: boolean;
  stepMs: number;
  formatItem: (item: string) => string;
  className?: string;
  textClassName?: string;
  spinning?: boolean;
}

export function SlotReel({
  strip,
  scrollIndex,
  locked,
  stepMs,
  formatItem,
  className,
  textClassName,
  spinning = false,
}: SlotReelProps) {
  const y = computeSlotReelScrollY(scrollIndex);
  const viewportHeight = SLOT_REEL_ITEM_HEIGHT_PX * SLOT_REEL_VISIBLE_ROWS;

  return (
    <div
      className={`slot-reel-window ${spinning ? "slot-reel-window--spinning" : ""} ${className ?? ""}`}
      style={{ height: viewportHeight }}
    >
      <div
        className="slot-reel-strip"
        style={{
          transform: `translate3d(0, ${y}px, 0)`,
          transition: locked
            ? "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)"
            : `transform ${stepMs}ms linear`,
        }}
      >
        {strip.map((item, i) => (
          <div
            key={`${item}-${i}`}
            className={`slot-reel-item slot-reveal-display-text text-center font-display font-black uppercase text-accent-green ${textClassName ?? ""}`}
            style={{ height: SLOT_REEL_ITEM_HEIGHT_PX }}
          >
            {formatItem(item)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function useSlotReelStrip(pool: string[]): string[] {
  return useMemo(() => buildSlotReelStrip(pool), [pool]);
}
