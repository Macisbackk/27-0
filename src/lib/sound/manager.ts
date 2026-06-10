import { getSoundMuted, setSoundMuted as persistSoundMuted } from "../storage/preferences";
import { getAudioContext, synth } from "./synth";

/** Maps sound keys to files under /public/sounds/ — see public/sounds/README.md */
export const SOUND_FILES = {
  click: "/sounds/click.mp3",
  select: "/sounds/select.mp3",
  reveal: "/sounds/reveal.mp3",
  reroll: "/sounds/reroll.mp3",
  positionComplete: "/sounds/complete.mp3",
  historic: "/sounds/historic.mp3",
  legend: "/sounds/legend.mp3",
  goat: "/sounds/goat.mp3",
  joeMellor: "/sounds/joe-mellor.mp3",
  modeNormal: "/sounds/mode-normal.mp3",
  modeHard: "/sounds/mode-hard.mp3",
  modeDraft: "/sounds/mode-draft.mp3",
  modeCup: "/sounds/mode-cup.mp3",
  seasonStart: "/sounds/season-start.mp3",
  win: "/sounds/win.mp3",
  loss: "/sounds/loss.mp3",
  bigWin: "/sounds/big-win.mp3",
  upset: "/sounds/upset.mp3",
  perfect: "/sounds/perfect.mp3",
  disaster: "/sounds/disaster.mp3",
  crowd: "/sounds/crowd.mp3",
  trophy: "/sounds/trophy.mp3",
  cupLoss: "/sounds/cup-loss.mp3",
  fail: "/sounds/fail.mp3",
  menuOpen: "/sounds/menu-open.mp3",
  menuClose: "/sounds/menu-close.mp3",
  expand: "/sounds/expand.mp3",
} as const;

export type SoundId = keyof typeof SOUND_FILES;

const COOLDOWN_MS: Partial<Record<SoundId, number>> = {
  click: 90,
  select: 140,
  reveal: 200,
  reroll: 250,
  win: 160,
  loss: 160,
  bigWin: 200,
  upset: 220,
  expand: 180,
  menuOpen: 200,
  menuClose: 200,
};

let interactionUnlocked = false;
let unlockListenersAttached = false;
const lastPlayedAt = new Map<SoundId, number>();
const audioCache = new Map<string, HTMLAudioElement>();

export function initSoundUnlock(): void {
  if (typeof window === "undefined" || unlockListenersAttached) return;
  unlockListenersAttached = true;

  const unlock = () => {
    interactionUnlocked = true;
    const ctx = getAudioContext();
    if (ctx?.state === "suspended") void ctx.resume();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };

  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock, { passive: true });
}

export function unlockSound(): void {
  interactionUnlocked = true;
  const ctx = getAudioContext();
  if (ctx?.state === "suspended") void ctx.resume();
}

export function isSoundInteractionUnlocked(): boolean {
  return interactionUnlocked;
}

export function isSoundMuted(): boolean {
  return getSoundMuted();
}

export function toggleSoundMuted(): boolean {
  const next = !getSoundMuted();
  persistSoundMuted(next);
  if (!next) {
    interactionUnlocked = true;
    void playSound("click", { force: true });
  }
  return next;
}

function getCachedAudio(path: string): HTMLAudioElement {
  let audio = audioCache.get(path);
  if (!audio) {
    audio = new Audio(path);
    audio.preload = "auto";
    audioCache.set(path, audio);
  }
  return audio;
}

async function tryPlayFile(path: string, volume = 0.35): Promise<boolean> {
  try {
    const audio = getCachedAudio(path);
    audio.volume = volume;
    audio.currentTime = 0;
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

function playSynth(id: SoundId, grade?: string): void {
  if (id === "fail") {
    synth.fail();
    return;
  }
  const fn = synth[id as keyof typeof synth];
  if (typeof fn === "function") {
    if (id === "grade" as SoundId) return;
    (fn as () => void)();
  } else if (grade) {
    synth.grade(grade);
  }
}

export function playSound(
  id: SoundId,
  options?: { force?: boolean; grade?: string; volume?: number }
): void {
  if (getSoundMuted()) return;
  if (!interactionUnlocked && !options?.force) return;

  const now = Date.now();
  const cooldown = COOLDOWN_MS[id] ?? 120;
  if (!options?.force) {
    const last = lastPlayedAt.get(id) ?? 0;
    if (now - last < cooldown) return;
  }
  lastPlayedAt.set(id, now);

  const path = SOUND_FILES[id];
  void tryPlayFile(path, options?.volume ?? 0.32).then((ok) => {
    if (!ok) playSynth(id, options?.grade);
  });
}

let lastGradeAt = 0;

export function playGradeSound(grade: string): void {
  if (getSoundMuted() || !interactionUnlocked) return;
  const now = Date.now();
  if (now - lastGradeAt < 1200) return;
  lastGradeAt = now;

  const path =
    grade === "F"
      ? SOUND_FILES.fail
      : grade === "S+" || grade === "S"
        ? SOUND_FILES.trophy
        : SOUND_FILES.crowd;

  void tryPlayFile(path, 0.3).then((ok) => {
    if (!ok) synth.grade(grade);
  });
}
