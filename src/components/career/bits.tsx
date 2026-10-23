"use client";

import type { ReactNode } from "react";
import type { CareerClub } from "@/lib/career";

/** Round club crest stand-in: club colours + 3-letter code. */
export function ClubBadge({
  club,
  size = "md",
}: {
  club: Pick<CareerClub, "short" | "primary" | "secondary" | "name"> & { accent?: string };
  size?: "sm" | "md" | "lg";
}) {
  const dims = size === "lg" ? "h-14 w-14 text-sm" : size === "sm" ? "h-7 w-7 text-[9px]" : "h-10 w-10 text-[11px]";
  // Third kit colour as a bold inner ring, so clubs sharing two colours still look different.
  const ringW = size === "lg" ? 4 : size === "sm" ? 2 : 3;
  const ring = club.accent && club.accent.toLowerCase() !== club.primary.toLowerCase() ? `inset 0 0 0 ${ringW}px ${club.accent}` : undefined;
  return (
    <span
      aria-hidden
      title={club.name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full border-2 font-display font-bold tracking-wide ${dims}`}
      style={{ background: club.primary, borderColor: club.secondary, color: readableOn(club.primary), boxShadow: ring }}
    >
      {club.short}
    </span>
  );
}

function readableOn(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#fff";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#0a0f0d" : "#ffffff";
}

/** Prestige / potential stars (supports halves). */
export function Stars({ value, max = 5, label }: { value: number; max?: number; label?: string }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <span className="inline-flex items-center gap-0.5 text-accent-gold" aria-label={label ?? `${value} out of ${max} stars`} role="img">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < full ? "" : i === full && half ? "opacity-60" : "opacity-20"} aria-hidden>
          ★
        </span>
      ))}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-card bg-pitch-900 p-4 text-left ${className}`}>{children}</section>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold text-theme-primary">{children}</p>;
}

export function ProgressBar({ value, max, tone = "theme" }: { value: number; max: number; tone?: "theme" | "gold" }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-pitch-700" role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div className={`h-full rounded-full ${tone === "gold" ? "bg-accent-gold" : "bg-theme-primary"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function RatingPill({ rating, delta }: { rating: number; delta?: number }) {
  const tone = rating >= 88 ? "text-accent-gold" : rating >= 83 ? "text-theme-primary" : rating >= 78 ? "text-white" : "text-gray-400";
  return (
    <span className={`inline-flex min-w-[2.25rem] justify-center rounded-full bg-pitch-950 px-2 py-0.5 fl-number text-sm tabular-nums ${tone}`}>
      {Math.round(rating)}
      {delta ? <span className="ml-0.5 text-[10px] text-danger">−{delta}</span> : null}
    </span>
  );
}

export function FormDots({ form }: { form: string[] }) {
  return (
    <span className="inline-flex gap-1" aria-label={`Form: ${form.join(" ") || "none"}`}>
      {form.map((r, i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${r === "W" ? "bg-success" : r === "D" ? "bg-gray-400" : "bg-danger"}`}
          aria-hidden
        />
      ))}
    </span>
  );
}
