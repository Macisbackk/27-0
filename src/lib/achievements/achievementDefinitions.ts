export type AchievementCategory =
  | "normal"
  | "challenge-cup"
  | "profile"
  | "store"
  | "easter-egg"
  | "quiz"
  | "manager";

export type AchievementDefinition = {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  hidden?: boolean;
  points?: number;
  rewardClubFunds?: number;
  target?: number;
};

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  // Classic
  {
    id: "first-win",
    name: "First Win",
    description: "Win your first Classic game.",
    category: "normal",
    points: 10,
    rewardClubFunds: 25_000,
    target: 1,
  },
  {
    id: "winning-habit",
    name: "Winning Habit",
    description: "Win 10 games in one Classic season.",
    category: "normal",
    points: 25,
    target: 10,
  },
  {
    id: "chaser-27-0",
    name: "27-0 Chaser",
    description: "Win 20 games in one Classic season.",
    category: "normal",
    points: 40,
    target: 20,
  },
  {
    id: "perfect-season",
    name: "Perfect Season",
    description: "Go 27-0 in Classic.",
    category: "normal",
    points: 100,
    rewardClubFunds: 250_000,
  },
  {
    id: "29-0",
    name: "29-0",
    description:
      "Go unbeaten through the league and play-offs: 27-0 in the regular season and 2-0 in the play-offs.",
    category: "normal",
    points: 150,
    rewardClubFunds: 500_000,
  },
  {
    id: "unbeaten-again",
    name: "Unbeaten Again",
    description: "Complete 3 unbeaten seasons.",
    category: "normal",
    points: 60,
    target: 3,
  },
  {
    id: "elite-builder",
    name: "Elite Builder",
    description: "Build an S-grade team.",
    category: "normal",
    points: 35,
  },
  {
    id: "underdog-run",
    name: "Underdog Run",
    description: "Reach the play-offs with a low-rated squad.",
    category: "normal",
    points: 45,
  },
  {
    id: "bradford-bias",
    name: "Bradford Bias",
    description:
      "Build a team with 5+ Bradford players and finish with a winning record.",
    category: "normal",
    points: 30,
  },
  {
    id: "era-cup-kings",
    name: "Era Champions",
    description: "Win the Super League title in Era Classic.",
    category: "normal",
    points: 40,
  },

  // Legacy Challenge Cup mode — hidden; cannot unlock (mode removed).
  {
    id: "cup-debut",
    name: "Cup Debut",
    description: "Play your first Challenge Cup run.",
    category: "challenge-cup",
    points: 10,
    hidden: true,
  },
  {
    id: "cup-finalist",
    name: "Cup Finalist",
    description: "Reach a Challenge Cup final.",
    category: "challenge-cup",
    points: 30,
    hidden: true,
  },
  {
    id: "cup-winners",
    name: "Cup Winners",
    description: "Win the Challenge Cup.",
    category: "challenge-cup",
    points: 50,
    rewardClubFunds: 150_000,
    hidden: true,
  },
  {
    id: "giant-killer",
    name: "Giant Killer",
    description: "Beat a stronger team in the Challenge Cup.",
    category: "challenge-cup",
    points: 25,
    hidden: true,
  },
  {
    id: "cup-dynasty",
    name: "Cup Dynasty",
    description: "Win 5 Challenge Cups.",
    category: "challenge-cup",
    points: 80,
    target: 5,
    hidden: true,
  },

  // Store / Club Funds
  {
    id: "first-purchase",
    name: "First Purchase",
    description: "Buy your first Store theme.",
    category: "store",
    points: 10,
  },
  {
    id: "theme-collector",
    name: "Theme Collector",
    description: "Unlock 5 Store themes.",
    category: "store",
    points: 30,
    target: 5,
  },
  {
    id: "full-collection",
    name: "Full Collection",
    description: "Unlock every Store theme.",
    category: "store",
    points: 75,
    rewardClubFunds: 500_000,
  },
  {
    id: "millionaire-coach",
    name: "Millionaire Coach",
    description: "Hold £1m Club Funds.",
    category: "store",
    points: 40,
  },
  {
    id: "big-earner",
    name: "Big Earner",
    description: "Earn £5m lifetime Club Funds.",
    category: "store",
    points: 50,
    target: 5_000_000,
  },
  // Profile / General
  {
    id: "getting-started",
    name: "Getting Started",
    description: "Create or open your Coach Profile.",
    category: "profile",
    points: 5,
  },
  {
    id: "regular-coach",
    name: "Regular Coach",
    description: "Complete 10 seasons.",
    category: "profile",
    points: 25,
    target: 10,
  },
  {
    id: "veteran-coach",
    name: "Veteran Coach",
    description: "Complete 50 seasons.",
    category: "profile",
    points: 75,
    target: 50,
  },
  {
    id: "stat-machine",
    name: "Stat Machine",
    description: "Record 100 total wins.",
    category: "profile",
    points: 40,
    target: 100,
  },
  {
    id: "tough-lessons",
    name: "Tough Lessons",
    description: "Record 50 total losses.",
    category: "profile",
    points: 20,
    target: 50,
  },
  {
    id: "close-one",
    name: "Close One",
    description: "Win a match by 1 point.",
    category: "profile",
    points: 15,
  },

  // Easter Eggs (hidden until unlocked)
  {
    id: "mellor-miracle",
    name: "Mellor Miracle",
    description: "Win a Joe Mellor GOAT season.",
    category: "easter-egg",
    hidden: true,
    points: 50,
    rewardClubFunds: 100_000,
  },
  {
    id: "goat-status",
    name: "GOAT Status",
    description: "Play Joe Mellor GOAT Mode.",
    category: "easter-egg",
    hidden: true,
    points: 60,
  },
  {
    id: "secret-button",
    name: "Secret Button",
    description: "Find and trigger a hidden button.",
    category: "easter-egg",
    hidden: true,
    points: 25,
  },
  {
    id: "against-the-odds",
    name: "Super Sam",
    description: "Play Super Sam Hallas Mode.",
    category: "easter-egg",
    hidden: true,
    points: 40,
  },
  {
    id: "developers-favourite",
    name: "Developer's Favourite",
    description:
      "Win Joe Mellor GOAT with 5+ Bradford players.",
    category: "easter-egg",
    hidden: true,
    points: 35,
  },

  // Daily Challenge
  {
    id: "daily-debut",
    name: "Daily Debut",
    description: "Complete a full Daily Challenge.",
    category: "normal",
    points: 15,
    rewardClubFunds: 25_000,
  },
  {
    id: "daily-streak-3",
    name: "Three in a Row",
    description: "Complete the Daily Challenge three days in a row.",
    category: "normal",
    points: 30,
    target: 3,
  },
  {
    id: "daily-streak-7",
    name: "Week of Wins",
    description: "Complete the Daily Challenge seven days in a row.",
    category: "normal",
    points: 60,
    target: 7,
  },

  {
    id: "quiz-first-question",
    name: "First Question",
    description: "Answer your first Super League Millionaire question.",
    category: "quiz",
    points: 10,
    rewardClubFunds: 5_000,
    target: 1,
  },
  {
    id: "quiz-safe-1000",
    name: "Safe Haven",
    description: "Reach the £1,000 safe haven in Super League Millionaire.",
    category: "quiz",
    points: 20,
    rewardClubFunds: 10_000,
  },
  {
    id: "quiz-safe-32000",
    name: "Halfway There",
    description: "Reach the £32,000 safe haven in Super League Millionaire.",
    category: "quiz",
    points: 35,
    rewardClubFunds: 25_000,
  },
  {
    id: "quiz-big-money",
    name: "Big Money",
    description: "Reach £250,000 in a Super League Millionaire run.",
    category: "quiz",
    points: 50,
    rewardClubFunds: 40_000,
  },
  {
    id: "quiz-millionaire",
    name: "Millionaire",
    description:
      "Answer all 15 Super League Millionaire questions correctly and bank £1,000,000.",
    category: "quiz",
    points: 100,
    rewardClubFunds: 100_000,
  },
  {
    id: "quiz-no-help",
    name: "No Help Needed",
    description: "Answer all 15 quiz questions correctly without using a lifeline.",
    category: "quiz",
    points: 40,
  },
  {
    id: "quiz-club-expert",
    name: "Club Expert",
    description: "Complete a Team Challenge quiz.",
    // Retired game — kept so existing unlocks still show; hidden while locked.
    hidden: true,
    category: "quiz",
    points: 25,
    rewardClubFunds: 15_000,
  },
  {
    id: "quiz-club-millionaire",
    name: "Club Millionaire",
    description: "Reach £1,000,000 in Team Challenge.",
    // Retired game — kept so existing unlocks still show; hidden while locked.
    hidden: true,
    category: "quiz",
    points: 80,
    rewardClubFunds: 75_000,
  },
  {
    id: "quiz-super-league-expert",
    name: "Super League Expert",
    description: "Answer 250 Super League Millionaire questions correctly.",
    category: "quiz",
    points: 60,
    target: 250,
  },
  {
    id: "mini-game-starter",
    name: "Puzzle Starter",
    description: "Play a puzzle.",
    category: "quiz",
    points: 10,
    rewardClubFunds: 5_000,
    target: 1,
  },
  {
    id: "wordle-win",
    name: "Wordle Win",
    description: "Win a game of Rugby League Wordle.",
    category: "quiz",
    points: 25,
    rewardClubFunds: 10_000,
    target: 1,
  },
  {
    id: "hangman-win",
    name: "Hangman Win",
    description: "Solve a Rugby League Hangman puzzle.",
    // Retired game — kept so existing unlocks still show; hidden while locked.
    hidden: true,
    category: "quiz",
    points: 25,
    rewardClubFunds: 10_000,
    target: 1,
  },
  {
    id: "higher-lower-streak-10",
    name: "Five from Five",
    description: "Complete a Higher or Lower five-pick run.",
    // Retired game — kept so existing unlocks still show; hidden while locked.
    hidden: true,
    category: "quiz",
    points: 40,
    rewardClubFunds: 15_000,
    target: 1,
  },

  // Manager Mode
  {
    id: "manager-gaffer",
    name: "Gaffer",
    description: "Finish your first Manager Mode season.",
    category: "manager",
    points: 15,
    rewardClubFunds: 25_000,
    target: 1,
  },
  {
    id: "manager-silverware",
    name: "Silverware",
    description: "Win your first trophy of any kind in Manager Mode.",
    category: "manager",
    points: 30,
    rewardClubFunds: 50_000,
  },
  {
    id: "manager-going-up",
    name: "Going Up",
    description: "Win promotion to the Super League.",
    category: "manager",
    points: 40,
    rewardClubFunds: 75_000,
  },
  {
    id: "manager-old-trafford",
    name: "Old Trafford",
    description: "Win the Super League Grand Final.",
    category: "manager",
    points: 75,
    rewardClubFunds: 150_000,
  },
  {
    id: "manager-cup-run",
    name: "Cup Run",
    description: "Win the Challenge Cup in Manager Mode.",
    category: "manager",
    points: 50,
    rewardClubFunds: 100_000,
  },
  {
    id: "manager-invincibles",
    name: "Invincibles",
    description: "Win every league game in a Manager Mode season.",
    category: "manager",
    points: 100,
    rewardClubFunds: 250_000,
  },
  {
    id: "manager-deadline-dealer",
    name: "Deadline Dealer",
    description: "Sign or sell a player on Deadline Day.",
    category: "manager",
    points: 20,
    rewardClubFunds: 10_000,
  },
  {
    id: "manager-legacy",
    name: "Legacy",
    description: "Start 3 Manager Mode careers.",
    category: "manager",
    points: 35,
    target: 3,
  },
];

export const ACHIEVEMENT_BY_ID = new Map(
  ACHIEVEMENT_DEFINITIONS.map((a) => [a.id, a])
);

export function getAchievementDefinition(
  id: string
): AchievementDefinition | undefined {
  return ACHIEVEMENT_BY_ID.get(id);
}

export const HIDDEN_ACHIEVEMENT_LABEL = "Hidden Achievement";
export const HIDDEN_ACHIEVEMENT_DESCRIPTION =
  "Complete a secret challenge to reveal this achievement.";
