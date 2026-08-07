export type AchievementCategory =
  | "manager"
  | "normal"
  | "challenge-cup"
  | "profile"
  | "store"
  | "easter-egg";

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
  // Normal Mode
  {
    id: "first-win",
    name: "First Win",
    description: "Win your first Normal Mode game.",
    category: "normal",
    points: 10,
    rewardClubFunds: 25_000,
    target: 1,
  },
  {
    id: "winning-habit",
    name: "Winning Habit",
    description: "Win 10 games in one Normal Mode season.",
    category: "normal",
    points: 25,
    target: 10,
  },
  {
    id: "chaser-27-0",
    name: "27-0 Chaser",
    description: "Win 20 games in one Normal Mode season.",
    category: "normal",
    points: 40,
    target: 20,
  },
  {
    id: "perfect-season",
    name: "Perfect Season",
    description: "Go 27-0 in Normal Mode.",
    category: "normal",
    points: 100,
    rewardClubFunds: 250_000,
  },
  {
    id: "29-0",
    name: "29–0",
    description:
      "Go unbeaten through the league and playoffs — 27–0 regular season and 2–0 in the playoffs.",
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
    description: "Reach the playoffs with a low-rated squad.",
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

  // Challenge Cup
  {
    id: "cup-debut",
    name: "Cup Debut",
    description: "Play your first Challenge Cup run.",
    category: "challenge-cup",
    points: 10,
  },
  {
    id: "cup-finalist",
    name: "Cup Finalist",
    description: "Reach a Challenge Cup final.",
    category: "challenge-cup",
    points: 30,
  },
  {
    id: "cup-winners",
    name: "Cup Winners",
    description: "Win the Challenge Cup.",
    category: "challenge-cup",
    points: 50,
    rewardClubFunds: 150_000,
  },
  {
    id: "era-cup-kings",
    name: "Era Cup Kings",
    description: "Win an Era Challenge Cup.",
    category: "challenge-cup",
    points: 40,
  },
  {
    id: "giant-killer",
    name: "Giant Killer",
    description: "Beat a stronger team in the Challenge Cup.",
    category: "challenge-cup",
    points: 25,
  },
  {
    id: "cup-dynasty",
    name: "Cup Dynasty",
    description: "Win 5 Challenge Cups.",
    category: "challenge-cup",
    points: 80,
    target: 5,
  },

  // Manager Mode
  {
    id: "first-day-job",
    name: "First Day In The Job",
    description: "Start your first Manager Mode career.",
    category: "manager",
    points: 10,
  },
  {
    id: "first-manager-win",
    name: "First Manager Win",
    description: "Win your first Manager Mode match.",
    category: "manager",
    points: 15,
  },
  {
    id: "safe-pair-hands",
    name: "Safe Pair Of Hands",
    description: "Avoid finishing bottom in Manager Mode.",
    category: "manager",
    points: 20,
  },
  {
    id: "playoff-coach",
    name: "Playoff Coach",
    description: "Reach the playoffs in Manager Mode.",
    category: "manager",
    points: 35,
  },
  {
    id: "league-leaders",
    name: "League Leaders",
    description: "Finish top of the league in Manager Mode.",
    category: "manager",
    points: 50,
  },
  {
    id: "grand-final-winners",
    name: "Grand Final Winners",
    description: "Win the Grand Final in Manager Mode.",
    category: "manager",
    points: 75,
    rewardClubFunds: 250_000,
  },
  {
    id: "double-winners",
    name: "Double Winners",
    description:
      "Win the league and Challenge Cup in the same Manager season.",
    category: "manager",
    points: 100,
    rewardClubFunds: 400_000,
  },
  {
    id: "treble-winners",
    name: "Treble Winners",
    description: "Win three major trophies in one Manager season.",
    category: "manager",
    points: 125,
    rewardClubFunds: 500_000,
  },
  {
    id: "quadruple-winners",
    name: "Quadruple Winners",
    description: "Win four major trophies in one Manager season.",
    category: "manager",
    points: 150,
    rewardClubFunds: 750_000,
  },
  {
    id: "clean-sweep",
    name: "Clean Sweep",
    description:
      "Win every available trophy in a Manager season.",
    category: "manager",
    points: 160,
    rewardClubFunds: 800_000,
  },
  {
    id: "world-champions",
    name: "World Champions",
    description: "Win the World Club Challenge in Manager Mode.",
    category: "manager",
    points: 80,
    rewardClubFunds: 300_000,
  },
  {
    id: "perfect-trophy-season",
    name: "Perfect Trophy Season",
    description:
      "Go unbeaten and win every available trophy in a Manager season.",
    category: "manager",
    points: 200,
    rewardClubFunds: 1_000_000,
  },
  {
    id: "academy-trust",
    name: "Academy Trust",
    description: "Call up a reserve player and win the match.",
    category: "manager",
    points: 20,
  },
  {
    id: "youth-breakthrough",
    name: "Youth Breakthrough",
    description: "Give a reserve player a full-time contract.",
    category: "manager",
    points: 25,
  },
  {
    id: "transfer-room",
    name: "Transfer Room",
    description: "Complete your first signing.",
    category: "manager",
    points: 15,
  },
  {
    id: "selling-club",
    name: "Selling Club",
    description: "Sell a player for a transfer fee.",
    category: "manager",
    points: 15,
  },
  {
    id: "contract-secured",
    name: "Contract Secured",
    description: "Renew a player contract.",
    category: "manager",
    points: 10,
  },
  {
    id: "packed-house",
    name: "Packed House",
    description: "Reach 95% stadium capacity for a home game.",
    category: "manager",
    points: 20,
  },
  {
    id: "board-favourite",
    name: "Board Favourite",
    description: "Finish a season with high board confidence.",
    category: "manager",
    points: 30,
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
  {
    id: "reward-claimed",
    name: "Reward Claimed",
    description: "Claim an end-of-season Manager reward.",
    category: "store",
    points: 15,
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
    description: "Complete 10 total seasons/runs.",
    category: "profile",
    points: 25,
    target: 10,
  },
  {
    id: "veteran-coach",
    name: "Veteran Coach",
    description: "Complete 50 total seasons/runs.",
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
  {
    id: "statement-win",
    name: "Statement Win",
    description: "Win a match by 40+ points.",
    category: "profile",
    points: 25,
  },

  // Easter Eggs (hidden until unlocked)
  {
    id: "mellor-miracle",
    name: "Mellor Miracle",
    description: "Complete the Joe Mellor easter egg mode.",
    category: "easter-egg",
    hidden: true,
    points: 50,
    rewardClubFunds: 100_000,
  },
  {
    id: "goat-status",
    name: "GOAT Status",
    description: "Win a season with GOAT Joe Mellor as a key player.",
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
    name: "Against The Odds",
    description: "Complete a secret underdog challenge.",
    category: "easter-egg",
    hidden: true,
    points: 40,
  },
  {
    id: "developers-favourite",
    name: "Developer's Favourite",
    description: "Complete a secret Bradford-related challenge.",
    category: "easter-egg",
    hidden: true,
    points: 35,
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
