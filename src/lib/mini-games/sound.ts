import { playAchievementUnlock, playSuccess, playUiClick, playWarning } from "@/lib/sound";
import { playSound } from "@/lib/sound/manager";

/**
 * Central Mini Games audio — reuse the app sound manager + mute toggle.
 * Never construct Audio() in components; call these after user gestures.
 */

export function playMiniSelect(): void {
  playUiClick();
}

export function playMiniCorrect(): void {
  playSuccess();
}

export function playMiniIncorrect(): void {
  playWarning();
}

export function playMiniReveal(): void {
  playSound("reveal");
}

export function playMiniWin(): void {
  playSound("perfect");
}

export function playMiniLose(): void {
  playSound("fail");
}

export function playMiniMilestone(): void {
  playAchievementUnlock();
}

export function playMiniClue(): void {
  playSound("boostSelected");
}
