"use client";

import { forwardRef, memo, useImperativeHandle, useMemo, useRef } from "react";
import {
  SLOT_REEL_ITEM_HEIGHT_PX,
  SLOT_REEL_VISIBLE_ROWS,
  computeSlotReelScrollY,
} from "@/lib/game/slot-reel";
import { getClubColors } from "@/lib/clubs";

export interface SlotReelHandle {
  setScrollIndex: (index: number, animate?: boolean) => void;
  /** Continuous pixel scroll — preferred during rAF spins. */
  setScrollY: (y: number) => void;
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

    // Resolve colours once per strip — not on every parent re-render mid-spin.
    const rowStyles = useMemo(() => {
      if (!useClubColors) return null;
      return strip.map((item) => {
        const colors = getClubColors(item);
        return {
          backgroundColor: colors.primary,
          color: "#ffffff",
          textShadow: "0 1px 2px rgba(0,0,0,0.55)",
        } as const;
      });
    }, [strip, useClubColors]);

    useImperativeHandle(ref, () => ({
      setScrollY(y: number) {
        const el = stripRef.current;
        if (!el) return;
        el.style.transition = "none";
        el.style.transform = `translate3d(0, ${y}px, 0)`;
      },
      setScrollIndex(index: number, animate = false) {
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
        className={`slot-reel-window ${className ?? ""}`.trim()}
        style={{
          height: viewportHeight,
          ["--slot-reel-item-h" as string]: `${SLOT_REEL_ITEM_HEIGHT_PX}px`,
        }}
      >
        <div
          ref={stripRef}
          className="slot-reel-strip"
          style={{ willChange: "transform" }}
        >
          {strip.map((item, i) => (
            <div
              key={`${item}-${i}`}
              className={`slot-reel-item slot-reveal-display-text text-center font-display font-black uppercase ${
                useClubColors ? "text-white" : "text-theme-primary"
              } ${textClassName ?? ""}`}
              style={{
                height: SLOT_REEL_ITEM_HEIGHT_PX,
                ...(rowStyles?.[i] ?? null),
              }}
            >
              {formatItem(item)}
            </div>
          ))}
        </div>
      </div>
    );
  })
);
