import seedrandom from "seedrandom";
import type { MatchFixture } from "../game/season-simulation";
import type { ManOfTheMatch } from "../game/fantasy-match-summary";
import type { Position } from "../types";
import type {
  CupRoundKey,
  ManagerCareer,
  ManagerCompetition,
  MatchAttendanceMeta,
} from "./types";
import { getManagerCompetitionLabel } from "./managerFixtureDisplay";
import { GRAND_FINAL_VENUE } from "./managerPlayoffs";
import { MAGIC_WEEKEND_VENUE } from "./managerMagicWeekend";
import { CHALLENGE_CUP_FINAL_VENUE } from "./managerChallengeCup";
import { getManagerPlayer } from "./managerPlayers";

const FORWARD_POSITIONS = new Set<Position>([
  "PROP",
  "HOOKER",
  "SECOND_ROW",
  "LOOSE_FORWARD",
]);

export interface ManagerMatchBioContext {
  clubName: string;
  competition?: ManagerCompetition;
  cupRound?: CupRoundKey;
  tacticImpactLine?: string;
  tacticEffectivenessLine?: string;
  attendance?: MatchAttendanceMeta;
  playedLive?: boolean;
  injuryCount?: number;
  forwardTries?: number;
  backTries?: number;
}

function pickVariant(lines: string[], seed: string, key: string): string {
  const rng = seedrandom(`${seed}-mgr-bio-${key}`);
  return lines[Math.floor(rng() * lines.length)];
}

function isCloseMargin(margin: number): boolean {
  return margin <= 6;
}

function isHeavyMargin(margin: number, isThrashing?: boolean): boolean {
  return isThrashing === true || margin >= 20;
}

function formatVenue(fixture: MatchFixture, venue?: string): string {
  if (venue) return `at ${venue}`;
  if (fixture.isNeutral) return `at ${GRAND_FINAL_VENUE}`;
  return fixture.isHome ? "at home" : "away";
}

function formatTryCount(n: number): string {
  return `${n} ${n === 1 ? "try" : "tries"}`;
}

function formatTopScorerLine(
  scorers: { name: string; tries: number }[],
  possessive: boolean
): string | null {
  const sorted = [...scorers].filter((s) => s.tries > 0).sort((a, b) => b.tries - a.tries);
  if (sorted.length === 0) return null;

  const top = sorted[0]!;
  const owner = possessive ? `${top.name}'s` : top.name;

  if (top.tries >= 3) {
    return `${owner} hat-trick led the way.`;
  }
  if (top.tries === 2) {
    if (sorted.length > 1 && sorted[1]!.tries > 0) {
      return `${top.name} scored twice, with ${sorted[1]!.name} also crossing.`;
    }
    return `${top.name}'s brace led the scoring.`;
  }
  if (sorted.length >= 2) {
    const names = sorted
      .slice(0, 2)
      .map((s) => s.name)
      .join(" and ");
    return `${names} shared the tries across the afternoon.`;
  }
  return `${top.name} led the scoring with a well-worked try.`;
}

/** MOTM blurb focused on on-field play — not goal-kicking. */
export function buildManagerMotmPerformanceSummary(
  playerId: string,
  _playerName: string,
  fixture: MatchFixture,
  slotPositions: Position[],
  xiiiIds: string[],
  teamName?: string
): string {
  const isOpponent = teamName != null && teamName === fixture.opponent;
  const tryScorers = isOpponent
    ? fixture.scoringDetail?.opponent.tryScorers ?? []
    : fixture.scoringDetail?.dreamTeam.tryScorers ?? [];
  const tries = tryScorers.find((s) => s.playerId === playerId)?.tries ?? 0;

  if (tries >= 3) return isOpponent ? "hat-trick decided it" : "hat-trick hero";
  if (tries === 2) {
    return isOpponent ? "brace turned the game" : "brace led the attack";
  }

  const idx = isOpponent ? -1 : xiiiIds.indexOf(playerId);
  const pos = idx >= 0 ? slotPositions[idx] : undefined;

  if (tries === 1) {
    if (isOpponent) return "crossed at a crucial moment";
    if (pos && FORWARD_POSITIONS.has(pos)) return "led from the front in the pack";
    if (pos === "SCRUM_HALF" || pos === "STAND_OFF") {
      return "pulled the strings at half-back";
    }
    if (pos === "FULLBACK" || pos === "WING" || pos === "CENTRE") {
      return "finished strongly out wide";
    }
    return "crossed for a crucial try";
  }

  if (isOpponent) {
    return fixture.result === "L"
      ? "standout display in defeat"
      : "kept the side competitive throughout";
  }

  if (pos && FORWARD_POSITIONS.has(pos)) return "dominated the middle";
  if (pos === "SCRUM_HALF" || pos === "STAND_OFF") {
    return "controlled the tempo from half-back";
  }
  return "standout all-round display";
}

