/**
 * 27-0 sound API — centralised manager with file assets + synth fallback.
 * Assets: public/sounds/ (see README). Missing files fail silently.
 */

import type { GameDifficulty } from "./types";
import {
  initSoundUnlock,
  isSoundMuted,
  playGradeSound as playGradeSoundInternal,
  playSound,
  toggleSoundMuted,
  unlockSound,
} from "./sound/manager";

export {
  initSoundUnlock,
  isSoundMuted,
  toggleSoundMuted,
  unlockSound,
};

/* ── UI ── */

export function playUiClick(): void {
  playSound("click");
}

export function playMenuOpen(): void {
  playSound("menuOpen");
}

export function playMenuClose(): void {
  playSound("menuClose");
}

export function playPanelExpand(): void {
  playSound("expand");
}

export function playHardModeOn(): void {
  playSound("hardOn");
}

export function playHardModeOff(): void {
  playSound("hardOff");
}

/* ── Recruitment ── */

export function playPositionSelect(): void {
  playSound("select");
}

export function playRevealChoices(): void {
  playSound("reveal");
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

/* ── Season simulation ── */

export function playSeasonStart(): void {
  playSound("seasonStart");
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
