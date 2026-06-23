export interface GameUpdate {
  id: string;
  title: string;
  summary: string;
}

/** Public changelog — newest first. */
export const GAME_UPDATES: GameUpdate[] = [
  {
    id: "mode-restructure",
    title: "Current / Era Mode Restructure",
    summary:
      "A cleaner mode setup: Current Mode focuses on the 2026 season with club-only spins, while Era Mode handles historic Super League team-year pools with club + year labels.",
  },
  {
    id: "spin-fairness",
    title: "Spin System Improvements",
    summary:
      "Club selection is balanced and tested so every eligible club has a fair chance. Era Mode reduces how often 2026 squads appear without overweighting multi-year clubs.",
  },
  {
    id: "review-cleanup",
    title: "Review Page Cleanup",
    summary:
      "Season reviews have cleaner sections, Season Highlights inside the summary, consistent buttons, team-coloured match details, and a single Return Home action per page.",
  },
  {
    id: "playoffs-bracket",
    title: "Play-Off Bracket Review",
    summary:
      "Play-Off Review now shows the completed bracket by default with clickable matches opening full match details.",
  },
  {
    id: "challenge-cup-era",
    title: "Era Challenge Cup",
    summary:
      "Pick a historic club season and lead a pre-built era squad through a knockout tournament against random opponents from rugby league history.",
  },
  {
    id: "challenge-cup",
    title: "Challenge Cup",
    summary:
      "Draft your squad and battle through a knockout tournament. Choose Current teams or Era teams from the mode toggle.",
  },
  {
    id: "playoffs",
    title: "Super League Play-Offs",
    summary:
      "Finish in the top six during a Normal Mode season to continue into the play-offs and chase the championship.",
  },
  {
    id: "showcase",
    title: "Player Showcase",
    summary:
      "Browse player cards, ratings, and values across the Super League database.",
  },
  {
    id: "leaderboards",
    title: "Leaderboards",
    summary:
      "Compete on Normal Mode, Challenge Cup, and total Club Funds leaderboards.",
  },
];
