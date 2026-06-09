"use client";

export function HardModeBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-950/60 px-2.5 py-1 font-display text-[10px] font-black uppercase tracking-[0.2em] text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.25)] ${className}`}
    >
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
      Hard Mode
    </span>
  );
}
