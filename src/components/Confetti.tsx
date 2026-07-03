"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { prefersReducedMotion } from "@/lib/haptics";

const COLORS = ["#fbbf24", "#22c55e", "#ef4444", "#3b82f6", "#ffffff", "#8B1538"];

export function Confetti() {
  const reducedMotion = prefersReducedMotion();

  const pieces = useMemo(
    () =>
      Array.from({ length: reducedMotion ? 0 : 60 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 2 + Math.random() * 2,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 6 + Math.random() * 8,
        rotate: Math.random() * 360,
      })),
    [reducedMotion]
  );

  if (reducedMotion || pieces.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-sm motion-reduce:hidden"
          style={{
            left: `${p.x}%`,
            top: -20,
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
          }}
          initial={{ y: -20, rotate: 0, opacity: 1 }}
          animate={{
            y: "110vh",
            rotate: p.rotate + 720,
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: "easeIn",
          }}
        />
      ))}
    </div>
  );
}
