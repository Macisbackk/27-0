import type { GameDifficulty } from "../types";
import { STORAGE_KEYS } from "./keys";

export type PlayModeKey = "normal" | "draft";

export const MODE_DIFFICULTY_CHANGED_EVENT = "27-0-mode-difficulty-changed";

const MODE_KEY_MAP: Record<PlayModeKey, string> = {
  normal: STORAGE_KEYS.normalDifficulty,
  draft: STORAGE_KEYS.draftDifficulty,
};

function scrubStoredHardDifficulty(): void {
  if (typeof window === "undefined") return;
  try {
    for (const key of [
      STORAGE_KEYS.normalDifficulty,
      STORAGE_KEYS.draftDifficulty,
    ]) {
      const raw = localStorage.getItem(key);
      if (raw === "HARD" || raw === "hard") {
        localStorage.setItem(key, "NORMAL");
      }
    }
  } catch {
    // ignore
  }
}

function migrateLegacyDifficulty(): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(STORAGE_KEYS.normalDifficulty) !== null) return;
    const legacy =
      localStorage.getItem(STORAGE_KEYS.hardModeEnabled) ??
      localStorage.getItem(STORAGE_KEYS.difficulty);
    if (legacy === null) return;
    const hard =
      legacy === "1" ||
      legacy === "true" ||
      legacy === "HARD" ||
      legacy === "hard";
    if (hard) {
      localStorage.setItem(STORAGE_KEYS.normalDifficulty, "NORMAL");
    }
    localStorage.setItem(STORAGE_KEYS.draftDifficulty, "NORMAL");
  } catch {
    // ignore
  }
}

export function getModeDifficulty(_mode: PlayModeKey): GameDifficulty {
  if (typeof window === "undefined") return "NORMAL";
  migrateLegacyDifficulty();
  scrubStoredHardDifficulty();
  return "NORMAL";
}

export function setModeDifficulty(
  mode: PlayModeKey,
  difficulty: GameDifficulty
): void {
  migrateLegacyDifficulty();
  const normalized: GameDifficulty = difficulty === "HARD" ? "NORMAL" : difficulty;
  localStorage.setItem(MODE_KEY_MAP[mode], normalized);
  window.dispatchEvent(
    new CustomEvent(MODE_DIFFICULTY_CHANGED_EVENT, {
      detail: { mode, difficulty: normalized },
    })
  );
}

/** Classic / easter-egg default difficulty preference. */
export function getDifficulty(): GameDifficulty {
  return getModeDifficulty("normal");
}

export function setDifficulty(difficulty: GameDifficulty): void {
  setModeDifficulty("normal", difficulty);
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

export type EraTournamentType = "onePerClub" | "allTeams";

function parseEraTournamentType(raw: string | null): EraTournamentType | null {
  if (raw === "onePerClub" || raw === "allTeams") return raw;
  return null;
}

export function getEraTournamentType(): EraTournamentType {
  if (typeof window === "undefined") return "allTeams";
  try {
    return parseEraTournamentType(
      localStorage.getItem(STORAGE_KEYS.eraTournamentType)
    ) ?? "allTeams";
  } catch {
    return "allTeams";
  }
}

export function setEraTournamentType(type: EraTournamentType): void {
  localStorage.setItem(STORAGE_KEYS.eraTournamentType, type);
}

export const CUP_ERA_VARIANT_CHANGED_EVENT = "27-0-cup-era-variant-changed";

export function getCupEraVariant(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEYS.cupEraVariant) === "1";
  } catch {
    return false;
  }
}

export function setCupEraVariant(eraMode: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.cupEraVariant, eraMode ? "1" : "0");
  window.dispatchEvent(
    new CustomEvent(CUP_ERA_VARIANT_CHANGED_EVENT, {
      detail: { eraMode },
    })
  );
}

export const NORMAL_ERA_VARIANT_CHANGED_EVENT =
  "27-0-normal-era-variant-changed";

export function getNormalEraVariant(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEYS.normalEraVariant) === "1";
  } catch {
    return false;
  }
}

export function setNormalEraVariant(eraMode: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.normalEraVariant, eraMode ? "1" : "0");
  window.dispatchEvent(
    new CustomEvent(NORMAL_ERA_VARIANT_CHANGED_EVENT, {
      detail: { eraMode },
    })
  );
}
