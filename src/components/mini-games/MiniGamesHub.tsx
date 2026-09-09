"use client";

import { GameButton } from "@/components/ui/GameButton";
import { StandardPageShell } from "@/components/ui/StandardPageShell";
import { PAGE } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { playUiClick } from "@/lib/sound";

const GAMES = [
  { href: "/mini-games/quiz", title: "Quiz" },
  { href: "/mini-games/wordle", title: "Rugby League Wordle" },
  { href: "/mini-games/hangman", title: "Rugby League Hangman" },
  { href: "/mini-games/higher-lower", title: "Higher or Lower" },
] as const;

export function MiniGamesHub() {
  return (
    <StandardPageShell>
      <div
        className={`${PAGE.section} mini-game-arena mx-auto flex w-full max-w-xl flex-col items-center text-center`}
      >
        <p className={TYPO.sectionLabel}>Play</p>
        <h1 className={`mt-1.5 ${TYPO.pageTitle}`}>Mini Games</h1>

        <ul className="mt-6 grid w-full gap-2">
          {GAMES.map((game) => (
            <li key={game.href}>
              <div className="mini-game-hub-row">
                <p className={`min-w-0 flex-1 text-center sm:text-left ${TYPO.keyLabel}`}>
                  {game.title}
                </p>
                <GameButton
                  variant="theme"
                  size="sm"
                  href={game.href}
                  fullWidth={false}
                  onClick={() => playUiClick()}
                  className="shrink-0"
                >
                  Play
                </GameButton>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </StandardPageShell>
  );
}
