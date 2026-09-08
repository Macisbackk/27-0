import { createRng, pickIndex } from "@/lib/quiz/rng";
import { SUPER_LEAGUE_CLUBS } from "@/lib/clubs";
import { getWordlePlayerPool } from "../players";
import type { HangmanCategory, HangmanPuzzle } from "./types";

const CURATED: readonly HangmanPuzzle[] = [
  { id: "stad-headingley", category: "stadium", answer: "Headingley", hint: "Leeds Rhinos home" },
  { id: "stad-odsal", category: "stadium", answer: "Odsal", hint: "Bradford Bulls home" },
  { id: "stad-craven-park", category: "stadium", answer: "Craven Park", hint: "Hull KR home" },
  { id: "stad-halliwell-jones", category: "stadium", answer: "Halliwell Jones Stadium", hint: "Warrington home" },
  { id: "stad-mkm", category: "stadium", answer: "MKM Stadium", hint: "Hull FC share this ground" },
  { id: "stad-wembley", category: "stadium", answer: "Wembley", hint: "Challenge Cup final venue" },
  { id: "stad-old-trafford", category: "stadium", answer: "Old Trafford", hint: "Super League Grand Final venue" },
  { id: "stad-brutus", category: "stadium", answer: "Stade Gilbert Brutus", hint: "Catalans Dragons home" },
  { id: "stad-langtree", category: "stadium", answer: "Totally Wicked Stadium", hint: "St Helens home" },
  { id: "stad-dw", category: "stadium", answer: "Brick Community Stadium", hint: "Wigan Warriors home" },
  { id: "stad-jungle", category: "stadium", answer: "The Jungle", hint: "Castleford Tigers nickname for Wheldon Road" },
  { id: "stad-belle-vue", category: "stadium", answer: "Belle Vue", hint: "Wakefield Trinity home" },
  { id: "stad-lsv", category: "stadium", answer: "Leigh Sports Village", hint: "Leigh Leopards home" },
  { id: "stad-knowsley", category: "stadium", answer: "Knowsley Road", hint: "Former St Helens ground" },
  { id: "stad-central-park", category: "stadium", answer: "Central Park", hint: "Former Wigan ground" },
  { id: "coach-wane", category: "coach", answer: "Shaun Wane", hint: "England and former Wigan coach" },
  { id: "coach-peet", category: "coach", answer: "Matt Peet", hint: "Wigan Super League winning coach" },
  { id: "coach-wellens", category: "coach", answer: "Paul Wellens", hint: "St Helens head coach and former fullback" },
  { id: "coach-woolf", category: "coach", answer: "Kristian Woolf", hint: "Coached Saints to a four-peat" },
  { id: "coach-mcnamara", category: "coach", answer: "Steve McNamara", hint: "Catalans and former England coach" },
  { id: "coach-noble", category: "coach", answer: "Brian Noble", hint: "Bradford and Great Britain coach" },
  { id: "coach-mcdermott", category: "coach", answer: "Brian McDermott", hint: "Leeds Rhinos dynasty coach" },
  { id: "coach-powell", category: "coach", answer: "Daryl Powell", hint: "Long-serving Castleford coach" },
  { id: "coach-lam", category: "coach", answer: "Adrian Lam", hint: "Wigan and PNG coach" },
  { id: "coach-bennett", category: "coach", answer: "Wayne Bennett", hint: "Coached England and St Helens" },
  { id: "coach-maguire", category: "coach", answer: "Michael Maguire", hint: "Wigan Grand Final winning coach" },
  { id: "coach-kear", category: "coach", answer: "John Kear", hint: "Wakefield and Challenge Cup specialist" },
  { id: "coach-smith", category: "coach", answer: "Tony Smith", hint: "Leeds, Warrington and Hull KR coach" },
  { id: "coach-radford", category: "coach", answer: "Lee Radford", hint: "Hull FC head coach" },
  { id: "coach-agar", category: "coach", answer: "Richard Agar", hint: "Leeds Rhinos Super League winning coach" },
  { id: "comp-super-league", category: "competition", answer: "Super League", hint: "The top flight in Britain" },
  { id: "comp-challenge-cup", category: "competition", answer: "Challenge Cup", hint: "Knockout competition to Wembley" },
  { id: "comp-wcc", category: "competition", answer: "World Club Challenge", hint: "Super League vs NRL champions" },
  { id: "comp-grand-final", category: "competition", answer: "Grand Final", hint: "October showpiece at Old Trafford" },
  { id: "comp-magic", category: "competition", answer: "Magic Weekend", hint: "Round played at a shared stadium" },
  { id: "comp-championship", category: "competition", answer: "Championship", hint: "Second tier of British rugby league" },
  { id: "comp-world-cup", category: "competition", answer: "Rugby League World Cup", hint: "International tournament" },
  { id: "comp-super-8s", category: "competition", answer: "Super Eights", hint: "Former split-season format" },
  { id: "comp-four-nations", category: "competition", answer: "Four Nations", hint: "Former end-of-year internationals" },
  { id: "comp-ashes", category: "competition", answer: "The Ashes", hint: "England vs Australia series" },
  { id: "term-dummy-half", category: "term", answer: "Dummy half", hint: "The player who picks up from dummy half" },
  { id: "term-play-the-ball", category: "term", answer: "Play the ball", hint: "Restart after a tackle" },
  { id: "term-six-again", category: "term", answer: "Six again", hint: "Set restart for a ruck infringement" },
  { id: "term-golden-point", category: "term", answer: "Golden point", hint: "Extra time sudden death" },
  { id: "term-lance-todd", category: "term", answer: "Lance Todd Trophy", hint: "Challenge Cup final man of the match" },
  { id: "term-man-of-steel", category: "term", answer: "Man of Steel", hint: "Super League player of the year" },
  { id: "term-forty-twenty", category: "term", answer: "Forty Twenty", hint: "Kicking for a tap restart" },
  { id: "term-drop-goal", category: "term", answer: "Drop goal", hint: "One-point kick in open play" },
  { id: "term-sin-bin", category: "term", answer: "Sin bin", hint: "Ten minutes off for foul play" },
  { id: "term-interchange", category: "term", answer: "Interchange", hint: "Bench substitution" },
  { id: "term-knock-on", category: "term", answer: "Knock on", hint: "Forward lost possession" },
  { id: "term-salary-cap", category: "term", answer: "Salary cap", hint: "Spending limit on a squad" },
  { id: "term-dream-team", category: "term", answer: "Dream Team", hint: "End-of-season XIII" },
  { id: "term-harry-sunderland", category: "term", answer: "Harry Sunderland Trophy", hint: "Grand Final man of the match" },
  { id: "term-marker", category: "term", answer: "Marker", hint: "Defender at dummy half" },
];

