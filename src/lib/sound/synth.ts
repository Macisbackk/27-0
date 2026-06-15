/** Web Audio synthesized fallbacks when `/public/sounds/` files are missing. */

let audioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
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

export function playTone(
  frequency: number,
  duration: number,
  options?: {
    type?: OscillatorType;
    volume?: number;
    ramp?: boolean;
    delay?: number;
  }
): void {
  const ctx = getAudioContext();
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

export function playSequence(
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

export const synth = {
  click: () => playTone(440, 0.05, { volume: 0.04 }),
  select: () => playTone(520, 0.07, { volume: 0.06 }),
  reveal: () => {
    playTone(392, 0.06, { volume: 0.05, type: "triangle" });
    setTimeout(() => playTone(494, 0.07, { volume: 0.045, type: "triangle" }), 50);
  },
  reroll: () => playSequence([
    { freq: 330, dur: 0.06, vol: 0.045 },
    { freq: 440, dur: 0.07, vol: 0.05 },
  ]),
  positionComplete: () => {
    playTone(660, 0.09, { volume: 0.07 });
    setTimeout(() => playTone(880, 0.08, { volume: 0.05 }), 60);
  },
  historic: () =>
    playSequence([
      { freq: 330, dur: 0.1, vol: 0.05, type: "triangle" },
      { freq: 415, dur: 0.12, vol: 0.055, type: "triangle" },
    ]),
  legend: () =>
    playSequence([
      { freq: 392, dur: 0.1, vol: 0.06, type: "triangle" },
      { freq: 523, dur: 0.12, vol: 0.065, type: "triangle" },
      { freq: 659, dur: 0.14, vol: 0.05, type: "triangle" },
    ]),
  goat: () =>
    playSequence([
      { freq: 277, dur: 0.1, vol: 0.065, type: "sawtooth" },
      { freq: 415, dur: 0.12, vol: 0.06, type: "sawtooth" },
      { freq: 554, dur: 0.16, vol: 0.055, type: "sawtooth" },
    ]),
  joeMellor: () => {
    playTone(233, 0.14, { type: "sawtooth", volume: 0.08 });
    setTimeout(() => playTone(349, 0.16, { type: "sawtooth", volume: 0.07 }), 110);
    setTimeout(() => playTone(466, 0.18, { type: "sawtooth", volume: 0.06 }), 220);
    setTimeout(() => playTone(622, 0.22, { type: "sawtooth", volume: 0.055 }), 330);
  },
  superSamHallas: () => {
    playTone(392, 0.1, { type: "triangle", volume: 0.07 });
    setTimeout(() => playTone(523, 0.12, { type: "triangle", volume: 0.075 }), 90);
    setTimeout(() => playTone(659, 0.14, { type: "triangle", volume: 0.07 }), 180);
    setTimeout(() => playTone(784, 0.16, { type: "triangle", volume: 0.065 }), 270);
    setTimeout(() => playTone(988, 0.2, { type: "triangle", volume: 0.06 }), 360);
  },
  modeNormal: () => playTone(330, 0.1, { type: "triangle", volume: 0.05 }),
  modeHard: () =>
    playSequence([
      { freq: 220, dur: 0.12, vol: 0.06, type: "triangle" },
      { freq: 185, dur: 0.14, vol: 0.055, type: "triangle" },
    ]),
  modeDraft: () =>
    playSequence([
      { freq: 370, dur: 0.09, vol: 0.05 },
      { freq: 494, dur: 0.1, vol: 0.045 },
    ]),
  modeCup: () =>
    playSequence([
      { freq: 392, dur: 0.1, vol: 0.055, type: "triangle" },
      { freq: 523, dur: 0.12, vol: 0.05, type: "triangle" },
    ]),
  challengeCup: () => {
    playTone(262, 0.08, { type: "triangle", volume: 0.045 });
    setTimeout(() => playTone(330, 0.1, { type: "triangle", volume: 0.05 }), 70);
    setTimeout(() => playTone(392, 0.1, { type: "triangle", volume: 0.055 }), 140);
    setTimeout(() => playTone(523, 0.12, { type: "triangle", volume: 0.06 }), 220);
    setTimeout(() => playTone(659, 0.14, { type: "triangle", volume: 0.055 }), 310);
    setTimeout(() => playTone(784, 0.18, { type: "triangle", volume: 0.05 }), 400);
  },
  hardOn: () =>
    playSequence([
      { freq: 185, dur: 0.14, vol: 0.07, type: "sawtooth" },
      { freq: 147, dur: 0.16, vol: 0.065, type: "sawtooth" },
      { freq: 110, dur: 0.2, vol: 0.06, type: "sawtooth" },
    ], 0.1),
  hardOff: () => playTone(440, 0.06, { volume: 0.04, type: "triangle" }),
  seasonStart: () => {
    playTone(220, 0.12, { type: "triangle", volume: 0.06 });
    setTimeout(() => playTone(330, 0.14, { type: "triangle", volume: 0.05 }), 80);
  },
  win: () =>
    playSequence([
      { freq: 494, dur: 0.09, vol: 0.05 },
      { freq: 587, dur: 0.1, vol: 0.045 },
    ]),
  loss: () =>
    playSequence([
      { freq: 330, dur: 0.14, vol: 0.055, type: "triangle" },
      { freq: 262, dur: 0.16, vol: 0.05, type: "triangle" },
    ]),
  bigWin: () =>
    playSequence([
      { freq: 440, dur: 0.08, vol: 0.055 },
      { freq: 554, dur: 0.1, vol: 0.06 },
      { freq: 659, dur: 0.12, vol: 0.055 },
    ]),
  upset: () =>
    playSequence([
      { freq: 349, dur: 0.08, vol: 0.055 },
      { freq: 440, dur: 0.09, vol: 0.06 },
      { freq: 523, dur: 0.1, vol: 0.055 },
      { freq: 698, dur: 0.12, vol: 0.05 },
    ]),
  perfect: () =>
    playSequence([
      { freq: 523, dur: 0.1, vol: 0.07 },
      { freq: 659, dur: 0.1, vol: 0.07 },
      { freq: 784, dur: 0.12, vol: 0.065 },
      { freq: 1047, dur: 0.2, vol: 0.06 },
    ], 0.08),
  disaster: () =>
    playSequence([
      { freq: 196, dur: 0.18, vol: 0.06, type: "triangle" },
      { freq: 165, dur: 0.22, vol: 0.055, type: "triangle" },
      { freq: 131, dur: 0.26, vol: 0.05, type: "triangle" },
    ], 0.12),
  crowd: () => {
    playTone(392, 0.1, { volume: 0.06 });
    setTimeout(() => playTone(523, 0.12, { volume: 0.06 }), 90);
    setTimeout(() => playTone(659, 0.14, { volume: 0.05 }), 180);
  },
  trophy: () =>
    playSequence([
      { freq: 523, dur: 0.12, vol: 0.07 },
      { freq: 659, dur: 0.12, vol: 0.07 },
      { freq: 784, dur: 0.14, vol: 0.065 },
      { freq: 1047, dur: 0.2, vol: 0.06 },
    ], 0.08),
  cupLoss: () =>
    playSequence([
      { freq: 349, dur: 0.14, vol: 0.055, type: "triangle" },
      { freq: 294, dur: 0.16, vol: 0.05, type: "triangle" },
      { freq: 247, dur: 0.18, vol: 0.045, type: "triangle" },
    ]),
  fail: () =>
    playSequence([
      { freq: 262, dur: 0.16, vol: 0.05, type: "triangle" },
      { freq: 220, dur: 0.2, vol: 0.045, type: "triangle" },
    ], 0.1),
  menuOpen: () => playTone(360, 0.06, { volume: 0.04, type: "triangle" }),
  menuClose: () => playTone(300, 0.06, { volume: 0.035, type: "triangle" }),
  expand: () => playTone(480, 0.05, { volume: 0.04 }),
  panelClose: () => playTone(340, 0.04, { volume: 0.03, type: "triangle" }),
  eraOn: () =>
    playSequence(
      [
        { freq: 440, dur: 0.08, vol: 0.055, type: "triangle" },
        { freq: 554, dur: 0.1, vol: 0.06, type: "triangle" },
        { freq: 659, dur: 0.12, vol: 0.055, type: "triangle" },
      ],
      0.06
    ),
  eraOff: () => playTone(392, 0.06, { volume: 0.045, type: "triangle" }),
  toggle: () => playTone(480, 0.04, { volume: 0.035 }),
  success: () =>
    playSequence(
      [
        { freq: 523, dur: 0.07, vol: 0.05 },
        { freq: 659, dur: 0.08, vol: 0.045 },
      ],
      0.05
    ),
  warning: () =>
    playSequence(
      [
        { freq: 330, dur: 0.1, vol: 0.045, type: "triangle" },
        { freq: 277, dur: 0.12, vol: 0.04, type: "triangle" },
      ],
      0.08
    ),
  autofill: () =>
    playSequence(
      [
        { freq: 392, dur: 0.07, vol: 0.05 },
        { freq: 494, dur: 0.08, vol: 0.05 },
        { freq: 587, dur: 0.09, vol: 0.045 },
      ],
      0.06
    ),
  tabChange: () => playTone(420, 0.04, { volume: 0.035, type: "triangle" }),
  simulateRound: () =>
    playTone(280, 0.09, { volume: 0.045, type: "triangle" }),
  simulateAll: () =>
    playSequence(
      [
        { freq: 280, dur: 0.08, vol: 0.045, type: "triangle" },
        { freq: 350, dur: 0.1, vol: 0.05, type: "triangle" },
      ],
      0.07
    ),
  draftPlace: () => playTone(540, 0.06, { volume: 0.05 }),
  remove: () => playTone(360, 0.05, { volume: 0.04, type: "triangle" }),
  grade: (grade: string) => {
    switch (grade) {
      case "S+":
        playSequence([
          { freq: 523, dur: 0.12, vol: 0.07 },
          { freq: 659, dur: 0.12, vol: 0.07 },
          { freq: 784, dur: 0.14, vol: 0.065 },
          { freq: 1047, dur: 0.2, vol: 0.06 },
        ], 0.08);
        break;
      case "S":
        [523, 659, 784, 1047].forEach((freq, i) => {
          setTimeout(() => playTone(freq, 0.1, { volume: 0.05 }), i * 70);
        });
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
  },
};
