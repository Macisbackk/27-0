"use client";

import { buildRunProgressSteps, type RunProgressStage } from "@/lib/game/draft-flow";

interface RunProgressProps {
  stage: RunProgressStage;
  filledCount: number;
  totalSlots: number;
  className?: string;
}

/** Honest run progress: "Squad 7/13 → Season → Play-offs". */
export function RunProgress({ stage, filledCount, totalSlots, className = "" }: RunProgressProps) {
  const steps = buildRunProgressSteps(stage, filledCount, totalSlots);
  const active = steps.find((s) => s.state === "active");
  return (
    <nav aria-label="Run progress" className={`flex items-center justify-center gap-1.5 text-[12px] font-bold ${className}`.trim()}>
      <span className="sr-only">{`Now: ${active?.label ?? ""}`}</span>
      {steps.map((step, i) => (
        <span key={step.id} className="flex items-center gap-1.5" aria-hidden>
          {i > 0 ? <span className="text-[color:var(--fl-muted)]">→</span> : null}
          <span
            className={`rounded-full px-2.5 py-1 tabular-nums ${
              step.state === "active"
                ? "bg-theme-primary/15 text-theme-primary"
                : step.state === "done"
                  ? "text-gray-300"
                  : "text-[color:var(--fl-muted)]"
            }`}
          >
            {step.state === "done" ? "✓ " : ""}
            {step.label}
          </span>
        </span>
      ))}
    </nav>
  );
}