function isHangmanFriendly(text: string): boolean {
  const letters = text.replace(/[^A-Za-z]/g, "");
  return letters.length >= 4 && letters.length <= 24;
}

function clubPuzzles(): HangmanPuzzle[] {
  return SUPER_LEAGUE_CLUBS.filter((club) => isHangmanFriendly(club.name)).map(
    (club) => ({
      id: `club-${club.id}`,
      category: "club" as const,
      answer: club.name,
      hint: "A Super League club",
    })
  );
}

function playerPuzzles(): HangmanPuzzle[] {
  const seen = new Set<string>();
  const puzzles: HangmanPuzzle[] = [];
  for (const player of getWordlePlayerPool()) {
    if (!isHangmanFriendly(player.displayName)) continue;
    const key = player.displayName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    puzzles.push({
      id: `player-${player.identityId}`,
      category: "player",
      answer: player.displayName,
      hint: `${player.positionLabel} · ${player.club}`,
    });
  }
  return puzzles;
}

let bankCache: HangmanPuzzle[] | null = null;

export function getHangmanBank(): HangmanPuzzle[] {
  if (bankCache) return bankCache;
  bankCache = [...CURATED, ...clubPuzzles(), ...playerPuzzles()];
  return bankCache;
}

export function pickHangmanPuzzle(
  seed: string,
  bank: readonly HangmanPuzzle[] = getHangmanBank(),
  excludeId?: string
): HangmanPuzzle {
  const eligible = excludeId
    ? bank.filter((puzzle) => puzzle.id !== excludeId)
    : [...bank];
  const pool = eligible.length > 0 ? eligible : [...bank];
  if (pool.length === 0) {
    throw new Error("Hangman bank is empty");
  }
  const rng = createRng(seed);
  return pool[pickIndex(rng, pool.length)]!;
}

export const HANGMAN_CATEGORY_LABEL: Record<HangmanCategory, string> = {
  player: "Player",
  club: "Club",
  stadium: "Stadium",
  coach: "Coach",
  competition: "Competition",
  term: "Rugby league term",
};
