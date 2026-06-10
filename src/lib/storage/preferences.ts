import type { GameDifficulty } from "../types";
import { STORAGE_KEYS } from "./keys";

export const HARD_MODE_CHANGED_EVENT = "27-0-hard-mode-changed";

export function getHardModeEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.hardModeEnabled);
    if (raw !== null) return raw === "1" || raw === "true";
    return localStorage.getItem(STORAGE_KEYS.difficulty) === "HARD";
  } catch {
    return false;
  }
}

export function setHardModeEnabled(enabled: boolean): void {
  const difficulty: GameDifficulty = enabled ? "HARD" : "NORMAL";
  localStorage.setItem(STORAGE_KEYS.hardModeEnabled, enabled ? "1" : "0");
  localStorage.setItem(STORAGE_KEYS.difficulty, difficulty);
  window.dispatchEvent(
    new CustomEvent(HARD_MODE_CHANGED_EVENT, { detail: difficulty })
  );
}

export function getDifficulty(): GameDifficulty {
  return getHardModeEnabled() ? "HARD" : "NORMAL";
}

export function setDifficulty(difficulty: GameDifficulty): void {
  setHardModeEnabled(difficulty === "HARD");
}

export function getSoundMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEYS.soundMuted) === "1";
  } catch {
    return false;
  }
}

export function setSoundMuted(muted: boolean): void {
  localStorage.setItem(STORAGE_KEYS.soundMuted, muted ? "1" : "0");
}

export type RecruitmentStyle = "manual" | "draft";

export function getRecruitmentStyle(): RecruitmentStyle {
  if (typeof window === "undefined") return "manual";
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.recruitmentStyle);
    return raw === "draft" ? "draft" : "manual";
  } catch {
    return "manual";
  }
}

export function setRecruitmentStyle(style: RecruitmentStyle): void {
  localStorage.setItem(STORAGE_KEYS.recruitmentStyle, style);
}
