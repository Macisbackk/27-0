import { getSoundMuted, setSoundMuted as persistSoundMuted } from "../storage/preferences";
import { getAudioContext, synth } from "./synth";

/** Maps sound keys to optional files under /public/sounds/ — see public/sounds/README.md */
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
  superSamHallas: "/sounds/super-sam-hallas.mp3",
  modeNormal: "/sounds/mode-normal.mp3",
  modeHard: "/sounds/mode-hard.mp3",
  modeDraft: "/sounds/mode-draft.mp3",
  modeCup: "/sounds/mode-cup.mp3",
  challengeCup: "/sounds/challenge-cup.mp3",
  hardOn: "/sounds/hard-on.mp3",
  hardOff: "/sounds/hard-off.mp3",
  eraOn: "/sounds/era-on.mp3",
  eraOff: "/sounds/era-off.mp3",
  toggle: "/sounds/toggle.mp3",
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
  success: "/sounds/success.mp3",
  warning: "/sounds/warning.mp3",
  autofill: "/sounds/autofill.mp3",
  tabChange: "/sounds/tab-change.mp3",
  simulateRound: "/sounds/simulate-round.mp3",
  simulateAll: "/sounds/simulate-all.mp3",
  draftPlace: "/sounds/draft-place.mp3",
  remove: "/sounds/remove.mp3",
  menuOpen: "/sounds/menu-open.mp3",
  menuClose: "/sounds/menu-close.mp3",
  expand: "/sounds/expand.mp3",
  panelClose: "/sounds/panel-close.mp3",
} as const;

export type SoundId = keyof typeof SOUND_FILES;

const COOLDOWN_MS: Partial<Record<SoundId, number>> = {
  click: 90,
  toggle: 100,
  tabChange: 120,
  select: 140,
  reveal: 200,
  reroll: 250,
  draftPlace: 140,
  remove: 160,
  autofill: 300,
  win: 160,
  loss: 160,
  bigWin: 200,
  upset: 220,
  expand: 180,
  panelClose: 160,
  menuOpen: 200,
  menuClose: 200,
  hardOn: 280,
  hardOff: 160,
  eraOn: 260,
  eraOff: 160,
  challengeCup: 400,
  simulateRound: 220,
  simulateAll: 350,
  success: 200,
  warning: 280,
};

let interactionUnlocked = false;
let unlockListenersAttached = false;
/** After first failed file load, skip file attempts (synth-only fallback). */
let fileAssetsAvailable: boolean | null = null;
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

async function tryPlayFile(path: string, volume = 0.32): Promise<boolean> {
  if (fileAssetsAvailable === false) return false;
  try {
    const audio = getCachedAudio(path);
    audio.volume = volume;
    audio.currentTime = 0;
    await audio.play();
    fileAssetsAvailable = true;
    return true;
  } catch {
    fileAssetsAvailable = false;
    return false;
  }
}

function playSynth(id: SoundId, grade?: string): void {
  if (id === "fail" || id === "warning") {
    synth.warning();
    return;
  }
  const fn = synth[id as keyof typeof synth];
  if (typeof fn === "function") {
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
  void tryPlayFile(path, options?.volume ?? 0.3).then((ok) => {
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