interface ManagerMotmCandidate {
  playerId: string;
  playerName: string;
  teamName: string;
  rating: number;
  tries: number;
  conversions: number;
  penalties: number;
  dropGoals: number;
  won: boolean;
}

function scoreManagerMotmCandidate(
  candidate: ManagerMotmCandidate,
  margin: number
): number {
  const close = isCloseMargin(margin);
  let score = 0;
  score += candidate.tries * 8;
  score += candidate.conversions * 2;
  score += candidate.penalties * 3;
  score += candidate.dropGoals * 4;
  if (candidate.won) score += 5;
  if (
    close &&
    (candidate.tries > 0 ||
      candidate.conversions > 0 ||
      candidate.penalties > 0 ||
      candidate.dropGoals > 0)
  ) {
    score += 3;
  }
  score += candidate.rating / 10;
  return score;
}

function isNamedOpponentScorer(
  fixture: MatchFixture,
  playerId: string
): boolean {
  return playerId !== fixture.opponent;
}

function addManagerMotmTryScorers(
  candidates: ManagerMotmCandidate[],
  scorers: { playerId: string; name: string; tries: number }[],
  teamName: string,
  fixture: MatchFixture,
  career: ManagerCareer,
  won: boolean,
  userMatchdayIds?: Set<string>
): void {
  for (const scorer of scorers) {
    if (scorer.tries <= 0) continue;
    if (teamName === fixture.opponent && !isNamedOpponentScorer(fixture, scorer.playerId)) {
      continue;
    }
    if (userMatchdayIds && !userMatchdayIds.has(scorer.playerId)) continue;

    const player = getManagerPlayer(career, scorer.playerId);
    candidates.push({
      playerId: scorer.playerId,
      playerName: scorer.name,
      teamName,
      rating: player?.peakRating ?? 80,
      tries: scorer.tries,
      conversions: 0,
      penalties: 0,
      dropGoals: 0,
      won,
    });
  }
}

function addManagerMotmKicker(
  candidates: ManagerMotmCandidate[],
  kicking:
    | {
        playerId: string;
        name: string;
        conversions: number;
        penalties: number;
        dropGoals: number;
      }
    | null
    | undefined,
  teamName: string,
  fixture: MatchFixture,
  career: ManagerCareer,
  won: boolean,
  userMatchdayIds?: Set<string>
): void {
  if (!kicking) return;
  if (teamName === fixture.opponent && !isNamedOpponentScorer(fixture, kicking.playerId)) {
    return;
  }
  if (userMatchdayIds && !userMatchdayIds.has(kicking.playerId)) return;

  const goals = kicking.conversions + kicking.penalties + kicking.dropGoals;
  if (goals <= 0) return;

  const existing = candidates.find((c) => c.playerId === kicking.playerId);
  if (existing) {
    existing.conversions += kicking.conversions;
    existing.penalties += kicking.penalties;
    existing.dropGoals += kicking.dropGoals;
    return;
  }

  const player = getManagerPlayer(career, kicking.playerId);
  candidates.push({
    playerId: kicking.playerId,
    playerName: kicking.name,
    teamName,
    rating: player?.peakRating ?? 80,
    tries: 0,
    conversions: kicking.conversions,
    penalties: kicking.penalties,
    dropGoals: kicking.dropGoals,
    won,
  });
}

