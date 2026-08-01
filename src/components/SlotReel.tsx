"use client";

import { forwardRef, memo, useImperativeHandle, useRef } from "react";
import {
  SLOT_REEL_ITEM_HEIGHT_PX,
  SLOT_REEL_VISIBLE_ROWS,
  computeSlotReelScrollY,
} from "@/lib/game/slot-reel";
import { getClubColors } from "@/lib/clubs";

export interface SlotReelHandle {
  setScrollIndex: (index: number, animate: boolean) => void;
}

export interface SlotReelProps {
  strip: string[];
  formatItem: (item: string) => string;
  className?: string;
  textClassName?: string;
  /** When true, paint each team row with club primary colour. */
  useClubColors?: boolean;
}

export const SlotReel = memo(
  forwardRef<SlotReelHandle, SlotReelProps>(function SlotReel(
    { strip, formatItem, className, textClassName, useClubColors = false },
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
        style={{
          height: viewportHeight,
          // Keep CSS var in lockstep with JS transform math.
          ["--slot-reel-item-h" as string]: `${SLOT_REEL_ITEM_HEIGHT_PX}px`,
        }}
      >
        <div ref={stripRef} className="slot-reel-strip">
          {strip.map((item, i) => {
            const colors = useClubColors ? getClubColors(item) : null;
            return (
              <div
                key={`${item}-${i}`}
                className={`slot-reel-item slot-reveal-display-text text-center font-display font-black uppercase ${
                  colors ? "text-white" : "text-theme-primary"
                } ${textClassName ?? ""}`}
                style={{
                  height: SLOT_REEL_ITEM_HEIGHT_PX,
                  ...(colors
                    ? {
                        backgroundColor: colors.primary,
                        color: "#ffffff",
                        textShadow: "0 1px 2px rgba(0,0,0,0.55)",
                      }
                    : null),
                }}
              >
                {formatItem(item)}
              </div>
            );
          })}
        </div>
      </div>
    );
  })
);
