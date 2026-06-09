"use client";

import { motion } from "framer-motion";

export function TrophyAnimation() {
  return (
    <motion.div
      className="relative mx-auto mb-3 flex h-20 w-20 items-center justify-center sm:h-24 sm:w-24"
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 16, delay: 0.2 }}
    >
      <div className="absolute inset-2 rounded-full bg-accent-gold/15 blur-lg" aria-hidden />
      <svg
        viewBox="0 0 64 64"
        className="relative h-16 w-16 text-accent-gold drop-shadow-[0_0_16px_rgba(251,191,36,0.45)] sm:h-20 sm:w-20"
        fill="currentColor"
        aria-hidden
      >
        <path d="M12 8h40v6c0 8-4 14-12 16v6h8v6H16v-6h8v-6c-8-2-12-8-12-16V8zm6 6v2c0 5 3 9 8 10h14c5-1 8-5 8-10v-2H18z" />
        <rect x="22" y="44" width="20" height="4" rx="1" />
        <rect x="18" y="50" width="28" height="6" rx="2" />
      </svg>
    </motion.div>
  );
}
