export interface GameUpdate {
  id: string;
  title: string;
  summary: string;
}

/**
 * Public changelog — chronological from earliest to latest.
 * Major feature milestones only (no tiny bug-fix notes).
 */
export const GAME_UPDATES: GameUpdate[] = [
  {
    id: "launch-27-0",
    title: "27-0 Launched",
    summary:
      "The rugby league draft game arrives — build a XIII from Super League talent and chase a full season.",
  },
  {
    id: "database-expansion",
    title: "Club & Player Database",
    summary:
      "Expanded Super League club and player data so drafts pull from a deeper, more realistic pool.",
  },
  {
    id: "player-pools",
    title: "Current, Historic & Legend Pools",
    summary:
      "Player pools span today’s squads, historic eras, and legendary names for wider recruitment variety.",
  },
  {
    id: "pitch-selection",
    title: "Pitch Position Selection",
    summary:
      "Place signings on a proper rugby league pitch with manual position slots for your starting XIII.",
  },
  {
    id: "two-player-choices",
    title: "Two-Player Draft Choices",
    summary:
      "Each pick offers competing player options, with rerolls when you want another look at the market.",
  },
  {
    id: "rating-system",
    title: "1–99 Rating System",
    summary:
      "Every player carries a clear 1–99 rating so ability, value, and draft priority are easy to read.",
  },
  {
    id: "transfer-values",
    title: "Realistic Transfer Values",
    summary:
      "Player fees and wages follow rugby league market logic instead of arcade pricing.",
  },
  {
    id: "season-simulation",
    title: "Full Season Simulation",
    summary:
      "Simulate a complete Super League campaign with fixtures, results, and season-long progression.",
  },
  {
    id: "match-events",
    title: "Match Events & Scoring",
    summary:
      "Tries, conversions, drop goals, and match commentary bring each result to life.",
  },
  {
    id: "match-results",
    title: "Detailed Match Results",
    summary:
      "Post-match reviews break down scorers, team stats, and the story of the contest.",
  },
  {
    id: "season-review",
    title: "Season Review",
    summary:
      "End each campaign with a full season review covering results, standings, and highlights.",
  },
  {
    id: "player-of-season",
    title: "Player of the Season",
    summary:
      "Standout and struggling performers are recognised at the end of the year.",
  },
  {
    id: "player-showcase",
    title: "Player Showcase",
    summary:
      "Browse the database with filters to explore cards, ratings, clubs, and values.",
  },
  {
    id: "team-representation",
    title: "Team Representation Tracking",
    summary:
      "Track how often each club appears across your drafts and careers.",
  },
  {
    id: "career-statistics",
    title: "Career Statistics",
    summary:
      "Long-term stats track your coaching record across seasons and modes.",
  },
  {
    id: "leaderboards",
    title: "Leaderboards",
    summary:
      "Compete on titles, cups, perfect seasons, and career earnings against other coaches.",
  },
  {
    id: "hard-mode",
    title: "Hard Mode",
    summary:
      "A tougher draft challenge with tighter options and less room for error.",
  },
  {
    id: "challenge-cup",
    title: "Challenge Cup",
    summary:
      "Knockout cup football joins the game with bracket progression and cup nights.",
  },
  {
    id: "goat-joe-mellor",
    title: "GOAT Joe Mellor Mode",
    summary:
      "A special challenge mode celebrating Joe Mellor’s legendary status in the game.",
  },
  {
    id: "club-colours",
    title: "Club Colour Themes",
    summary:
      "Team sheets, cards, and identity surfaces pick up authentic club colours.",
  },
  {
    id: "current-era-identity",
    title: "Current Mode & Era Mode",
    summary:
      "Current Mode focuses on today’s squads; Era Mode unlocks historic team-years with their own visual identity.",
  },
  {
    id: "quick-mode-spin",
    title: "Quick Mode Team Spin",
    summary:
      "Spin for a club (and historic year in Era Mode), then choose your signing from that squad.",
  },
  {
    id: "respin-system",
    title: "Respin System",
    summary:
      "Limited respins let you re-roll a recruitment spin without abandoning the draft.",
  },
  {
    id: "playoffs",
    title: "Play-Off System",
    summary:
      "Finish high enough to enter the Super League play-offs and chase the championship.",
  },
  {
    id: "manager-mode",
    title: "Manager Mode Added",
    summary:
      "Take control of a club across squads, contracts, transfers, fixtures, reserves, and board expectations.",
  },
  {
    id: "manager-hub",
    title: "Manager Hub",
    summary:
      "A central hub for next fixtures, club status, season progress, and week-to-week decisions.",
  },
  {
    id: "manager-inbox",
    title: "Club Inbox",
    summary:
      "Board notes, bids, contracts, medical news, and cup draws land in a persistent Club Mail inbox.",
  },
  {
    id: "squad-tactics",
    title: "Squad & Tactics",
    summary:
      "Set your matchday XIII, interchange, and tactical approach for every fixture.",
  },
  {
    id: "reserves-system",
    title: "Reserves System",
    summary:
      "Develop a reserve pathway, call players up, and manage youth growth alongside the first team.",
  },
  {
    id: "contracts",
    title: "Contracts",
    summary:
      "Negotiate renewals, manage wage pressure, and keep key players signed.",
  },
  {
    id: "transfer-market",
    title: "Transfer Market",
    summary:
      "Buy, sell, and negotiate with rival clubs across a living Super League market.",
  },
  {
    id: "fixtures-calendar",
    title: "Fixtures & Competitions",
    summary:
      "Follow the league calendar, Challenge Cup ties, and special fixtures from one place.",
  },
  {
    id: "club-office",
    title: "Club Office & Season Progress",
    summary:
      "Advance the week from Season Progress, process club systems, and keep the campaign moving.",
  },
  {
    id: "board-demands",
    title: "Board Demands & Objectives",
    summary:
      "The board sets seasonal targets, tracks confidence, and communicates through Club Mail.",
  },
  {
    id: "position-training",
    title: "Position Training",
    summary:
      "Retrain players into new roles, including dual-position pathways over multiple months.",
  },
  {
    id: "world-club-challenge",
    title: "World Club Challenge",
    summary:
      "Face NRL champions in the World Club Challenge when your club earns a place on the world stage.",
  },
  {
    id: "achievements",
    title: "Achievement System",
    summary:
      "Unlock career achievements for titles, cups, streaks, and landmark coaching moments.",
  },
  {
    id: "account-saves",
    title: "Accounts & Save Progression",
    summary:
      "Signed-in progress, cloud-friendly saves, and Club Funds keep careers moving across sessions.",
  },
  {
    id: "mobile-redesign",
    title: "Mobile-Responsive Redesign",
    summary:
      "Manager and Quick Mode layouts are rebuilt to stay readable and usable on phones and tablets.",
  },
  {
    id: "centralised-layouts",
    title: "Shared Manager Layouts",
    summary:
      "Manager tabs and secondary pages share one content width, spacing system, and page shell.",
  },
  {
    id: "scorer-distribution",
    title: "Match Scorer Distribution",
    summary:
      "Try scorers now weigh ability, form, fitness, and position with realistic variety across the squad.",
  },
];
