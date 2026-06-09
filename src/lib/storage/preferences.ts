import type { GameDifficulty } from "../types";
import { STORAGE_KEYS } from "./keys";

export function getDifficulty(): GameDifficulty {
  if (typeof window === "undefined") return "NORMAL";
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.difficulty);
    return raw === "HARD" ? "HARD" : "NORMAL";
  } catch {
    return "NORMAL";
  }
}

export function setDifficulty(difficulty: GameDifficulty): void {
  localStorage.setItem(STORAGE_KEYS.difficulty, difficulty);
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
