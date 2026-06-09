import { getSoundMuted, setSoundMuted as persistSoundMuted } from "./storage/preferences";

let audioCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (getSoundMuted()) return null;
  if (!audioCtx) {
    const Ctx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") {
    void audioCtx.resume();
  }
  return audioCtx;
}

function playTone(
  frequency: number,
  duration: number,
  options?: { type?: OscillatorType; volume?: number; ramp?: boolean; delay?: number }
): void {
  const ctx = getContext();
  if (!ctx) return;

  const volume = options?.volume ?? 0.08;
  const type = options?.type ?? "sine";
  const delay = options?.delay ?? 0;
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.01);
  if (options?.ramp !== false) {
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  } else {
    gain.gain.setValueAtTime(volume, start + duration - 0.02);
    gain.gain.linearRampToValueAtTime(0, start + duration);
  }

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration);
}

function playSequence(
  notes: { freq: number; dur: number; vol?: number; type?: OscillatorType }[],
  gap = 0.06
): void {
  let offset = 0;
  for (const note of notes) {
    playTone(note.freq, note.dur, {
      volume: note.vol ?? 0.06,
      type: note.type,
      delay: offset,
    });
    offset += note.dur * 0.55 + gap;
  }
}

export function isSoundMuted(): boolean {
  return getSoundMuted();
}

export function toggleSoundMuted(): boolean {
  const next = !getSoundMuted();
  persistSoundMuted(next);
  if (!next) {
    playTone(440, 0.06, { volume: 0.05 });
  }
  return next;
}

/* ── Recruitment ── */

export function playPlayerSelect(): void {
  playTone(520, 0.07, { volume: 0.06 });
}

export function playPositionComplete(): void {
  playTone(660, 0.09, { volume: 0.07 });
  setTimeout(() => playTone(880, 0.08, { volume: 0.05 }), 60);
}

export function playHistoricPlayerAppears(): void {
  playSequence([
    { freq: 330, dur: 0.1, vol: 0.05, type: "triangle" },
    { freq: 415, dur: 0.12, vol: 0.055, type: "triangle" },
  ]);
}

export function playLegendAppears(): void {
  playSequence([
    { freq: 392, dur: 0.1, vol: 0.06, type: "triangle" },
    { freq: 523, dur: 0.12, vol: 0.065, type: "triangle" },
    { freq: 659, dur: 0.14, vol: 0.05, type: "triangle" },
  ]);
}

/* ── Season simulation ── */

export function playSeasonStart(): void {
  playTone(220, 0.12, { type: "triangle", volume: 0.06 });
  setTimeout(() => playTone(330, 0.14, { type: "triangle", volume: 0.05 }), 80);
}

export function playSeasonComplete(): void {
  playTone(392, 0.1, { volume: 0.06 });
  setTimeout(() => playTone(523, 0.12, { volume: 0.06 }), 90);
  setTimeout(() => playTone(659, 0.14, { volume: 0.05 }), 180);
}

export function playMatchBigWin(): void {
  playSequence([
    { freq: 440, dur: 0.08, vol: 0.055 },
    { freq: 554, dur: 0.1, vol: 0.06 },
    { freq: 659, dur: 0.12, vol: 0.055 },
  ]);
}

export function playMatchNarrowWin(): void {
  playSequence([
    { freq: 494, dur: 0.09, vol: 0.05 },
    { freq: 587, dur: 0.1, vol: 0.045 },
  ]);
}

export function playMatchDefeat(): void {
  playSequence([
    { freq: 330, dur: 0.14, vol: 0.055, type: "triangle" },
    { freq: 262, dur: 0.16, vol: 0.05, type: "triangle" },
  ]);
}

export function playMatchUpsetVictory(): void {
  playSequence([
    { freq: 349, dur: 0.08, vol: 0.055 },
    { freq: 440, dur: 0.09, vol: 0.06 },
    { freq: 523, dur: 0.1, vol: 0.055 },
    { freq: 698, dur: 0.12, vol: 0.05 },
  ]);
}

/* ── Season review grades ── */

export function playGradeCelebration(): void {
  [523, 659, 784, 1047].forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.1, { volume: 0.05 }), i * 70);
  });
}

export function playGradeSound(grade: string): void {
  switch (grade) {
    case "S+":
      playSequence([
        { freq: 523, dur: 0.12, vol: 0.07 },
        { freq: 659, dur: 0.12, vol: 0.07 },
        { freq: 784, dur: 0.14, vol: 0.065 },
        { freq: 1047, dur: 0.18, vol: 0.06 },
      ], 0.08);
      break;
    case "S":
      playGradeCelebration();
      break;
    case "A":
      playSequence([
        { freq: 440, dur: 0.1, vol: 0.055 },
        { freq: 554, dur: 0.12, vol: 0.05 },
      ]);
      break;
    case "B":
      playTone(494, 0.1, { volume: 0.045 });
      setTimeout(() => playTone(587, 0.1, { volume: 0.04 }), 70);
      break;
    case "C":
      playTone(440, 0.1, { volume: 0.04, type: "triangle" });
      break;
    case "D":
      playSequence([
        { freq: 370, dur: 0.12, vol: 0.045, type: "triangle" },
        { freq: 311, dur: 0.14, vol: 0.04, type: "triangle" },
      ]);
      break;
    case "E":
      playTone(294, 0.14, { volume: 0.045, type: "triangle" });
      break;
    case "F":
      playSequence([
        { freq: 262, dur: 0.16, vol: 0.05, type: "triangle" },
        { freq: 220, dur: 0.2, vol: 0.045, type: "triangle" },
      ], 0.1);
      break;
    default:
      playTone(440, 0.08, { volume: 0.04 });
  }
}

export function playJoeMellorActivate(): void {
  playTone(311, 0.1, { type: "triangle", volume: 0.07 });
  setTimeout(() => playTone(466, 0.12, { type: "triangle", volume: 0.06 }), 100);
  setTimeout(() => playTone(622, 0.14, { type: "triangle", volume: 0.05 }), 200);
}
