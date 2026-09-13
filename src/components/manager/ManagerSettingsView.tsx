"use client";

import React, { useState, useEffect } from "react";
import { useManager } from "@/lib/manager/context";
import {
  getSaveSlotMetadata,
  getActiveSlotIndex,
  type SaveMetadata,
} from "@/lib/manager/storage";

export function ManagerSettingsView() {
  const {
    state,
    saveToSlot,
    loadFromSlot,
    deleteSave,
    resetCareer,
    exitToMenu,
    exportSave,
    importSave,
    openTutorial,
    updateSettings,
  } = useManager();

  const [importJson, setImportJson] = useState("");
  const [showImportArea, setShowImportArea] = useState(false);
  const [confirmNewCareer, setConfirmNewCareer] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [slotMetas, setSlotMetas] = useState<Record<number, SaveMetadata | null>>({});

  useEffect(() => {
    const metas: Record<number, SaveMetadata | null> = {
      0: getSaveSlotMetadata(0),
      1: getSaveSlotMetadata(1),
      2: getSaveSlotMetadata(2),
    };
    setSlotMetas(metas);
  }, [state]);

  if (!state) return null;

  const handleExport = () => {
    const jsonStr = exportSave();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `27-0-manager-save-s${state.calendar.currentSeason}-w${state.calendar.currentWeek}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatusNotice("Save exported successfully.");
  };

  const handleImportSubmit = async () => {
    if (!importJson.trim()) return;
    const ok = await importSave(importJson.trim());
    if (ok) {
      setStatusNotice("Save game imported and loaded successfully!");
      setShowImportArea(false);
      setImportJson("");
    } else {
      setStatusNotice("Failed to import save. Invalid or corrupted JSON.");
    }
  };

  const handleSaveToSlot = async (slot: number) => {
    const res = await saveToSlot(slot);
    if (res.success) {
      setStatusNotice(`Game saved successfully to Slot ${slot + 1}.`);
      setSlotMetas((prev) => ({ ...prev, [slot]: getSaveSlotMetadata(slot) }));
    } else {
      setStatusNotice(`Failed to save: ${res.error}`);
    }
  };

  const handleLoadSlot = async (slot: number) => {
    const ok = await loadFromSlot(slot);
    if (ok) {
      setStatusNotice(`Loaded game from Slot ${slot + 1}.`);
    } else {
      setStatusNotice(`Failed to load Slot ${slot + 1}.`);
    }
  };

  const handleDeleteSlot = async (slot: number) => {
    if (window.confirm(`Are you sure you want to delete Slot ${slot + 1}?`)) {
      await deleteSave(slot);
      setSlotMetas((prev) => ({ ...prev, [slot]: null }));
      setStatusNotice(`Slot ${slot + 1} deleted.`);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-3 py-4 sm:px-6 sm:py-6 space-y-6">
      <div>
        <h2 className="text-lg sm:text-2xl font-black text-white">Settings</h2>
        <p className="hidden sm:block text-xs text-pitch-400">
          Manage your career save slots, export/import backups, or initiate a fresh managerial journey.
        </p>
      </div>

      {statusNotice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 font-semibold flex items-center justify-between">
          <span>{statusNotice}</span>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="text-pitch-400 hover:text-white ml-2 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Help / Tutorial */}
      <div className="rounded-2xl border border-pitch-700 bg-pitch-900/80 p-5 shadow space-y-3">
        <h3 className="text-sm font-black text-white uppercase tracking-wider">Help</h3>
        <p className="text-xs text-pitch-400">
          New to Manager Mode? Replay the quick guide covering Continue, the matchday 17 rule, salary
          cap, and transfers.
        </p>
        <button
          type="button"
          onClick={() => {
            openTutorial();
            setStatusNotice("Manager guide opened.");
          }}
          className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-4 py-2.5 text-xs font-black text-slate-950 shadow-md hover:brightness-110"
        >
          Replay Manager Guide
        </button>
      </div>

      {/* Gameplay options */}
      <div className="rounded-2xl border border-pitch-700 bg-pitch-900/80 p-5 shadow space-y-4">
        <h3 className="text-sm font-black text-white uppercase tracking-wider">Gameplay</h3>
        <label className="flex items-center justify-between gap-3 text-xs">
          <span className="text-pitch-200 font-semibold">Match sound effects</span>
          <input
            type="checkbox"
            checked={state.settings?.soundEnabled !== false}
            onChange={(e) => updateSettings({ soundEnabled: e.target.checked })}
            className="h-4 w-4 accent-emerald-500"
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-xs">
          <span className="text-pitch-200 font-semibold">Autosave progress</span>
          <input
            type="checkbox"
            checked={state.settings?.autoSaveEnabled !== false}
            onChange={(e) => updateSettings({ autoSaveEnabled: e.target.checked })}
            className="h-4 w-4 accent-emerald-500"
          />
        </label>
        <div className="space-y-1.5">
          <span className="text-xs text-pitch-200 font-semibold">Match simulation</span>
          <select
            value={state.settings?.matchSimulationSpeed || "normal"}
            onChange={(e) =>
              updateSettings({
                matchSimulationSpeed: e.target.value as "instant" | "normal" | "detailed",
              })
            }
            className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-3 py-2 text-xs text-white"
          >
            <option value="instant">Instant (skip key moments → full report)</option>
            <option value="normal">Normal (key moments matchcast)</option>
            <option value="detailed">Detailed (same as normal, fuller commentary)</option>
          </select>
        </div>
      </div>

      {/* Save Slots Grid */}
      <div className="rounded-2xl border border-pitch-800 bg-pitch-900/80 p-5 shadow-lg space-y-4">
        <h3 className="text-sm font-black text-white uppercase tracking-wider">Save Slots</h3>
        <p className="text-[11px] text-pitch-500 -mt-2">
          Manual checkpoints — Save freezes a slot; Load restores that exact week. Ongoing play is kept in Autosave only.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((slotIdx) => {
            const meta = slotMetas[slotIdx];
            const activeSlot = getActiveSlotIndex();
            const isCurrent = activeSlot === slotIdx;

            return (
              <div
                key={slotIdx}
                className={`rounded-2xl border p-4 transition-all flex flex-col justify-between ${
                  isCurrent
                    ? "border-emerald-500/60 bg-emerald-950/20 shadow-md"
                    : "border-pitch-800 bg-pitch-950/60"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-white uppercase tracking-wider">
                      Slot {slotIdx + 1}
                    </span>
                    {isCurrent && (
                      <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                        Current
                      </span>
                    )}
                  </div>

                  {meta ? (
                    <div className="text-xs text-pitch-300 space-y-1">
                      <p className="font-bold text-white truncate">{meta.clubName}</p>
                      <p className="text-[11px] text-pitch-400">
                        Season {meta.season}, Week {meta.week}
                      </p>
                      <p className="text-[10px] text-pitch-500">{meta.savedAt}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-pitch-500 italic py-4">Empty Slot</p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 pt-4 border-t border-pitch-800/60 mt-3">
                  <button
                    type="button"
                    onClick={() => handleSaveToSlot(slotIdx)}
                    className="flex-1 rounded-xl bg-pitch-800 py-1.5 text-center text-xs font-bold text-white hover:bg-pitch-700 transition-all"
                  >
                    Save
                  </button>
                  {meta && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleLoadSlot(slotIdx)}
                        className="flex-1 rounded-xl bg-emerald-600/80 py-1.5 text-center text-xs font-bold text-white hover:bg-emerald-500 transition-all"
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSlot(slotIdx)}
                        className="rounded-xl bg-rose-950/60 border border-rose-800/60 px-2 py-1.5 text-center text-xs font-bold text-rose-300 hover:bg-rose-900/80 transition-all"
                        title="Delete this save slot"
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-pitch-800">
          <p className="text-xs text-pitch-400">
            Want to switch saves or load another career?
          </p>
          <button
            type="button"
            onClick={() => {
              void saveToSlot("auto").then(() => exitToMenu());
            }}
            className="rounded-xl border border-pitch-700 bg-pitch-800 hover:bg-pitch-700 px-3.5 py-2 text-xs font-bold text-pitch-200 hover:text-white transition-all shadow flex items-center gap-2"
          >
            <span>🚪 Exit to Manager Start Menu / Switch Save</span>
          </button>
        </div>
      </div>

      {/* Cloud & Backup / JSON Import & Export */}
      <div className="rounded-2xl border border-pitch-800 bg-pitch-900/80 p-5 shadow-lg space-y-4">
        <h3 className="text-sm font-black text-white uppercase tracking-wider">
          Backup &amp; Migration
        </h3>
        <p className="text-xs text-pitch-400">
          Export your career save file to your local computer as a backup. When signed in, careers
          also sync to your account automatically across desktop and mobile.
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleExport}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition-all shadow"
          >
            Export Save as JSON 📥
          </button>
          <button
            type="button"
            onClick={() => setShowImportArea(!showImportArea)}
            className="rounded-xl bg-pitch-800 px-4 py-2.5 text-xs font-bold text-pitch-200 hover:bg-pitch-700 hover:text-white transition-all border border-pitch-700"
          >
            Import Save File 📤
          </button>
        </div>

        {showImportArea && (
          <div className="space-y-2 pt-3 border-t border-pitch-800">
            <textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder="Paste JSON save contents here..."
              rows={4}
              className="w-full rounded-xl border border-pitch-700 bg-pitch-950 p-3 text-xs text-pitch-200 focus:outline-none focus:border-emerald-500 font-mono"
            />
            <button
              type="button"
              onClick={handleImportSubmit}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500"
            >
              Verify &amp; Import Save
            </button>
          </div>
        )}
      </div>

      {/* Danger Zone: Start Fresh */}
      <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-5 shadow-lg space-y-3">
        <h3 className="text-sm font-black text-rose-400 uppercase tracking-wider">
          New Career / Reset
        </h3>
        <p className="text-xs text-pitch-400">
          Want to start over with a new club or manager? You can reset your current session and start a
          fresh career.
        </p>

        {confirmNewCareer ? (
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={resetCareer}
              className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 shadow"
            >
              Confirm Reset &amp; Start Fresh
            </button>
            <button
              type="button"
              onClick={() => setConfirmNewCareer(false)}
              className="rounded-xl bg-pitch-800 px-3 py-2 text-xs font-bold text-pitch-300 hover:text-white"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmNewCareer(true)}
            className="rounded-xl border border-rose-500/50 bg-rose-500/10 px-4 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/20 transition-all"
          >
            Start New Career...
          </button>
        )}
      </div>

      {/* Diagnostics / Invariants Summary */}
      <div className="rounded-2xl border border-pitch-800 bg-pitch-950/40 p-4 text-[11px] text-pitch-500 flex flex-wrap gap-x-6 gap-y-2">
        <span>Save Schema Version: v3 (Normalized Single Source of Truth)</span>
        <span>Clubs Loaded: {Object.keys(state.clubs).length}</span>
        <span>Players in Universe: {Object.keys(state.players).length}</span>
        <span>
          Fixtures Scheduled:{" "}
          {Object.values(state.competitions).reduce((acc, c) => acc + c.fixtures.length, 0)}
        </span>
      </div>
    </div>
  );
}
