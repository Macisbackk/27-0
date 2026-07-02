export interface GameUpdate {
  id: string;
  title: string;
  summary: string;
}

/** Public changelog — newest first. */
export const GAME_UPDATES: GameUpdate[] = [
  {
    id: "preseason-friendlies-fix",
    title: "Pre-Season Friendly Selection",
    summary:
      "Manager Mode now reliably shows three opponent choices after each pre-season friendly. The picker appears whenever a choice is pending, including when returning from match review or other tabs.",
  },
  {
    id: "manager-and-quick-split",
    title: "Manager Mode & Quick Mode",
    summary:
      "The home screen now leads with Manager Mode — a full career with contracts, transfers, reserves, tactics, live matches, the Challenge Cup, and play-offs. Quick Mode is a faster draft-and-simulate option with Current Mode (2026 squads) or Era Mode (historic team-years).",
  },
  {
    id: "quick-mode-streamline",
    title: "Quick Mode Streamlining",
    summary:
      "Standalone Challenge Cup and Era Challenge Cup quick modes have been removed. Knockout cup football now lives inside Manager Mode careers. Quick Mode focuses on building a XIII and simulating a full Super League season.",
  },
  {
    id: "leaderboards-manager-quick",
    title: "Manager & Quick Leaderboards",
    summary:
      "Leaderboards are split into Manager Mode and Quick Mode tabs — tracking league titles, Challenge Cup wins, perfect seasons, and career earnings separately for each play style.",
  },
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
    id: "playoffs",
    title: "Super League Play-Offs",
    summary:
      "Finish in the top six during a Quick Mode season or Manager Mode league campaign to continue into the play-offs and chase the championship.",
  },
  {
    id: "showcase",
    title: "Player Showcase",
    summary:
      "Browse player cards, ratings, and values across the Super League database.",
  },
];
