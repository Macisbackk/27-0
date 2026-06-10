"use client";

import { motion } from "framer-motion";
import { formatValue } from "@/lib/players";

interface MostExpensiveTeamBoxProps {
  name: string;
  value: number;
  delay?: number;
}

export function MostExpensiveTeamBox({
  name,
  value,
  delay = 0,
}: MostExpensiveTeamBoxProps) {
  return (
    <motion.div
      className="mx-auto max-w-md rounded-lg border border-pitch-600/50 bg-pitch-900/50 px-4 py-3 text-sm text-gray-400"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
    >
      <span className="font-display text-[10px] font-bold uppercase tracking-wider text-gray-500">
        Most Expensive Team
      </span>
      <p className="mt-1 font-semibold text-white">
        {name} — {formatValue(value)}
      </p>
    </motion.div>
  );
}
