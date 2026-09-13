"use client";

import React, { useEffect, useState } from "react";
import { useManager } from "@/lib/manager/context";
import { MANAGER_TUTORIAL_STEPS } from "@/lib/manager/onboarding";
import { acquireScrollLock, releaseScrollLock } from "@/lib/ui/scroll-lock";

export function ManagerTutorialModal() {
  const { tutorialOpen, dismissTutorial, setActiveTab } = useManager();
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    if (!tutorialOpen) return;
    setStepIdx(0);
    const lockId = acquireScrollLock("manager-tutorial");
    return () => {
      releaseScrollLock(lockId);
    };
  }, [tutorialOpen]);

  if (!tutorialOpen) return null;

  const steps = MANAGER_TUTORIAL_STEPS;
  const step = steps[stepIdx];
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === steps.length - 1;
  const progressPct = ((stepIdx + 1) / steps.length) * 100;

  const finish = (goToHint: boolean) => {
    const hint = goToHint ? step.tabHint : undefined;
    dismissTutorial();
    if (hint) setActiveTab(hint);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-5">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-emerald-500/40 bg-pitch-950 p-5 sm:p-6 shadow-2xl space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-black text-emerald-400 border border-emerald-500/30 uppercase tracking-widest">
              {step.eyebrow}
            </span>
            <span className="text-[11px] font-bold text-pitch-500">
              {stepIdx + 1} / {steps.length}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-pitch-900 border border-pitch-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-[width] duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-xl sm:text-2xl font-black text-white">{step.title}</h2>
          <p className="text-xs sm:text-sm text-pitch-300 leading-relaxed">{step.body}</p>
        </div>

        {step.bullets && step.bullets.length > 0 && (
          <ul className="space-y-2">
            {step.bullets.map((bullet) => (
              <li
                key={bullet}
                className="flex items-start gap-2.5 rounded-xl border border-pitch-800 bg-pitch-900/60 px-3 py-2.5 text-xs text-pitch-200"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-500/20 text-[10px] font-black text-emerald-400 border border-emerald-500/30">
                  ✓
                </span>
                <span className="leading-relaxed">{bullet}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          {!isLast ? (
            <>
              <button
                type="button"
                onClick={() => setStepIdx((i) => i + 1)}
                className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 py-3 text-center text-sm font-black text-slate-950 shadow-lg hover:brightness-110 active:scale-[0.98] transition-all"
              >
                Next →
              </button>
              <button
                type="button"
                onClick={() => finish(false)}
                className="flex-1 rounded-2xl border border-pitch-700 bg-pitch-900 py-3 text-center text-sm font-bold text-pitch-200 hover:bg-pitch-800 transition-all"
              >
                Skip guide
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => finish(true)}
                className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 py-3 text-center text-sm font-black text-slate-950 shadow-lg hover:brightness-110 active:scale-[0.98] transition-all"
              >
                {step.tabHint === "tactics" ? "Open Tactics →" : "Got it →"}
              </button>
              <button
                type="button"
                onClick={() => finish(false)}
                className="flex-1 rounded-2xl border border-pitch-700 bg-pitch-900 py-3 text-center text-sm font-bold text-pitch-200 hover:bg-pitch-800 transition-all"
              >
                Close
              </button>
            </>
          )}
        </div>

        {!isFirst && (
          <button
            type="button"
            onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
            className="w-full text-center text-[11px] font-semibold text-pitch-500 hover:text-pitch-300"
          >
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}
