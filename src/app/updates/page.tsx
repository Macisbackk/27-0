"use client";

import { useState } from "react";
import { GAME_UPDATES } from "../../../data/updates";
import { playPanelClose, playPanelExpand, playUiClick } from "@/lib/sound";
import { PageShell } from "@/components/ui/PageShell";
import { CARD, PAGE, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

export default function UpdatesPage() {
  const [openId, setOpenId] = useState<string | null>(GAME_UPDATES[0]?.id ?? null);

  return (
    <PageShell withLights compact>
      <div className={`mx-auto max-w-2xl ${PAGE.section}`}>
        <header className="text-center">
          <p className={TYPO.sectionLabel}>Changelog</p>
          <h1 className="mt-2 font-display text-3xl font-black text-white sm:text-4xl">
            Updates
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-gray-500">
            What&apos;s new in 27-0 — latest changes first.
          </p>
        </header>

        <ul className="space-y-3">
          {GAME_UPDATES.map((update) => {
            const isOpen = openId === update.id;
            return (
              <li key={update.id}>
                <button
                  type="button"
                  onClick={() => {
                    playUiClick();
                    if (isOpen) {
                      playPanelClose();
                      setOpenId(null);
                    } else {
                      playPanelExpand();
                      setOpenId(update.id);
                    }
                  }}
                  className={`${CARD.base} ${CARD.panel} w-full rounded-xl border text-left transition ${
                    isOpen
                      ? "border-accent-green/40 bg-pitch-900/80"
                      : "border-pitch-700/50 hover:border-pitch-600/60"
                  } ${SPACING.cardPaddingSm}`}
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-display text-sm font-bold text-white sm:text-base">
                      {update.title}
                    </span>
                    <span
                      className={`shrink-0 text-accent-green transition ${
                        isOpen ? "rotate-180" : ""
                      }`}
                      aria-hidden
                    >
                      ▾
                    </span>
                  </div>
                  {isOpen && (
                    <p className={`mt-3 ${TYPO.bodySm} leading-relaxed text-gray-400`}>
                      {update.summary}
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </PageShell>
  );
}
