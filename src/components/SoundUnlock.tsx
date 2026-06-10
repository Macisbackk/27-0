"use client";

import { useEffect } from "react";
import { initSoundUnlock } from "@/lib/sound";

/** Unlocks audio after first user interaction (autoplay policy). */
export function SoundUnlock() {
  useEffect(() => {
    initSoundUnlock();
  }, []);

  return null;
}
