"use client";

import { GameButton } from "@/components/ui/GameButton";
import { StandardPageShell } from "@/components/ui/StandardPageShell";
import { PAGE } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { playUiClick } from "@/lib/sound";

const GAMES = [
  {
    href: "/mini-games/quiz",
    title: "Quiz",
    mark: "QZ",
    blurb: "Millionaire or Team Challenge — pick your format.",
  },
  {
    href: "/mini-games/wordle",
    title: "Rugby League Wordle",
    mark: "WD",
    blurb: "Guess Super League players anytime. Historic or Current goes green when it matches.",
  },
  {
    href: "/mini-games/hangman",
    title: "Rugby League Hangman",
    mark: "HG",
    blurb: "Guess the player, club or rugby league term.",
  },
  {
    href: "/mini-games/higher-lower",
    title: "Higher or Lower",
    mark: "HL",
    blurb: "Five picks. Is the next player's rating higher or lower?",
  },
] as const;

export function MiniGamesHub() {
  return (
    <StandardPageShell>
      <div
        className={`${PAGE.section} mini-game-arena mx-auto flex w-full max-w-xl flex-col items-center text-center`}
      >
        <div className="mini-game-board">
          <span className="mini-game-board__accent" aria-hidden />
          <div className="mini-game-board__body">
            <p className={TYPO.sectionLabel}>Play</p>
            <h1 className={`mt-1.5 ${TYPO.pageTitle}`}>Mini Games</h1>
            <p className={`mx-auto mt-2 max-w-md ${TYPO.pageSubtitle}`}>
              Quick Super League puzzles away from the main season.
            </p>

            <ul className="mt-6 grid w-full gap-3">
              {GAMES.map((game) => (
                <li key={game.href}>
                  <div className="mini-game-hub-card">
                    <span className="mini-game-hub-mark" aria-hidden>
                      {game.mark}
                    </span>
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
        </div>
      </div>
    </StandardPageShell>
  );
}
