"use client";

import { GameButton } from "@/components/ui/GameButton";
import { StandardPageShell } from "@/components/ui/StandardPageShell";
import { PAGE } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { playUiClick } from "@/lib/sound";

const GAMES = [
  {
    href: "/mini-games/quiz",
    title: "Super League Quiz",
    blurb: "Test your Super League knowledge.",
  },
  {
    href: "/mini-games/wordle",
    title: "Rugby League Wordle",
    blurb: "Guess today's rugby league player.",
  },
  {
    href: "/mini-games/hangman",
    title: "Rugby League Hangman",
    blurb: "Guess the player, club or rugby league term.",
  },
  {
    href: "/mini-games/higher-lower",
    title: "Higher or Lower",
    blurb: "Can you work out which player has the higher rating?",
  },
] as const;

export function MiniGamesHub() {
  return (
    <StandardPageShell>
      <div className={`${PAGE.section} mx-auto w-full max-w-xl`}>
        <p className={`text-center ${TYPO.sectionLabel}`}>Play</p>
        <h1 className={`mt-2 text-center ${TYPO.pageTitle}`}>Mini Games</h1>
        <p className={`mx-auto mt-3 max-w-md text-center ${TYPO.pageSubtitle}`}>
          Quiz · Wordle · Hangman · Higher or Lower
        </p>
        <ul className="mt-8 grid gap-3">
          {GAMES.map((game) => (
            <li key={game.href}>
              <div className="flex items-center gap-3 border border-white/10 bg-[#0c1210] px-4 py-4">
                <div className="min-w-0 flex-1">
                  <p className={TYPO.keyLabel}>{game.title}</p>
                  <p className={`mt-1 ${TYPO.bodySm}`}>{game.blurb}</p>
                </div>
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
