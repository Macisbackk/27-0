"use client";

import { motion } from "framer-motion";

export function WoodenSpoon() {
  return (
    <motion.div
      className="mt-4 flex min-h-[5.5rem] flex-col items-center"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.4 }}
    >
      <svg
        viewBox="0 0 80 80"
        className="h-14 w-14 text-amber-700"
        fill="currentColor"
        aria-hidden
      >
        <ellipse cx="40" cy="62" rx="22" ry="6" opacity="0.3" />
        <path d="M38 8c-2 0-4 2-4 5v38c0 3 2 5 5 5h2c3 0 5-2 5-5V13c0-3-2-5-5-5h-3z" />
        <ellipse cx="41" cy="10" rx="6" ry="4" />
      </svg>
      <p className="mt-2 font-display text-base font-bold uppercase tracking-wider text-amber-600/90">
        Back to training
      </p>
    </motion.div>
  );
}
