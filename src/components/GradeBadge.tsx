"use client";

import { motion } from "framer-motion";
import type { GradeInfo } from "@/lib/grades";
import { formatGradeDisplay } from "@/lib/grades";

interface GradeBadgeProps {
  info: GradeInfo;
  large?: boolean;
}

export function GradeBadge({ info, large }: GradeBadgeProps) {
  const size = large ? "h-28 w-28 sm:h-36 sm:w-36" : "h-20 w-20";
  const letterSize =
    info.grade === "S+"
      ? large
        ? "text-4xl sm:text-5xl"
        : "text-3xl"
      : large
        ? "text-5xl sm:text-7xl"
        : "text-4xl";

  const isElite = info.grade === "S" || info.grade === "S+";

  return (
    <div className="flex min-h-[10.5rem] flex-col items-center sm:min-h-[12.5rem]">
      <motion.div
        className="flex flex-col items-center"
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 18, delay: 0.15 }}
      >
        <div
          className={`relative flex ${size} items-center justify-center rounded-2xl border-4 font-display font-black`}
          style={{
            borderColor: info.color,
            background: `linear-gradient(145deg, ${info.color}22, #0f1814)`,
            boxShadow: `0 0 28px ${info.glow}`,
          }}
        >
          {isElite && (
            <div
              className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-accent-gold/35"
              aria-hidden
            />
          )}
          <span
            className={`${letterSize} relative z-10 leading-none`}
            style={{ color: info.color }}
          >
            {info.grade}
          </span>
        </div>
        <p
          className="mt-3 text-center font-display text-sm font-bold uppercase tracking-widest sm:text-base"
          style={{ color: info.color }}
        >
          {formatGradeDisplay(info)}
        </p>
        <p className="mt-1 max-w-xs text-center text-xs text-gray-500 sm:text-sm">
          {info.explanation}
        </p>
      </motion.div>
    </div>
  );
}