/** Pick MOTM from both squads using tries, goals, result, and rating. */
export function selectManagerManOfTheMatch(
  fixture: MatchFixture,
  career: ManagerCareer,
  userMatchdayIds: string[],
  seed: string,
  fixtureKey: string
): ManOfTheMatch | undefined {
  const userIds = new Set(userMatchdayIds.filter(Boolean));
  const candidates: ManagerMotmCandidate[] = [];
  const userWon = fixture.result === "W";
  const oppWon = fixture.result === "L";

  addManagerMotmTryScorers(
    candidates,
    fixture.scoringDetail?.dreamTeam.tryScorers ?? [],
    career.club,
    fixture,
    career,
    userWon,
    userIds
  );
  addManagerMotmKicker(
    candidates,
    fixture.scoringDetail?.dreamTeam.kicking,
    career.club,
    fixture,
    career,
    userWon,
    userIds
  );
  addManagerMotmTryScorers(
    candidates,
    fixture.scoringDetail?.opponent.tryScorers ?? [],
    fixture.opponent,
    fixture,
    career,
    oppWon
  );
  addManagerMotmKicker(
    candidates,
    fixture.scoringDetail?.opponent.kicking,
    fixture.opponent,
    fixture,
    career,
    oppWon
  );

  if (candidates.length === 0) {
    const fallbackUser = userMatchdayIds.find(Boolean);
    if (fallbackUser) {
      const player = getManagerPlayer(career, fallbackUser);
      if (player) {
        return {
          playerId: fallbackUser,
          playerName: player.name,
          teamName: career.club,
          performanceSummary: buildManagerMotmPerformanceSummary(
            fallbackUser,
            player.name,
            fixture,
            career.xiiiSlotPositions,
            career.matchdayXiii,
            career.club
          ),
        };
      }
    }
    return undefined;
  }

  const margin = Math.abs(fixture.pointsFor - fixture.pointsAgainst);
  const scored = candidates.map((candidate) => ({
    candidate,
    score: scoreManagerMotmCandidate(candidate, margin),
  }));
  scored.sort((a, b) => b.score - a.score);
  const topScore = scored[0]!.score;
  const tied = scored.filter((entry) => entry.score === topScore);
  const rng = seedrandom(`${seed}-mgr-motm-${fixtureKey}`);
  const picked = tied[Math.floor(rng() * tied.length)]!.candidate;

  const isUser = picked.teamName === career.club;
  return {
    playerId: picked.playerId,
    playerName: picked.playerName,
    teamName: picked.teamName,
    performanceSummary: buildManagerMotmPerformanceSummary(
      picked.playerId,
      picked.playerName,
      fixture,
      career.xiiiSlotPositions,
      career.matchdayXiii,
      isUser ? career.club : fixture.opponent
    ),
    tries: picked.tries > 0 ? picked.tries : undefined,
  };
}

/** Only when tries are level and the boot decided the result. */
function formatKickingDecider(fixture: MatchFixture): string | null {
  const tryMargin = fixture.triesFor - fixture.triesAgainst;
  const pointsMargin = fixture.pointsFor - fixture.pointsAgainst;
  if (tryMargin !== 0 || pointsMargin === 0) return null;

  const forKicking = fixture.scoringDetail?.dreamTeam.kicking;
  const againstKicking = fixture.scoringDetail?.opponent.kicking;
  const userGoals =
    (forKicking?.conversions ?? fixture.scoringFor?.conversions ?? 0) +
    (forKicking?.penalties ?? fixture.scoringFor?.penalties ?? 0) +
    (forKicking?.dropGoals ?? fixture.scoringFor?.dropGoals ?? 0);
  const oppGoals =
    (againstKicking?.conversions ?? fixture.scoringAgainst?.conversions ?? 0) +
    (againstKicking?.penalties ?? fixture.scoringAgainst?.penalties ?? 0) +
    (againstKicking?.dropGoals ?? fixture.scoringAgainst?.dropGoals ?? 0);

  if (userGoals === 0 && oppGoals === 0) return null;

  if (pointsMargin > 0) {
    return `Tries were shared, but goal-kicking edged it ${userGoals} to ${oppGoals}.`;
  }
  return `Level on tries — their kicker won it ${oppGoals} goals to ${userGoals}.`;
}

