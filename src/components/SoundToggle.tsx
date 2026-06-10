"use client";

import { useEffect, useState } from "react";
import { isSoundMuted, toggleSoundMuted } from "@/lib/sound";

const BTN_CLASS =
  "header-control-btn flex h-9 w-9 items-center justify-center rounded-lg border border-pitch-600 text-gray-400 transition hover:border-accent-green/40 hover:text-white sm:w-auto sm:gap-1.5 sm:px-3";

export function SoundToggle() {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMuted(isSoundMuted());
  }, []);

  const handleToggle = () => {
    setMuted(toggleSoundMuted());
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={BTN_CLASS}
      aria-label={muted ? "Sound off — click to enable" : "Sound on — click to mute"}
      title={muted ? "Sound Off" : "Sound On"}
    >
      {muted ? <SoundOffIcon /> : <SoundOnIcon />}
      <span className="hidden font-medium sm:inline">
        {muted ? "Sound Off" : "Sound On"}
      </span>
    </button>
  );
}

function SoundOnIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function SoundOffIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}
