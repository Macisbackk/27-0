"use client";

import React, { useEffect, useState } from "react";
import { useManager } from "@/lib/manager/context";
import { needsFriendlySelection } from "@/lib/manager/competitions";
import { uiLayerClass } from "@/lib/ui/layers";
import { useScrollLock } from "@/hooks/useScrollLock";

export function ManagerFriendlySelectModal() {
  const { state, confirmFriendliesSelection, autoPickFriendliesSelection } = useManager();
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const open = Boolean(
    state && needsFriendlySelection(state) && state.calendar.currentWeek <= 2
  );
  useScrollLock(open, "manager-friendly-select");

  const pendingKey = (state?.pendingFriendlyOpponents || []).join(",");
  useEffect(() => {
    setSelected([]);
    setError(null);
    setBusy(false);
  }, [pendingKey]);

  if (!state || !open) return null;

  const pending = state.pendingFriendlyOpponents || [];

  const toggle = (clubId: string) => {
    setError(null);
    setSelected((prev) => {
      if (prev.includes(clubId)) return prev.filter((id) => id !== clubId);
      if (prev.length >= 3) return prev;
      return [...prev, clubId];
    });
  };

  const handleConfirm = () => {
    if (busy) return;
    if (selected.length !== 3) {
      setError("Select exactly 3 opponents.");
      return;
    }
    setBusy(true);
    const res = confirmFriendliesSelection(selected);
    if (!res.success) {
      setError(res.error || "Could not confirm friendlies.");
      setBusy(false);
      return;
    }
    setBusy(false);
  };

  const handleAutoPick = () => {
    if (busy) return;
    setBusy(true);
    const res = autoPickFriendliesSelection();
    if (!res.success) {
      setError(res.error || "Could not auto-pick friendlies.");
      setBusy(false);
      return;
    }
    setBusy(false);
  };

  return (
    <div
      className={`fixed inset-0 ${uiLayerClass("modalBackdrop")} flex items-center justify-center bg-black p-3 sm:p-5`}
      role="dialog"
      aria-modal="true"
      aria-label="Select friendly opponents"
    >
      <div className="w-full max-w-lg max-h-[min(90dvh,100%)] overflow-y-auto rounded-3xl border border-sky-500/35 bg-pitch-950 p-5 sm:p-6 shadow-2xl space-y-4">
        <div className="text-center space-y-1">
          <span className="rounded-full bg-sky-500/20 px-3 py-1 text-[10px] font-black text-sky-300 border border-sky-500/30 uppercase tracking-widest inline-block">
            Pre-Season
          </span>
          <h2 className="text-xl font-black text-white">Pick 3 Friendlies</h2>
          <p className="text-xs text-pitch-400">
            Choose three opponents from the six clubs below. Fixtures land in weeks 1–3
            (home / away / home).
          </p>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {pending.map((clubId) => {
            const club = state.clubs[clubId];
            const isOn = selected.includes(clubId);
            return (
              <li key={clubId}>
                <button
                  type="button"
                  onClick={() => toggle(clubId)}
                  disabled={busy || (!isOn && selected.length >= 3)}
                  className={`w-full flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all disabled:opacity-50 ${
                    isOn
                      ? "border-sky-400/60 bg-sky-500/15"
                      : "border-pitch-700 bg-pitch-900/80 hover:bg-pitch-800"
                  }`}
                >
                  <span
                    className="h-8 w-8 rounded-lg border border-white/20 shrink-0 overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, ${club?.primaryColor || "#1E4D9B"} 50%, ${
                        club?.secondaryColor || club?.primaryColor || "#0B1F3A"
                      } 50%)`,
                    }}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-white truncate">
                      {club?.name || clubId}
                    </span>
                    <span className="text-[10px] text-pitch-400 uppercase">
                      {club?.competitionId === "super-league" ? "Super League" : "Championship"}
                    </span>
                  </span>
                  {isOn && (
                    <span className="ml-auto text-[10px] font-black text-sky-300 uppercase">
                      Selected
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <p className="text-center text-xs text-pitch-400">
          {selected.length} of 3 selected
        </p>

        {error && (
          <p className="text-xs font-semibold text-rose-400 text-center">{error}</p>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button
            type="button"
            disabled={busy || selected.length !== 3}
            onClick={handleConfirm}
            className="flex-1 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 py-3 text-sm font-black text-slate-950 shadow-lg hover:brightness-110 active:scale-98 transition-all disabled:opacity-60"
          >
            Confirm Friendlies
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleAutoPick}
            className="flex-1 rounded-2xl border border-pitch-700 bg-pitch-900 py-3 text-sm font-bold text-pitch-200 hover:bg-pitch-800 transition-all disabled:opacity-60"
          >
            Auto-pick 3
          </button>
        </div>
      </div>
    </div>
  );
}