function buildAttackShapeLine(
  forwardTries: number,
  backTries: number,
  seed: string,
  round: number
): string | null {
  const total = forwardTries + backTries;
  if (total === 0) return null;

  if (forwardTries >= 2 && forwardTries > backTries) {
    return pickVariant(
      [
        `The pack led the way with ${formatTryCount(forwardTries)} through the middle.`,
        `Forwards did the damage — ${formatTryCount(forwardTries)} from the pack.`,
        `A strong afternoon for the forwards with ${formatTryCount(forwardTries)} close to the sticks.`,
      ],
      seed,
      `pack-r${round}`
    );
  }
  if (backTries >= 2 && backTries > forwardTries) {
    return pickVariant(
      [
        `The backs finished the chances — ${formatTryCount(backTries)} out wide.`,
        `Width told the story as the back line crossed ${formatTryCount(backTries)}.`,
        `Out wide was where the damage was done with ${formatTryCount(backTries)} from the backs.`,
      ],
      seed,
      `backs-r${round}`
    );
  }
  if (forwardTries > 0 && backTries > 0) {
    return `Tries were shared across the pack and the backs.`;
  }
  if (forwardTries > 0) {
    return `All ${formatTryCount(forwardTries)} came from the forwards.`;
  }
  return `The back line did all the scoring with ${formatTryCount(backTries)}.`;
}

function buildResultOpener(
  fixture: MatchFixture,
  clubName: string,
  competition?: ManagerCompetition,
  cupRound?: CupRoundKey
): string {
  const won = fixture.result === "W";
  const margin = Math.abs(fixture.pointsFor - fixture.pointsAgainst);
  const close = isCloseMargin(margin);
  const heavy = isHeavyMargin(margin, fixture.isThrashing);
  const venue = formatVenue(fixture);
  const compLabel = competition
    ? getManagerCompetitionLabel(competition, cupRound).toLowerCase()
    : "league";
  const score = `${fixture.pointsFor}-${fixture.pointsAgainst}`;

  if (competition === "challenge_cup") {
    const cupVenue = fixture.isNeutral
      ? `at ${CHALLENGE_CUP_FINAL_VENUE}`
      : venue;
    if (won && heavy) {
      return `${clubName} marched into the next round with a commanding ${score} ${cupVenue} win over ${fixture.opponent} in the ${compLabel}.`;
    }
    if (won && close) {
      return `A ${score} ${cupVenue} win over ${fixture.opponent} kept your Challenge Cup run alive in a tense ${compLabel} tie.`;
    }
    if (!won && close) {
      return `${fixture.opponent} ended your cup run with a narrow ${fixture.pointsAgainst}-${fixture.pointsFor} win ${cupVenue} in the ${compLabel}.`;
    }
    if (!won) {
      return `Cup heartbreak for ${clubName} — a ${fixture.pointsAgainst}-${fixture.pointsFor} defeat ${cupVenue} to ${fixture.opponent} in the ${compLabel}.`;
    }
    return `${clubName} booked their place in the next round with a ${score} ${cupVenue} win over ${fixture.opponent}.`;
  }

  if (competition === "playoffs") {
    if (won) {
      return close
        ? `${clubName} survived a playoff thriller, edging ${fixture.opponent} ${score} ${venue}.`
        : `${clubName} took a big step towards the Grand Final with a ${score} ${venue} win over ${fixture.opponent}.`;
    }
    return close
      ? `Play-off agony — ${fixture.opponent} knocked ${clubName} out ${fixture.pointsAgainst}-${fixture.pointsFor} ${venue} in a game that could have gone either way.`
      : `${fixture.opponent} ended ${clubName}'s season with a ${fixture.pointsAgainst}-${fixture.pointsFor} playoff defeat ${venue}.`;
  }

  if (competition === "friendly") {
    return won
      ? `A ${score} ${venue} friendly win over ${fixture.opponent} gave the squad useful minutes.`
      : `A ${fixture.pointsAgainst}-${fixture.pointsFor} friendly defeat ${venue} to ${fixture.opponent} — a run-out rather than a result that defines the season.`;
  }

  if (fixture.isNeutral && competition === "league") {
    const mwVenue = `at ${MAGIC_WEEKEND_VENUE}`;
    if (won && heavy) {
      return `${clubName} dominated Magic Weekend with a ${score} win over rivals ${fixture.opponent} ${mwVenue}.`;
    }
    if (won && close) {
      return `${clubName} edged rivals ${fixture.opponent} ${score} in a Magic Weekend thriller ${mwVenue}.`;
    }
    if (!won && close) {
      return `Magic Weekend heartbreak — ${fixture.opponent} edged ${clubName} ${fixture.pointsAgainst}-${fixture.pointsFor} ${mwVenue}.`;
    }
    if (!won) {
      return `${fixture.opponent} got the better of the Magic Weekend derby, beating ${clubName} ${fixture.pointsAgainst}-${fixture.pointsFor} ${mwVenue}.`;
    }
    return `${clubName} beat rivals ${fixture.opponent} ${score} at Magic Weekend ${mwVenue}.`;
  }

  if (won && heavy) {
    return `${clubName} put ${fixture.opponent} to the sword ${score} ${venue} in Round ${fixture.round}.`;
  }
  if (won && close) {
    return `${clubName} ground out a ${score} ${venue} win over ${fixture.opponent} in Round ${fixture.round}.`;
  }
  if (!won && close) {
    return `So close — ${fixture.opponent} edged ${clubName} ${fixture.pointsAgainst}-${fixture.pointsFor} ${venue} in Round ${fixture.round}.`;
  }
  if (!won && heavy) {
    return `A difficult afternoon for ${clubName}, beaten ${fixture.pointsAgainst}-${fixture.pointsFor} ${venue} by ${fixture.opponent} in Round ${fixture.round}.`;
  }
  if (won) {
    return `${clubName} beat ${fixture.opponent} ${score} ${venue} in Round ${fixture.round}.`;
  }
  return `${clubName} fell to ${fixture.opponent} ${fixture.pointsAgainst}-${fixture.pointsFor} ${venue} in Round ${fixture.round}.`;
}

