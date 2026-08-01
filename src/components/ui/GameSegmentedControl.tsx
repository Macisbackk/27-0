"use client";

import type { ReactNode } from "react";
import { playTabChange, playUiClick } from "@/lib/sound";
import { TYPO } from "@/lib/ui/typography";

export type GameSegmentedOption<T extends string> = {
  id: T;
  label: string;
  shortLabel?: string;
  /** Mode colour when selected — Current green / Era gold. */
  tone?: "default" | "current" | "era";
};

interface GameSegmentedControlProps<T extends string> {
  options: readonly GameSegmentedOption<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
  ariaLabel?: string;
  label?: string;
  /** Sidebar / nested — slightly tighter. */
  compact?: boolean;
  /** Stretch to parent width (avoid for 2-option toggles). */
  fullWidth?: boolean;
}

/**
 * Compact centred segmented control — Current/Era, Squad/Tactics, etc.
 */
export function GameSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = "",
  ariaLabel,
  label,
  compact = false,
  fullWidth = false,
}: GameSegmentedControlProps<T>) {
  return (
    <div
      className={`mode-toggle-wrap ${className}`.trim()}
      data-compact={compact ? "true" : undefined}
    >
      {label ? (
        <p className={`mode-toggle-wrap__label ${TYPO.sectionLabel}`}>{label}</p>
      ) : null}
      <div
        className={`mode-toggle${fullWidth ? " mode-toggle--full" : ""}${compact ? " mode-toggle--compact" : ""}`}
        role="tablist"
        aria-label={ariaLabel ?? label}
      >
        {options.map((opt) => {
          const active = value === opt.id;
          const tone = opt.tone ?? "default";
          const activeClass = active
            ? tone === "era"
              ? "active era"
              : tone === "current"
                ? "active current"
                : "active"
            : "";
          return (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={active}
              title={opt.label}
              className={activeClass}
              onClick={() => {
                if (active) return;
                playTabChange();
                playUiClick();
                onChange(opt.id);
              }}
            >
              {opt.shortLabel ? (
                <>
                  <span className="whitespace-normal text-center leading-tight sm:hidden">
                    {opt.shortLabel}
                  </span>
                  <span className="hidden whitespace-normal text-center leading-tight sm:inline">
                    {opt.label}
                  </span>
                </>
              ) : (
                <span className="whitespace-normal text-center leading-tight">
                  {opt.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function GameSegmentedControlShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mode-toggle-wrap ${className}`.trim()}>{children}</div>
  );
}
