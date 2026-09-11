"use client";

import { playUiClick } from "@/lib/sound";
import { TYPO } from "@/lib/ui/typography";
import {
  MINI_GAME_POOL_MODE_BLURB,
  MINI_GAME_POOL_MODE_LABEL,
  type MiniGamePoolMode,
} from "@/lib/mini-games/pool-mode";

const MODES: MiniGamePoolMode[] = ["current", "era"];

/** Shared picker heading — Current green, Era gold. */
export function MiniGamePoolSelectTitle() {
  return (
    <>
      Choose <span className="text-theme-primary">Current</span> or{" "}
      <span className="text-accent-gold">Era</span>
    </>
  );
}

/**
 * Current vs Era picker — same card style as Quiz Normal / Team Challenge.
 * Title lives on MiniGameShell; this renders the mode cards only.
 */
export function MiniGamePoolSelect({
  onSelect,
}: {
  onSelect: (mode: MiniGamePoolMode) => void;
}) {
  return (
    <div className="mx-auto mt-6 w-full max-w-xl text-center">
      <div className="grid gap-3">
        {MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => {
              playUiClick();
              onSelect(mode);
            }}
            className="w-full border border-white/10 bg-[#0c1210] px-4 py-4 text-center"
          >
            <p
              className={`${TYPO.keyLabel} ${
                mode === "era" ? "text-accent-gold" : "text-theme-primary"
              }`}
            >
              {MINI_GAME_POOL_MODE_LABEL[mode]}
            </p>
            <p className={`mt-1 ${TYPO.bodySm}`}>
              {MINI_GAME_POOL_MODE_BLURB[mode]}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