function buildTryNarrative(
  fixture: MatchFixture,
  clubName: string,
  won: boolean,
  context: ManagerMatchBioContext,
  seed: string
): string {
  const userTries = fixture.triesFor;
  const oppTries = fixture.triesAgainst;
  const detail = fixture.scoringDetail;

  if (userTries === 0 && oppTries === 0) {
    return "A rare scoreless stalemate on the try line — a grinding, attritional contest.";
  }

  const parts: string[] = [];

  if (userTries !== oppTries) {
    const userLed = userTries > oppTries;
    const leaderCount = Math.max(userTries, oppTries);
    const trailerCount = Math.min(userTries, oppTries);
    const leaderName = userLed ? clubName : fixture.opponent;
    parts.push(
      `${leaderName} crossed ${formatTryCount(leaderCount)} to ${trailerCount === 0 ? "nil" : formatTryCount(trailerCount)}.`
    );
  } else {
    parts.push(`Both sides finished with ${formatTryCount(userTries)} apiece.`);
  }

  const userScorerLine = detail
    ? formatTopScorerLine(detail.dreamTeam.tryScorers, false)
    : null;
  const oppTopScorer = detail
    ? [...detail.opponent.tryScorers]
        .filter((s) => s.tries > 0)
        .sort((a, b) => b.tries - a.tries)[0]
    : null;

  if (won && userScorerLine) {
    parts.push(userScorerLine);
  } else if (!won && oppTopScorer) {
    if (oppTopScorer.tries >= 2) {
      parts.push(
        `${fixture.opponent} were led by ${oppTopScorer.name} with ${oppTopScorer.tries} tries.`
      );
    } else {
      parts.push(`${oppTopScorer.name}'s try proved the difference for ${fixture.opponent}.`);
    }
  } else if (userScorerLine) {
    parts.push(userScorerLine);
  }

  const forwardTries = context.forwardTries ?? 0;
  const backTries = context.backTries ?? 0;
  const shapeLine = buildAttackShapeLine(
    forwardTries,
    backTries,
    seed,
    fixture.round
  );
  if (shapeLine && (won || forwardTries + backTries > 0)) {
    parts.push(shapeLine);
  }

  const kicking = formatKickingDecider(fixture);
  if (kicking) parts.push(kicking);

  return parts.join(" ");
}

