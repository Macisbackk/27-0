/**
 * 27-0 sound API — centralised manager with optional file assets + synth fallback.
 * All UI/game audio should go through these helpers (never raw Audio() in components).
 * Assets: public/sounds/ (see README). Missing files use synthesized tones.
 */

import type { GameDifficulty } from "./types";
import {
  initSoundUnlock,
  isSoundMuted,
  isSoundInteractionUnlocked,
  playGradeSound as playGradeSoundInternal,
  playSound,
  toggleSoundMuted,
  unlockSound,
} from "./sound/manager";
import { synth } from "./sound/synth";

export {
  initSoundUnlock,
  isSoundMuted,
  toggleSoundMuted,
  unlockSound,
};

/* ── Navigation ── */

export function playUiClick(): void {
  playSound("click");
}

export function playTabChange(): void {
  playSound("tabChange");
}

export function playMenuOpen(): void {
  playSound("menuOpen");
}

export function playMenuClose(): void {
  playSound("menuClose");
}

/* ── Panels ── */

export function playPanelExpand(): void {
  playSound("expand");
}

export function playPanelClose(): void {
  playSound("panelClose");
}

/* ── Toggles ── */

export function playToggle(): void {
  playSound("toggle");
}

export function playHardModeOn(): void {
  playSound("hardOn");
}

export function playHardModeOff(): void {
  playSound("hardOff");
}

export function playEraModeOn(): void {
  playSound("eraOn");
}

export function playEraModeOff(): void {
  playSound("eraOff");
}

/* ── Feedback ── */

export function playSuccess(): void {
  playSound("success");
}

export function playWarning(): void {
  playSound("warning");
}

/* ── Recruitment / selection ── */

export function playPositionSelect(): void {
  playSound("select");
}

export function playRevealChoices(): void {
  playSound("reveal");
}

let lastSlotSpinTickAt = 0;

export function playSlotSpinStart(): void {
  playSound("slotSpinStart");
}

/** Tick during slot animation — paced to reel step delay when provided. */
export function playSlotSpinTick(progress = 0, stepMs?: number): void {
  if (isSoundMuted() || !isSoundInteractionUnlocked()) return;
  const now = Date.now();
  const minGap = stepMs
    ? Math.max(28, stepMs * 0.55)
    : 48 + progress * 120;
  if (now - lastSlotSpinTickAt < minGap) return;
  lastSlotSpinTickAt = now;
  synth.slotSpinTick(progress);
}

export function playSlotLand(): void {
  playSound("slotLand");
}

export function playPlayerSelect(): void {
  playSound("select");
}

export function playReroll(): void {
  playSound("reroll");
}

export function playPositionComplete(): void {
  playSound("positionComplete");
}

export function playDraftPlacement(): void {
  playSound("draftPlace");
}

export function playRemovePlayer(): void {
  playSound("remove");
}

export function playAutofill(): void {
  playSound("autofill");
}

export function playHistoricPlayerAppears(): void {
  playSound("historic");
}

export function playLegendAppears(): void {
  playSound("legend");
}

export function playGoatAppears(): void {
  playSound("goat");
}

/* ── Game mode start ── */

export function playModeClassicStart(difficulty: GameDifficulty): void {
  playSound(difficulty === "HARD" ? "modeHard" : "modeNormal");
}

export function playModeDraftStart(difficulty: GameDifficulty): void {
  playSound(difficulty === "HARD" ? "modeHard" : "modeDraft");
}

export function playModeChallengeCupStart(): void {
  playSound("challengeCup");
}

export function playJoeMellorActivate(): void {
  playSound("joeMellor");
}

export function playSuperSamHallasActivate(): void {
  playSound("superSamHallas");
}

/* ── Season / round simulation ── */

export function playSeasonStart(): void {
  playSound("seasonStart");
}

export function playSimulateRound(): void {
  playSound("simulateRound");
}

export function playSimulateAll(): void {
  playSound("simulateAll");
}

export function playSeasonComplete(): void {
  playSound("crowd");
}

export function playPerfectSeason(): void {
  playSound("perfect");
}

export function playWinlessSeason(): void {
  playSound("disaster");
}

export function playMatchNarrowWin(): void {
  playSound("win");
}

export function playMatchBigWin(): void {
  playSound("bigWin");
}

export function playMatchDefeat(): void {
  playSound("loss");
}

export function playMatchUpsetVictory(): void {
  playSound("upset");
}

/* ── Challenge Cup ── */

export function playCupFinalWin(): void {
  playSound("trophy");
}

export function playCupFinalLoss(): void {
  playSound("cupLoss");
}

export function playCupMatchWin(): void {
  playSound("win");
}

export function playCupMatchLoss(): void {
  playSound("loss");
}

/* ── Season review grades ── */

export function playGradeCelebration(): void {
  playSound("trophy");
}

export function playGradeSound(grade: string): void {
  playGradeSoundInternal(grade);
}

/* ── Store ── */

export function playStoreOpen(): void {
  playSound("menuOpen");
}

export function playThemePurchaseSuccess(): void {
  playSound("success");
}

export function playThemePurchaseFail(): void {
  playSound("fail");
}

export function playThemeSelect(): void {
  playSound("select");
}
