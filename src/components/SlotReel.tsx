"use client";

import { forwardRef, memo, useImperativeHandle, useRef } from "react";
import {
  SLOT_REEL_ITEM_HEIGHT_PX,
  SLOT_REEL_VISIBLE_ROWS,
  computeSlotReelScrollY,
} from "@/lib/game/slot-reel";

export interface SlotReelHandle {
  setScrollIndex: (index: number, animate: boolean) => void;
}

export interface SlotReelProps {
  strip: string[];
  formatItem: (item: string) => string;
  className?: string;
  textClassName?: string;
}

export const SlotReel = memo(
  forwardRef<SlotReelHandle, SlotReelProps>(function SlotReel(
    { strip, formatItem, className, textClassName },
    ref
  ) {
    const stripRef = useRef<HTMLDivElement>(null);
    const viewportHeight = SLOT_REEL_ITEM_HEIGHT_PX * SLOT_REEL_VISIBLE_ROWS;

    useImperativeHandle(ref, () => ({
      setScrollIndex(index: number, animate: boolean) {
        const el = stripRef.current;
        if (!el) return;
        const y = computeSlotReelScrollY(index);
        el.style.transition = animate
          ? "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)"
          : "none";
        el.style.transform = `translate3d(0, ${y}px, 0)`;
      },
    }));

    return (
      <div
        className={`slot-reel-window ${className ?? ""}`}
        style={{ height: viewportHeight }}
      >
        <div ref={stripRef} className="slot-reel-strip">
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
  })
);
