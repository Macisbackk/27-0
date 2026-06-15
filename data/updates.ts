export interface UpdateEntry {
  version: string;
  title: string;
  date: string;
  summary: string;
  bullets: string[];
}

/** Public patch history — newest first. Hidden modes excluded. */
export const UPDATES: UpdateEntry[] = [
  {
    version: "2.0",
    title: "Era Challenge Cup Update",
    date: "2026-06-15",
    summary:
      "Lead historic squads through a knockout draw with era-accurate teams, colours, and tournament options.",
    bullets: [
      "Era Challenge Cup — pick a club and season to command a pre-built historic squad",
      "Era team colours on player cards, squad preview, bracket, review, and match details",
      "Tournament type: One Of Each Club or All Era Teams",
      "39 validated era squads sourced from Wikipedia season pages",
      "Strongest-opponent tracking and era team ratings in tournament review",
      "Gold-accent Era mode toggle on the home Challenge Cup card",
    ],
  },
  {
    version: "1.9",
    title: "Fantasy Mode Update",
    date: "2026-05-28",
    summary:
      "Build a squad from scratch with a budget, then simulate a full fantasy season.",
    bullets: [
      "Fantasy Mode — recruit players within a fixed transfer budget",
      "Live league table and fixture-by-fixture season simulation",
      "Man of the Match awards and expanded match reports",
      "Player value filters and budget tracking during recruitment",
      "Improved match bios and post-match detail panels",
    ],
  },
  {
    version: "1.8",
    title: "Player Database Update",
    date: "2026-04-20",
    summary:
      "Richer player profiles with ages, prime years, and a deeper historic database.",
    bullets: [
      "Player ages on cards, squad panels, and match details",
      "Prime years and Dream Team year badges",
      "Wikipedia-sourced birth data for current and historic players",
      "Expanded historic player records and career statistics",
      "Manual rating override layer to preserve curated player values",
      "Player Showcase filters — Current, Historic, Legend, and All",
    ],
  },
  {
    version: "1.7",
    title: "Challenge Cup Update",
    date: "2026-03-10",
    summary:
      "Full knockout tournament mode with club selection, bracket play, and cup review.",
    bullets: [
      "Challenge Cup — draft from one club and battle through a 16-team bracket",
      "Club selection screen with random club draw",
      "Bracket simulation with round-by-round match details",
      "Challenge Cup review with awards, try scorers, and bracket recap",
      "Cup run leaderboard tracking and online submission",
      "Team comparison panel in tournament review",
    ],
  },
  {
    version: "1.6",
    title: "Review & Comparison Update",
    date: "2026-02-05",
    summary:
      "Redesigned end-of-run reviews with richer stats and head-to-head comparisons.",
    bullets: [
      "Season and cup review page redesign with collapsible sections",
      "Extended team comparison — rating, value, club spread, and legend edge",
      "Match details panel with scorers, commentary, and fixture context",
      "Try scorers section and tournament award narratives",
      "Confetti and result grading for cup wins",
    ],
  },
  {
    version: "1.5",
    title: "Statistics & Leaderboards Update",
    date: "2026-01-12",
    summary:
      "Track your runs, compare performances, and browse match history.",
    bullets: [
      "Statistics page with run history and performance breakdowns",
      "Leaderboards for Classic, Draft, and Challenge Cup modes",
      "Normal and Hard difficulty leaderboard tabs",
      "Match history and completed run recording",
      "Guest and signed-in run submission support",
    ],
  },
  {
    version: "1.4",
    title: "Player Showcase Update",
    date: "2025-11-20",
    summary:
      "Browse the full player database with filters, search, and detailed cards.",
    bullets: [
      "Player Showcase — searchable gallery of every player in the game",
      "Filter by type, club, position, rating, and nationality",
      "Full-size player cards with achievements and career stats",
      "Club colour styling and legend/historic/current badges",
      "Pagination for large result sets",
    ],
  },
  {
    version: "1.3",
    title: "Draft Mode Update",
    date: "2025-10-08",
    summary:
      "Snake-draft recruitment with position placement and hard mode support.",
    bullets: [
      "Draft Mode — snake draft against AI opponents",
      "Position placement phase after the draft completes",
      "Hard mode toggle with tougher AI and red-accent styling",
      "Draft board with pick-by-pick tracking",
      "Season simulation and full draft review",
    ],
  },
  {
    version: "1.2",
    title: "Team Colours Update",
    date: "2025-08-22",
    summary:
      "Club identity across cards, badges, pitches, and match UI.",
    bullets: [
      "Club colour bars and dual swatches on player cards",
      "Team-coloured pitch slot markers and squad previews",
      "Club header bars and representation panels",
      "Improved contrast and readable text on all club palettes",
      "Hard mode red accent system mirrored by green normal tokens",
    ],
  },
  {
    version: "1.1",
    title: "Ratings & Historic Players Update",
    date: "2025-06-15",
    summary:
      "Gameplay ratings rebalance and a major historic player expansion.",
    bullets: [
      "75–99 gameplay rating scale with tier bands",
      "Rating-driven fantasy values with position modifiers",
      "Hundreds of historic Super League players added",
      "Legend player tier with gold card styling",
      "Club legend and achievement badges on player cards",
      "Golden Boot and trophy-winner data integration",
    ],
  },
  {
    version: "1.0",
    title: "27-0 Launch",
    date: "2025-03-01",
    summary:
      "The core squad-building experience — draft 13 players and simulate a Super League season.",
    bullets: [
      "Classic Mode — pick players one at a time to fill a 13-man squad",
      "Rugby pitch squad builder with formation placement",
      "Full season simulation with ladder, finals, and awards",
      "Current Super League squads for all clubs",
      "Season review with Player of the Season and try-scoring charts",
      "Responsive matchday UI for mobile and desktop",
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
