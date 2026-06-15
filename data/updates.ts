export interface UpdateEntry {
  version: string;
  date: string;
  summary: string;
  bullets: string[];
}

/** Site changelog — newest first. */
export const UPDATES: UpdateEntry[] = [
  {
    version: "1.8",
    date: "2026-05-28",
    summary: "Fantasy Mode, budget system, and richer match storytelling.",
    bullets: [
      "Fantasy Mode — build a squad from scratch with a fixed budget",
      "Player value filters and budget tracking during recruitment",
      "Improved match bios and post-match detail panels",
      "Player showcase filters and pagination refinements",
    ],
  },
  {
    version: "1.7",
    date: "2026-04-12",
    summary: "Era Challenge Cup and historic team selection.",
    bullets: [
      "Era Challenge Cup — lead a pre-built historic squad through a knockout draw",
      "Browse clubs and seasons to pick your era team",
      "Era-accurate squads with team-year ratings and key players",
      "Tournament type options for unique-club or mixed-era brackets",
    ],
  },
  {
    version: "1.6",
    date: "2026-02-20",
    summary: "Challenge Cup polish and a stronger player database.",
    bullets: [
      "Challenge Cup bracket simulation and full tournament review",
      "Expanded player database with more Super League clubs and legends",
      "Improved team colours across cards, badges, and match UI",
      "Statistics and leaderboard tracking for cup runs",
    ],
  },
];

export function formatUpdateDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