function buildTacticSentence(context: ManagerMatchBioContext): string | null {
  if (context.tacticEffectivenessLine) {
    return context.tacticEffectivenessLine;
  }
  if (context.tacticImpactLine) {
    return context.tacticImpactLine.charAt(0).toUpperCase() + context.tacticImpactLine.slice(1);
  }
  return null;
}

function buildExtras(
  fixture: MatchFixture,
  context: ManagerMatchBioContext,
  seed: string
): string[] {
  const extras: string[] = [];

  if (context.playedLive) {
    extras.push(
      pickVariant(
        [
          "You shaped the contest from the touchline — every call mattered in a game you played live.",
          "A live match where your in-game decisions influenced the final score.",
          "Played out in real time from the dugout, with your commands steering the flow of the game.",
        ],
        seed,
        `live-r${fixture.round}`
      )
    );
  }

  if (context.attendance?.excludedFromClubFunds) {
    const gate = context.attendance.attendance.toLocaleString();
    const venueName = context.attendance.venue ?? "the neutral venue";
    if (venueName === MAGIC_WEEKEND_VENUE) {
      extras.push(
        `Magic Weekend brought ${gate} fans to ${venueName} — a neutral venue, so neither club took gate receipts.`
      );
    } else if (venueName === CHALLENGE_CUP_FINAL_VENUE) {
      extras.push(
        `A crowd of ${gate} packed ${venueName} for the Challenge Cup Final — a neutral venue, so neither club took gate receipts.`
      );
    } else {
      extras.push(`A crowd of ${gate} packed ${venueName} for the Grand Final.`);
    }
  } else if (context.attendance && fixture.isHome) {
    const gate = context.attendance.attendance.toLocaleString();
    const mood = context.attendance.fanMoodChange;
    if (mood >= 3) {
      extras.push(`A crowd of ${gate} roared ${context.clubName} home — the stands loved it.`);
    } else if (mood <= -3) {
      extras.push(`${gate} fans turned up ${formatVenue(fixture)}, but left frustrated by what they saw.`);
    } else if (context.attendance.attendance >= 10_000) {
      extras.push(`Attendance was ${gate} for a big home fixture.`);
    }
  }

  if (context.injuryCount && context.injuryCount > 0) {
    const n = context.injuryCount;
    extras.push(
      n === 1
        ? "There was a casualty in the dressing room after the final hooter."
        : `${n} players picked up knocks that will need managing on the treatment table.`
    );
  }

  if (fixture.manOfTheMatch) {
    const motm = fixture.manOfTheMatch;
    const isUser = motm.teamName === context.clubName;
    if (isUser) {
      const summary = motm.performanceSummary
        ? ` — ${motm.performanceSummary}`
        : motm.tries && motm.tries >= 2
          ? ` with ${motm.tries} tries`
          : "";
      extras.push(`${motm.playerName} was player of the match${summary}.`);
    } else {
      extras.push(
        `${motm.playerName} was the difference for ${fixture.opponent}${motm.performanceSummary ? ` — ${motm.performanceSummary}` : ""}.`
      );
    }
  }

  return extras;
}

/** Rich match story for manager mode — scoreline, scorers, tactics, and context. */
export function generateManagerMatchBio(
  fixture: MatchFixture,
  seed: string,
  context: ManagerMatchBioContext
): string {
  const won = fixture.result === "W";
  const opener = buildResultOpener(
    fixture,
    context.clubName,
    context.competition,
    context.cupRound
  );
  const tryStory = buildTryNarrative(fixture, context.clubName, won, context, seed);
  const tactic = buildTacticSentence(context);
  const extras = buildExtras(fixture, context, seed);

  const sentences = [opener, tryStory];
  if (tactic) sentences.push(tactic);
  sentences.push(...extras.slice(0, 2));

  return sentences.filter(Boolean).join(" ");
}

/** Detect legacy fantasy-mode bios stored on manager saves. */
export function isLegacyFantasyMatchBio(bio?: string): boolean {
  if (!bio) return true;
  return (
    bio.includes("Dream Team") ||
    bio.includes("dream team") ||
    bio.includes("your side found a way")
  );
}
