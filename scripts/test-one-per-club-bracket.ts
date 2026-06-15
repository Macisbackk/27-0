/**
 * Test One Of Each Club era bracket generation.
 * Run: npm run test:one-per-club-bracket
 */
import {
  createEraChallengeCupBracket,
  ERA_BRACKET_TEAM_COUNT,
  ERA_OPPONENT_COUNT,
} from "../src/lib/game/challenge-cup-bracket";
import { getAllEraTeams } from "../src/lib/players/era-teams";

const ITERATIONS = 50;
let errors = 0;

const allEraTeams = getAllEraTeams();
const clubsRepresented = new Set(allEraTeams.map((t) => t.clubName));

if (clubsRepresented.size < ERA_BRACKET_TEAM_COUNT) {
  console.error(
    `✗ Only ${clubsRepresented.size} clubs with era teams — need at least ${ERA_BRACKET_TEAM_COUNT}`
  );
  process.exit(1);
}

function getInitiallyPlacedTeams(
  state: ReturnType<typeof createEraChallengeCupBracket>
): string[] {
  const placed = new Set<string>(state.byeTeams);
  for (const match of state.matches) {
    if (match.round === 1) {
      if (match.homeTeam) placed.add(match.homeTeam);
      if (match.awayTeam) placed.add(match.awayTeam);
    }
  }
  return [...placed];
}

for (let i = 0; i < ITERATIONS; i++) {
  const userTeam = allEraTeams[i % allEraTeams.length];
  const seed = `one-per-club-test-${i}`;

  try {
    const state = createEraChallengeCupBracket(
      seed,
      userTeam,
      allEraTeams,
      "onePerClub"
    );

    const placed = getInitiallyPlacedTeams(state);
    const placedClubs = placed.map((t) => state.eraClubLookup?.[t] ?? t);

    if (!placed.includes(userTeam.displayName)) {
      console.error(`[${seed}] User team missing from initial bracket`);
      errors++;
    }

    if (placed.length !== ERA_BRACKET_TEAM_COUNT) {
      console.error(
        `[${seed}] Expected ${ERA_BRACKET_TEAM_COUNT} placed teams, got ${placed.length}`
      );
      errors++;
    }

    if (new Set(placed).size !== ERA_BRACKET_TEAM_COUNT) {
      console.error(`[${seed}] Duplicate display names in initial bracket`);
      errors++;
    }

    if (new Set(placedClubs).size !== ERA_BRACKET_TEAM_COUNT) {
      console.error(`[${seed}] Duplicate clubs in initial bracket`);
      errors++;
    }

    const opponentCount = placed.length - 1;
    if (opponentCount !== ERA_OPPONENT_COUNT) {
      console.error(
        `[${seed}] Expected ${ERA_OPPONENT_COUNT} opponents, got ${opponentCount}`
      );
      errors++;
    }

    for (const match of state.matches) {
      if (match.round !== 1) continue;
      if (!match.homeTeam || !match.awayTeam) {
        console.error(`[${seed}] Blank team in R16 match ${match.id}`);
        errors++;
      }
      if (match.homeTeam === match.awayTeam) {
        console.error(`[${seed}] Self-match in ${match.id}`);
        errors++;
      }
    }
  } catch (err) {
    console.error(`[${seed}] ${err instanceof Error ? err.message : err}`);
    errors++;
  }
}

if (errors > 0) {
  console.error(
    `\n✗ ${errors} one-per-club bracket error(s) across ${ITERATIONS} runs`
  );
  process.exit(1);
}

console.log(
  `✓ All ${ITERATIONS} one-per-club bracket generations passed (${allEraTeams.length} era teams, ${clubsRepresented.size} clubs)`
);
