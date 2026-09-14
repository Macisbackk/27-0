"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useManager } from "@/lib/manager/context";
import {
  CLUB_REPUTATION_BY_NAME,
  CHAMPIONSHIP_CLUB_REPUTATION_BY_NAME,
} from "../../../data/club-reputation";
import { STADIUMS, CLUB_COLORS, toClubId } from "@/lib/manager/database";
import {
  type SaveMetadata,
} from "@/lib/manager/storage";
import { isLoggedIn } from "@/lib/auth-session";
import { isSupabaseConfigured } from "@/lib/supabase";

export function ManagerClubSelect() {
  const { startNewGame, loadFromSlot, deleteSave, importSave } = useManager();

  // Save inspection state
  const [availableSaves, setAvailableSaves] = useState<SaveMetadata[]>([]);
  const [recentSave, setRecentSave] = useState<SaveMetadata | null>(null);
  const [slotMetas, setSlotMetas] = useState<Record<string, SaveMetadata | null>>({});
  const [deleteConfirmSlot, setDeleteConfirmSlot] = useState<number | "auto" | null>(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<"idle" | "syncing" | "done" | "skipped">(
    "idle"
  );

  // Active Start Screen Mode: "load" | "new" | "import"
  const [mode, setMode] = useState<"load" | "new" | "import">("load");

  // New Career state
  const [targetSlot, setTargetSlot] = useState<number>(0);
  const [activeTier, setActiveTier] = useState<"championship" | "super-league">("championship");
  const [selectedClubName, setSelectedClubName] = useState<string>("Widnes Vikings");
  const [managerName, setManagerName] = useState<string>("Coach");
  const [champFilter, setChampFilter] = useState<"all" | 3 | 2 | 1>("all");

  // Import state
  const [importJson, setImportJson] = useState<string>("");
  const [importTargetSlot, setImportTargetSlot] = useState<number>(0);
  const [importError, setImportError] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Refresh available saves on mount — set mode only once after first recover
  // (cloud re-sync must not flip new↔load and jitter the UI).
  const modeInitializedRef = useRef(false);

  const refreshSaves = useCallback(async (opts?: { initMode?: boolean }) => {
    const { recoverAllSaveMetadata, getMostRecentSave, getSaveSlotMetadata } = await import(
      "@/lib/manager/storage"
    );
    const all = await recoverAllSaveMetadata();
    const recent = getMostRecentSave();
    setAvailableSaves(all);
    setRecentSave(recent);

    const metas: Record<string, SaveMetadata | null> = {
      0: getSaveSlotMetadata(0),
      1: getSaveSlotMetadata(1),
      2: getSaveSlotMetadata(2),
      auto: getSaveSlotMetadata("auto"),
    };
    setSlotMetas(metas);

    if (opts?.initMode && !modeInitializedRef.current) {
      modeInitializedRef.current = true;
      setMode(all.length === 0 ? "new" : "load");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const { awaitManagerExitFlush, syncManagerSavesWithCloud } = await import(
        "@/lib/manager/saves-cloud"
      );
      // Wait for exit-to-menu flush so cloud sync cannot race a just-written autosave.
      await awaitManagerExitFlush();
      if (cancelled) return;

      await refreshSaves({ initMode: true });
      if (cancelled) return;

      if (!isSupabaseConfigured || !isLoggedIn()) {
        if (!cancelled) setCloudSyncStatus("skipped");
        return;
      }
      if (!cancelled) setCloudSyncStatus("syncing");
      try {
        await syncManagerSavesWithCloud();
      } catch {
        /* local list still usable */
      }
      if (!cancelled) {
        await refreshSaves();
        setCloudSyncStatus("done");
      }
    };

    void run();

    const onAuth = () => {
      void run();
    };
    window.addEventListener("auth-state-changed", onAuth);
    return () => {
      cancelled = true;
      window.removeEventListener("auth-state-changed", onAuth);
    };
  }, [refreshSaves]);

  const champClubs = useMemo(() => {
    const list = Object.keys(CHAMPIONSHIP_CLUB_REPUTATION_BY_NAME).sort((a, b) => {
      const repDiff = (CHAMPIONSHIP_CLUB_REPUTATION_BY_NAME[b] || 1) - (CHAMPIONSHIP_CLUB_REPUTATION_BY_NAME[a] || 1);
      if (repDiff !== 0) return repDiff;
      return a.localeCompare(b);
    });
    if (champFilter === "all") return list;
    return list.filter((name) => CHAMPIONSHIP_CLUB_REPUTATION_BY_NAME[name] === champFilter);
  }, [champFilter]);

  const slClubs = Object.keys(CLUB_REPUTATION_BY_NAME);
  const displayClubs = activeTier === "championship" ? champClubs : slClubs;

  const currentClubRep =
    activeTier === "championship"
      ? CHAMPIONSHIP_CLUB_REPUTATION_BY_NAME[selectedClubName] || 2
      : CLUB_REPUTATION_BY_NAME[selectedClubName] || 3;

  const currentStadium = STADIUMS[selectedClubName] || { name: "Community Stadium", capacity: 8000 };
  const currentColors = CLUB_COLORS[selectedClubName] || { primary: "#1E4D9B", text: "#FFFFFF" };

  const handleStartNewCareer = () => {
    const clubId = toClubId(selectedClubName);
    startNewGame(clubId, managerName.trim() || "Coach", targetSlot);
  };

  const handleLoad = (slot: number | "auto") => {
    void loadFromSlot(slot);
  };

  const handleDelete = async (slot: number | "auto") => {
    await deleteSave(slot);
    setDeleteConfirmSlot(null);
    void refreshSaves();
  };

  const handleImportSubmit = async () => {
    setImportError(null);
    if (!importJson.trim()) {
      setImportError("Please provide save JSON contents or select a .json file.");
      return;
    }
    const ok = await importSave(importJson.trim(), importTargetSlot);
    if (!ok) {
      setImportError("Failed to import save. The JSON file is invalid or not a valid Manager Mode save.");
    }
  };

  const handleFileUpload = (file: File) => {
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      void (async () => {
        const content = e.target?.result as string;
        if (content) {
          setImportJson(content);
          const ok = await importSave(content, importTargetSlot);
          if (!ok) {
            setImportError("Failed to import save from uploaded file. Invalid JSON structure.");
          }
        }
      })();
    };
    reader.onerror = () => {
      setImportError("Failed to read file.");
    };
    reader.readAsText(file);
  };

  const getSlotTitle = (slot: number | "auto") => {
    if (slot === "auto") return "Auto-Save Checkpoint";
    return `Save Slot ${slot + 1}`;
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12 space-y-8">
      {/* Header & Subtitle */}
      <div className="text-center space-y-2">
        <span className="inline-block rounded-full bg-emerald-500/20 px-3.5 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
          Rugby League Career
        </span>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
          Manager Mode Headquarters
        </h1>
        <p className="text-sm sm:text-base text-pitch-300 max-w-2xl mx-auto">
          Resume a career or start fresh — Championship promotion or Super League silverware.
        </p>
        {cloudSyncStatus === "syncing" ? (
          <p className="text-xs text-emerald-400/90 mt-2">Syncing careers with your account…</p>
        ) : cloudSyncStatus === "done" && isLoggedIn() ? (
          <p className="text-xs text-pitch-400 mt-2">
            Signed in — careers sync across desktop and mobile on this account.
          </p>
        ) : cloudSyncStatus === "skipped" && isSupabaseConfigured ? (
          <p className="text-xs text-pitch-500 mt-2">
            Sign in to sync Manager careers between desktop and mobile. JSON import still works offline.
          </p>
        ) : null}
      </div>

      {/* Quick Resume Hero Banner (When a recent save is available) */}
      {recentSave && (
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/40 via-pitch-900/90 to-pitch-950 p-5 sm:p-6 shadow-xl backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg shadow-md border border-white/20 shrink-0"
                style={{
                  backgroundColor: CLUB_COLORS[recentSave.clubName]?.primary || "#047857",
                  color: CLUB_COLORS[recentSave.clubName]?.text || "#FFFFFF",
                }}
              >
                {recentSave.clubName.slice(0, 3).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                    Latest Save Checkpoint ({getSlotTitle(recentSave.slot)})
                  </span>
                  <span className="rounded-full bg-pitch-800 px-2 py-0.5 text-[10px] font-semibold text-pitch-300 border border-pitch-700">
                    {recentSave.divisionName || (recentSave.competitionId === "super-league" ? "Super League" : "Championship")}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white truncate">
                  {recentSave.clubName}
                </h2>
                <p className="text-xs text-pitch-300">
                  Manager: <span className="font-semibold text-white">{recentSave.managerName || "Coach"}</span> · Season {recentSave.season}, Week {recentSave.week}
                  {recentSave.savedAt && <span className="text-pitch-400"> · Saved {recentSave.savedAt}</span>}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => handleLoad(recentSave.slot)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-6 py-3 font-bold text-slate-950 shadow-lg hover:brightness-110 active:scale-95 transition-all text-sm"
              >
                <span>▶ Continue Career</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Primary Mode Tabs */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-2xl bg-pitch-900/90 p-1.5 border border-pitch-800 shadow-md">
          <button
            type="button"
            onClick={() => setMode("load")}
            className={`flex items-center gap-2 rounded-xl px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-bold transition-all ${
              mode === "load"
                ? "bg-emerald-600 text-white shadow-md"
                : "text-pitch-400 hover:text-white"
            }`}
          >
            <span>📂 Load Saved Game</span>
            {availableSaves.length > 0 && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                mode === "load" ? "bg-emerald-800 text-emerald-100" : "bg-pitch-800 text-pitch-300"
              }`}>
                {availableSaves.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMode("new")}
            className={`flex items-center gap-2 rounded-xl px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-bold transition-all ${
              mode === "new"
                ? "bg-emerald-600 text-white shadow-md"
                : "text-pitch-400 hover:text-white"
            }`}
          >
            <span>➕ Start New Career</span>
          </button>

          <button
            type="button"
            onClick={() => setMode("import")}
            className={`flex items-center gap-2 rounded-xl px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-bold transition-all ${
              mode === "import"
                ? "bg-emerald-600 text-white shadow-md"
                : "text-pitch-400 hover:text-white"
            }`}
          >
            <span>📥 Import Save</span>
          </button>
        </div>
      </div>

      {/* MODE 1: LOAD SAVED GAME */}
      {mode === "load" && (
        <div className="space-y-6">
          <div className="text-center sm:text-left">
            <h2 className="text-lg sm:text-xl font-bold text-white">Select a Save to Resume</h2>
            <p className="text-xs sm:text-sm text-pitch-400">
              Pick a career slot to load your managerial progress and jump straight back onto the touchline.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {([0, 1, 2, "auto"] as (number | "auto")[]).map((slotKey) => {
              const meta = slotMetas[String(slotKey)];
              const isRecent = recentSave && recentSave.slot === slotKey;
              const slotColors = meta ? (CLUB_COLORS[meta.clubName] || { primary: "#1E4D9B", text: "#FFFFFF" }) : null;

              if (!meta) {
                return (
                  <div
                    key={String(slotKey)}
                    className="flex flex-col justify-between rounded-2xl border border-dashed border-pitch-800 bg-pitch-900/40 p-5 text-center min-h-[220px]"
                  >
                    <div>
                      <span className="inline-block rounded-md bg-pitch-800/80 px-2 py-0.5 text-[10px] font-bold uppercase text-pitch-400 border border-pitch-700/60 mb-3">
                        {getSlotTitle(slotKey)}
                      </span>
                      <p className="text-sm font-semibold text-pitch-400 mt-2">Empty Save Slot</p>
                      <p className="text-xs text-pitch-500 mt-1">
                        No manager career saved in this slot.
                      </p>
                    </div>

                    {slotKey !== "auto" && (
                      <button
                        type="button"
                        onClick={() => {
                          setTargetSlot(slotKey as number);
                          setMode("new");
                        }}
                        className="mt-4 rounded-xl border border-pitch-700 bg-pitch-800/80 hover:bg-pitch-700 py-2 text-xs font-bold text-pitch-200 hover:text-white transition-all"
                      >
                        ➕ Start New Career Here
                      </button>
                    )}
                  </div>
                );
              }

              return (
                <div
                  key={String(slotKey)}
                  className={`flex flex-col justify-between rounded-2xl border p-5 transition-all shadow-lg ${
                    isRecent
                      ? "border-emerald-500/80 bg-gradient-to-b from-pitch-900/90 to-emerald-950/20 ring-1 ring-emerald-500/40"
                      : "border-pitch-700 bg-pitch-900/80 hover:border-pitch-600"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-pitch-800 px-2 py-0.5 text-[10px] font-bold uppercase text-pitch-300 border border-pitch-700">
                        {getSlotTitle(slotKey)}
                      </span>
                      {isRecent && (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                          Active
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm shadow-md border border-white/20 shrink-0"
                        style={{
                          backgroundColor: slotColors?.primary || "#1E4D9B",
                          color: slotColors?.text || "#FFFFFF",
                        }}
                      >
                        {meta.clubName.slice(0, 3).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-sm sm:text-base text-white truncate">
                          {meta.clubName}
                        </h3>
                        <p className="text-[11px] font-semibold text-emerald-400 truncate">
                          {meta.divisionName || (meta.competitionId === "super-league" ? "Super League" : "Championship")}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl bg-pitch-950/60 p-2.5 text-xs text-pitch-300 space-y-1 border border-pitch-800/80">
                      <div className="flex justify-between">
                        <span className="text-pitch-400">Manager:</span>
                        <span className="font-bold text-white truncate ml-1">{meta.managerName || "Coach"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-pitch-400">Timeline:</span>
                        <span className="font-semibold text-pitch-200">Season {meta.season}, Wk {meta.week}</span>
                      </div>
                      {meta.savedAt && (
                        <div className="flex justify-between text-[10px] pt-0.5 border-t border-pitch-800/60 text-pitch-400">
                          <span>Saved:</span>
                          <span className="truncate ml-1">{meta.savedAt}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-3 border-t border-pitch-800 space-y-2">
                    {deleteConfirmSlot === slotKey ? (
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-bold text-rose-300 text-center">
                          Delete this save permanently?
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleDelete(slotKey)}
                            className="flex-1 rounded-xl bg-rose-600 py-1.5 text-xs font-bold text-white hover:bg-rose-500 shadow"
                          >
                            Yes, Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmSlot(null)}
                            className="flex-1 rounded-xl bg-pitch-800 py-1.5 text-xs font-bold text-pitch-300 hover:text-white"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleLoad(slotKey)}
                          className="flex-1 rounded-xl bg-emerald-600 py-2 text-center text-xs font-bold text-white hover:bg-emerald-500 shadow-md transition-all flex items-center justify-center gap-1.5"
                        >
                          <span>▶ Load Career</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmSlot(slotKey)}
                          className="rounded-xl border border-rose-800/50 bg-rose-950/40 px-2.5 py-2 text-xs font-bold text-rose-300 hover:bg-rose-900/60 transition-all"
                          title="Delete save slot"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODE 2: START NEW CAREER */}
      {mode === "new" && (
        <div className="space-y-6">
          {/* Target Slot Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-pitch-800 bg-pitch-900/60 p-4">
            <div>
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Select Save Slot Destination
              </span>
              <p className="text-xs text-pitch-400">
                Choose which save slot to allocate for your new managerial career.
              </p>
            </div>
            <div className="inline-flex rounded-xl bg-pitch-950 p-1 border border-pitch-800">
              {[0, 1, 2].map((slotIdx) => {
                const meta = slotMetas[String(slotIdx)];
                return (
                  <button
                    key={slotIdx}
                    type="button"
                    onClick={() => setTargetSlot(slotIdx)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                      targetSlot === slotIdx
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-pitch-400 hover:text-white"
                    }`}
                  >
                    Slot {slotIdx + 1}
                    {meta ? ` (${meta.clubName.slice(0, 6)}..)` : " (Empty)"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tier Switcher */}
          <div className="flex justify-center">
            <div className="inline-flex rounded-xl bg-pitch-900 p-1 border border-pitch-800">
              <button
                type="button"
                onClick={() => {
                  setActiveTier("championship");
                  setSelectedClubName("Widnes Vikings");
                }}
                className={`rounded-lg px-5 py-2 text-sm font-bold transition-all ${
                  activeTier === "championship"
                    ? "bg-emerald-600 text-white shadow-md"
                    : "text-pitch-400 hover:text-white"
                }`}
              >
                Championship (Promotion Challenge)
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTier("super-league");
                  setSelectedClubName("Wigan Warriors");
                }}
                className={`rounded-lg px-5 py-2 text-sm font-bold transition-all ${
                  activeTier === "super-league"
                    ? "bg-emerald-600 text-white shadow-md"
                    : "text-pitch-400 hover:text-white"
                }`}
              >
                Super League (Elite Competition)
              </button>
            </div>
          </div>

          {/* Main Grid: Clubs List + Selected Preview */}
          <div className="grid gap-6 lg:grid-cols-12 items-start">
            {/* Left: Club Selection Cards */}
            <div className="lg:col-span-7 flex flex-col gap-2.5">
              {activeTier === "championship" && (
                <div className="flex flex-wrap items-center gap-1.5 pb-1">
                  <span className="text-xs text-pitch-400 font-semibold mr-1">Filter:</span>
                  <button
                    type="button"
                    onClick={() => setChampFilter("all")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                      champFilter === "all"
                        ? "bg-pitch-700 text-white border border-pitch-600"
                        : "text-pitch-400 hover:text-white bg-pitch-900 border border-pitch-800"
                    }`}
                  >
                    All (22)
                  </button>
                  <button
                    type="button"
                    onClick={() => setChampFilter(3)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                      champFilter === 3
                        ? "bg-amber-600/30 text-amber-300 border border-amber-500/50"
                        : "text-pitch-400 hover:text-white bg-pitch-900 border border-pitch-800"
                    }`}
                  >
                    ★★★ Favourites (4)
                  </button>
                  <button
                    type="button"
                    onClick={() => setChampFilter(2)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                      champFilter === 2
                        ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/50"
                        : "text-pitch-400 hover:text-white bg-pitch-900 border border-pitch-800"
                    }`}
                  >
                    ★★ Contenders (7)
                  </button>
                  <button
                    type="button"
                    onClick={() => setChampFilter(1)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                      champFilter === 1
                        ? "bg-sky-600/30 text-sky-300 border border-sky-500/50"
                        : "text-pitch-400 hover:text-white bg-pitch-900 border border-pitch-800"
                    }`}
                  >
                    ★ Underdogs (11)
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-pitch-700">
                {displayClubs.map((clubName) => {
                  const isSelected = selectedClubName === clubName;
                  const stars =
                    activeTier === "championship"
                      ? CHAMPIONSHIP_CLUB_REPUTATION_BY_NAME[clubName] || 2
                      : CLUB_REPUTATION_BY_NAME[clubName] || 3;
                  const colors = CLUB_COLORS[clubName] || { primary: "#1E4D9B", text: "#FFFFFF" };

                  return (
                    <button
                      key={clubName}
                      type="button"
                      onClick={() => setSelectedClubName(clubName)}
                      className={`flex flex-col items-center justify-between p-3 rounded-xl border text-center transition-all ${
                        isSelected
                          ? "border-emerald-400 bg-pitch-800/90 ring-2 ring-emerald-500/50 shadow-md"
                          : "border-pitch-800 bg-pitch-900/60 hover:bg-pitch-800/60 hover:border-pitch-700"
                      }`}
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs shadow-sm mb-2 border border-white/20"
                        style={{ backgroundColor: colors.primary, color: colors.text }}
                      >
                        {clubName.slice(0, 3).toUpperCase()}
                      </div>
                      <div className="font-bold text-xs text-white truncate w-full">
                        {clubName}
                      </div>
                      <div className="flex gap-0.5 mt-1 text-amber-400 text-xs">
                        {"★".repeat(stars)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Selected Club Profile & Launch Form */}
            <div className="lg:col-span-5 rounded-2xl border border-pitch-700 bg-pitch-900/90 p-5 shadow-xl backdrop-blur-md">
              <div className="flex items-center gap-4 mb-4 pb-4 border-b border-pitch-800">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg shadow-md border border-white/20"
                  style={{ backgroundColor: currentColors.primary, color: currentColors.text }}
                >
                  {selectedClubName.slice(0, 3).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedClubName}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-pitch-300 uppercase tracking-wide">
                      {activeTier === "championship" ? "Championship" : "Super League"}
                    </span>
                    <span className="text-amber-400 text-sm">
                      {"★".repeat(currentClubRep)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-xs sm:text-sm text-pitch-300 mb-5">
                <div className="flex justify-between py-1 border-b border-pitch-800/50">
                  <span className="text-pitch-400">Home Ground</span>
                  <span className="font-semibold text-white">{currentStadium.name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-pitch-800/50">
                  <span className="text-pitch-400">Capacity</span>
                  <span className="font-semibold text-white">{currentStadium.capacity.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-pitch-800/50">
                  <span className="text-pitch-400">Starting Balance</span>
                  <span className="font-semibold text-emerald-400">
                    {activeTier === "championship" ? "£100,000" : "£350,000"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-pitch-800/50">
                  <span className="text-pitch-400">Salary Cap</span>
                  <span className="font-semibold text-sky-400">
                    {activeTier === "championship" ? "£1,000,000 / yr" : "£2,100,000 / yr"}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-pitch-400">Board Expectation</span>
                  <span className="font-semibold text-amber-300">
                    {activeTier === "championship"
                      ? (currentClubRep === 3 ? "Promotion Favourites" : (currentClubRep === 2 ? "Championship Playoff Contenders" : "Consolidate Championship Status"))
                      : (currentClubRep >= 4 ? "Grand Final Contenders" : (currentClubRep === 3 ? "Top 6 Playoff Spot" : "Avoid Relegation"))}
                  </span>
                </div>
              </div>

              <div className="mb-5">
                <label htmlFor="manager-name-input" className="block text-xs font-semibold text-pitch-300 mb-1.5">
                  Manager Name
                </label>
                <input
                  id="manager-name-input"
                  type="text"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-3.5 py-2.5 text-sm text-white placeholder-pitch-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <button
                type="button"
                onClick={handleStartNewCareer}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 py-3 text-center text-sm font-bold text-slate-950 shadow-lg hover:brightness-110 active:scale-98 transition-all"
              >
                Take Charge of {selectedClubName} (Slot {targetSlot + 1})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODE 3: IMPORT SAVE */}
      {mode === "import" && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-bold text-white">Import Career Save File</h2>
            <p className="text-xs sm:text-sm text-pitch-400 mt-1">
              Restore a JSON backup. Signed-in careers also sync automatically between devices.
            </p>
          </div>

          {importError && (
            <div className="rounded-xl border border-rose-500/50 bg-rose-950/40 p-3.5 text-xs font-semibold text-rose-300 flex items-center justify-between">
              <span>{importError}</span>
              <button
                type="button"
                onClick={() => setImportError(null)}
                className="text-rose-400 hover:text-white ml-2 text-xs"
              >
                ✕
              </button>
            </div>
          )}

          {/* Import Slot Destination */}
          <div className="flex items-center justify-between rounded-xl border border-pitch-800 bg-pitch-900/60 p-3">
            <span className="text-xs font-semibold text-pitch-300">
              Import Into Slot:
            </span>
            <div className="inline-flex rounded-lg bg-pitch-950 p-1 border border-pitch-800">
              {[0, 1, 2].map((slotIdx) => (
                <button
                  key={slotIdx}
                  type="button"
                  onClick={() => setImportTargetSlot(slotIdx)}
                  className={`rounded-md px-3 py-1 text-xs font-bold transition-all ${
                    importTargetSlot === slotIdx
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-pitch-400 hover:text-white"
                  }`}
                >
                  Slot {slotIdx + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Drag & Drop File Area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingFile(true);
            }}
            onDragLeave={() => setIsDraggingFile(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingFile(false);
              const files = e.dataTransfer.files;
              if (files && files.length > 0) {
                handleFileUpload(files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
              isDraggingFile
                ? "border-emerald-400 bg-emerald-950/30"
                : "border-pitch-700 bg-pitch-900/50 hover:border-pitch-600 hover:bg-pitch-900/80"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                  handleFileUpload(files[0]);
                }
              }}
            />
            <div className="text-3xl mb-2">📄</div>
            <p className="text-sm font-bold text-white">
              Drop your .json save file here, or click to browse
            </p>
            <p className="text-xs text-pitch-400 mt-1">
              Supports full Manager Mode exports (.json)
            </p>
          </div>

          {/* Direct JSON Paste Area */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-pitch-300">
              Or paste JSON save contents directly:
            </label>
            <textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder="Paste JSON save contents here..."
              rows={5}
              className="w-full rounded-xl border border-pitch-700 bg-pitch-950 p-3 text-xs text-pitch-200 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <button
            type="button"
            onClick={handleImportSubmit}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 py-3 text-center text-sm font-bold text-slate-950 shadow-lg hover:brightness-110 active:scale-98 transition-all"
          >
            Verify &amp; Load Save (Into Slot {importTargetSlot + 1})
          </button>
        </div>
      )}
    </div>
  );
}
