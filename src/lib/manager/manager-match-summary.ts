import seedrandom from "seedrandom";
import type { MatchFixture } from "../game/season-simulation";
import type { ManOfTheMatch } from "../game/fantasy-match-summary";
import type { Position } from "../types";
import type {
  CupRoundKey,
  LiveMatchEvent,
  ManagerCareer,
  ManagerCompetition,
  ManagerTactics,
  MatchAttendanceMeta,
} from "./types";
import { getManagerCompetitionLabel } from "./managerFixtureDisplay";
import {
  ATTACK_FOCUS_LABELS,
  DEFENCE_FOCUS_LABELS,
  PLAYING_STYLE_LABELS,
} from "./managerTacticsCopy";
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
  tactics?: ManagerTactics;
  tacticImpactLine?: string;
  tacticEffectivenessLine?: string;
  attendance?: MatchAttendanceMeta;
  playedLive?: boolean;
  liveEvents?: LiveMatchEvent[];
  injuryCount?: number;
  injuries?: string[];
  forwardTries?: number;
  backTries?: number;
  /** Form string before this result (e.g. WWL). */
  recentForm?: string[];
  /** League table position after this match (league only). */
  tablePosition?: number;
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

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

function formatGoalBreakdown(
  tries: number,
  scoring: MatchFixture["scoringFor"],
  kicking:
    | {
        conversions?: number;
        penalties?: number;
        dropGoals?: number;
      }
    | null
    | undefined
): string {
  const conv = kicking?.conversions ?? scoring?.conversions ?? 0;
  const pens = kicking?.penalties ?? scoring?.penalties ?? 0;
  const drops = kicking?.dropGoals ?? scoring?.dropGoals ?? 0;
  const parts: string[] = [];
  if (tries > 0) parts.push(`${tries} ${tries === 1 ? "try" : "tries"}`);
  if (conv > 0) parts.push(`${conv} ${conv === 1 ? "goal" : "goals"}`);
  if (pens > 0) parts.push(`${pens} ${pens === 1 ? "penalty" : "penalties"}`);
  if (drops > 0) parts.push(`${drops} drop ${drops === 1 ? "goal" : "goals"}`);
  return parts.length > 0 ? parts.join(", ") : "no scores";
}

function formatScorerList(
  scorers: { name: string; tries: number }[],
  maxNames = 3
): string | null {
  const active = scorers.filter((s) => s.tries > 0);
  if (active.length === 0) return null;

  const parts = active.slice(0, maxNames).map((s) =>
    s.tries > 1 ? `${s.name} (${s.tries})` : s.name
  );
  const rest = active.length - maxNames;
  if (rest > 0) {
    parts.push(`${rest} more`);
  }
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function countFormStreak(form: string[], result: "W" | "L"): number {
  let streak = 1;
  for (let i = form.length - 1; i >= 0; i--) {
    if (form[i] === result) streak++;
    else break;
  }
  return streak;
}

function buildHookParagraph(
  fixture: MatchFixture,
  context: ManagerMatchBioContext
): string {
  const { clubName } = context;
  const won = fixture.result === "W";
  const margin = Math.abs(fixture.pointsFor - fixture.pointsAgainst);
  const close = isCloseMargin(margin);
  const heavy = isHeavyMargin(margin, fixture.isThrashing);
  const venue = formatVenue(fixture);
  const vs = fixture.opponent;
  const score = `${fixture.pointsFor}-${fixture.pointsAgainst}`;
  const comp = context.competition;
  const compLabel = comp
    ? getManagerCompetitionLabel(comp, context.cupRound).toLowerCase()
    : "league";

  if (fixture.isUpset && won) {
    return pickVariant(
      [
        `${clubName} pulled off the upset of the round, beating ${vs} ${score} ${venue} when few fancied them.`,
        `Against the run of form and the odds, ${clubName} stunned ${vs} ${score} ${venue}.`,
        `${vs} were tipped to win this one — ${clubName} had other ideas, taking it ${score} ${venue}.`,
      ],
      `${context.clubName}-hook`,
      `upset-r${fixture.round}`
    );
  }

  if (heavy && won) {
    return pickVariant(
      [
        `${clubName} ran riot against ${vs}, posting ${score} ${venue} in a one-sided ${compLabel} affair.`,
        `This was never in doubt — ${clubName} hammered ${vs} ${score} ${venue}.`,
        `${vs} had no answer as ${clubName} piled on ${score} ${venue}.`,
      ],
      `${context.clubName}-hook`,
      `heavy-win-r${fixture.round}`
    );
  }

  if (heavy && !won) {
    return pickVariant(
      [
        `${clubName} were torn apart by ${vs}, going down ${fixture.pointsAgainst}-${fixture.pointsFor} ${venue}.`,
        `A chastening ${fixture.pointsAgainst}-${fixture.pointsFor} defeat ${venue} — ${vs} were simply too good.`,
        `${vs} cut ${clubName} open at will in a ${fixture.pointsAgainst}-${fixture.pointsFor} ${compLabel} rout ${venue}.`,
      ],
      `${context.clubName}-hook`,
      `heavy-loss-r${fixture.round}`
    );
  }

  if (comp === "challenge_cup") {
    const cupVenue = fixture.isNeutral
      ? `at ${CHALLENGE_CUP_FINAL_VENUE}`
      : venue;
    if (won && close) {
      return `${clubName} scraped through the ${compLabel} ${score} ${cupVenue} against ${vs} — the cup run lives on by the finest margin.`;
    }
    if (won) {
      return `${clubName} are into the next round after beating ${vs} ${score} ${cupVenue} in the ${compLabel}.`;
    }
    if (close) {
      return `Cup exit — ${vs} ended ${clubName}'s Challenge Cup run ${fixture.pointsAgainst}-${fixture.pointsFor} ${cupVenue} in a ${compLabel} nail-biter.`;
    }
    return `${clubName}'s Challenge Cup campaign is over: ${vs} won ${fixture.pointsAgainst}-${fixture.pointsFor} ${cupVenue} in the ${compLabel}.`;
  }

  if (comp === "playoffs") {
    if (won && close) {
      return `Play-off survival — ${clubName} edged ${vs} ${score} ${venue} in a game that could have gone either way.`;
    }
    if (won) {
      return `${clubName} stay in the hunt for Old Trafford with a ${score} play-off win over ${vs} ${venue}.`;
    }
    if (close) {
      return `Play-off heartbreak: ${vs} knocked ${clubName} out ${fixture.pointsAgainst}-${fixture.pointsFor} ${venue} by a single score.`;
    }
    return `${vs} ended ${clubName}'s season ${fixture.pointsAgainst}-${fixture.pointsFor} ${venue} in the play-offs.`;
  }

  if (comp === "friendly") {
    return won
      ? `${clubName} won a ${score} pre-season friendly ${venue} against ${vs} — useful minutes, if not league points.`
      : `${clubName} lost ${fixture.pointsAgainst}-${fixture.pointsFor} to ${vs} in a friendly ${venue} — a run-out rather than a crisis.`;
  }

  if (fixture.isNeutral && comp === "league") {
    const mw = `at ${MAGIC_WEEKEND_VENUE}`;
    return won
      ? close
        ? `${clubName} edged ${vs} ${score} in a Magic Weekend thriller ${mw}.`
        : `${clubName} took the Magic Weekend derby ${score} against ${vs} ${mw}.`
      : close
        ? `${vs} nicked Magic Weekend bragging rights ${fixture.pointsAgainst}-${fixture.pointsFor} against ${clubName} ${mw}.`
        : `${vs} dominated the Magic Weekend clash, beating ${clubName} ${fixture.pointsAgainst}-${fixture.pointsFor} ${mw}.`;
  }

  if (close && won) {
    return pickVariant(
      [
        `${clubName} held their nerve to beat ${vs} ${score} ${venue} in Round ${fixture.round}.`,
        `A single-score ${compLabel} win — ${clubName} ${score} ${vs} ${venue} (Round ${fixture.round}).`,
        `${vs} pushed ${clubName} all the way, but ${score} ${venue} was enough in Round ${fixture.round}.`,
      ],
      `${context.clubName}-hook`,
      `close-win-r${fixture.round}`
    );
  }

  if (close && !won) {
    return pickVariant(
      [
        `${clubName} lost ${fixture.pointsAgainst}-${fixture.pointsFor} to ${vs} ${venue} — one moment separated the sides in Round ${fixture.round}.`,
        `So close for ${clubName}: ${vs} won ${fixture.pointsAgainst}-${fixture.pointsFor} ${venue} in a Round ${fixture.round} classic.`,
        `${vs} edged a tight Round ${fixture.round} contest ${fixture.pointsAgainst}-${fixture.pointsFor} ${venue}.`,
      ],
      `${context.clubName}-hook`,
      `close-loss-r${fixture.round}`
    );
  }

  if (won) {
    return `${clubName} beat ${vs} ${score} ${venue} in Round ${fixture.round}.`;
  }
  return `${clubName} lost ${fixture.pointsAgainst}-${fixture.pointsFor} to ${vs} ${venue} in Round ${fixture.round}.`;
}

function buildScoringParagraph(
  fixture: MatchFixture,
  context: ManagerMatchBioContext
): string {
  const detail = fixture.scoringDetail;
  const won = fixture.result === "W";
  const userBreakdown = formatGoalBreakdown(
    fixture.triesFor,
    fixture.scoringFor,
    detail?.dreamTeam.kicking
  );
  const oppBreakdown = formatGoalBreakdown(
    fixture.triesAgainst,
    fixture.scoringAgainst,
    detail?.opponent.kicking
  );

  if (fixture.triesFor === 0 && fixture.triesAgainst === 0) {
    return `Neither side crossed the line — a ${fixture.pointsFor}-${fixture.pointsAgainst} slugfest decided entirely by the boot.`;
  }

  const parts: string[] = [];

  if (won) {
    parts.push(
      `${context.clubName} posted ${userBreakdown} for ${fixture.pointsFor} points; ${fixture.opponent} replied with ${oppBreakdown} (${fixture.pointsAgainst}).`
    );
  } else {
    parts.push(
      `${fixture.opponent} finished with ${oppBreakdown} (${fixture.pointsAgainst}); ${context.clubName} managed ${userBreakdown} (${fixture.pointsFor}).`
    );
  }

  const userScorers = detail?.dreamTeam.tryScorers ?? [];
  const userList = formatScorerList(userScorers);
  const oppScorers = detail?.opponent.tryScorers ?? [];
  const oppList = formatScorerList(oppScorers);

  if (won && userList) {
    parts.push(
      pickVariant(
        [
          `The tries came from ${userList}.`,
          `${userList} got over the whitewash for ${context.clubName}.`,
          `On the scoresheet for ${context.clubName}: ${userList}.`,
        ],
        context.clubName,
        `user-scorers-r${fixture.round}`
      )
    );
  } else if (!won && oppList) {
    parts.push(
      `${fixture.opponent}'s points chiefly came through ${oppList}${
        userList ? `, while ${context.clubName}'s only response was ${userList}` : ""
      }.`
    );
  } else if (userList) {
    parts.push(`${context.clubName}'s tries: ${userList}.`);
  }

  const userKicker = detail?.dreamTeam.kicking;
  const oppKicker = detail?.opponent.kicking;
  const userGoals =
    (userKicker?.conversions ?? 0) +
    (userKicker?.penalties ?? 0) +
    (userKicker?.dropGoals ?? 0);
  const oppGoals =
    (oppKicker?.conversions ?? 0) +
    (oppKicker?.penalties ?? 0) +
    (oppKicker?.dropGoals ?? 0);

  if (fixture.triesFor === fixture.triesAgainst && userGoals !== oppGoals) {
    const kickerName = won
      ? userKicker?.name
      : oppKicker?.name ?? fixture.opponent;
    parts.push(
      kickerName
        ? `Level on tries — ${kickerName}'s boot made the difference (${userGoals} goals to ${oppGoals}).`
        : formatKickingDecider(fixture) ?? ""
    );
  } else if (
    userKicker &&
    userGoals >= 3 &&
    (userKicker.penalties ?? 0) >= 2 &&
    won
  ) {
    parts.push(
      `${userKicker.name} kicked ${userGoals} points from the tee to keep the scoreboard ticking.`
    );
  }

  const forwardTries = context.forwardTries ?? 0;
  const backTries = context.backTries ?? 0;
  if (forwardTries >= 2 && forwardTries > backTries) {
    parts.push(
      pickVariant(
        [
          `The pack did the heavy lifting — ${formatTryCount(forwardTries)} from the forwards.`,
          `${formatTryCount(forwardTries)} came through the middle as the forwards dominated.`,
        ],
        context.clubName,
        `pack-r${fixture.round}`
      )
    );
  } else if (backTries >= 2 && backTries > forwardTries) {
    parts.push(
      pickVariant(
        [
          `Width hurt them — ${formatTryCount(backTries)} from the back line.`,
          `The backs finished the chances with ${formatTryCount(backTries)} out wide.`,
        ],
        context.clubName,
        `backs-r${fixture.round}`
      )
    );
  }

  return parts.filter(Boolean).join(" ");
}

function buildLiveMomentsParagraph(
  events: LiveMatchEvent[],
  fixture: MatchFixture,
  clubName: string
): string | null {
  if (events.length === 0) return null;

  const userTries = events.filter((e) => e.type === "try" && e.team === "user");
  const oppTries = events.filter((e) => e.type === "try" && e.team === "opponent");
  const won = fixture.result === "W";

  const lastUserTry = userTries[userTries.length - 1];
  const lastOppTry = oppTries[oppTries.length - 1];

  if (won && lastUserTry && lastUserTry.minute >= 65) {
    const name = lastUserTry.playerName ?? "A late try";
    return pickVariant(
      [
        `You played it live — ${name} after ${lastUserTry.minute} minutes settled a contest that was still alive deep into the second half.`,
        `From the touchline you saw it unfold: ${name}'s try in the ${lastUserTry.minute}th minute finally broke ${fixture.opponent}'s resistance.`,
        `Live from the dugout: ${name} crossed with ${90 - lastUserTry.minute} minutes or less on the clock to seal the ${fixture.pointsFor}-${fixture.pointsAgainst} win.`,
      ],
      clubName,
      `live-late-r${fixture.round}`
    );
  }

  if (!won && lastOppTry && lastOppTry.minute >= 65) {
    const name = lastOppTry.playerName ?? fixture.opponent;
    return `${name}'s try after ${lastOppTry.minute} minutes — in a match you managed live — swung a tight game ${fixture.opponent}'s way.`;
  }

  if (userTries.length >= 2 && oppTries.length >= 2) {
    const firstUser = userTries[0];
    const firstOpp = oppTries[0];
    if (firstUser && firstOpp) {
      return `A back-and-forth affair you played live: ${firstUser.playerName ?? "your side"} and ${firstOpp.playerName ?? fixture.opponent} both struck early before the lead changed hands.`;
    }
  }

  if (contextPlayedLive(events)) {
    return pickVariant(
      [
        `You called every play from the touchline in a match that finished ${fixture.pointsFor}-${fixture.pointsAgainst}.`,
        `Played live — your in-game calls shaped a ${fixture.pointsFor}-${fixture.pointsAgainst} result against ${fixture.opponent}.`,
      ],
      clubName,
      `live-generic-r${fixture.round}`
    );
  }

  return null;
}

function contextPlayedLive(events: LiveMatchEvent[]): boolean {
  return events.length > 0;
}

function buildTacticsParagraph(
  fixture: MatchFixture,
  context: ManagerMatchBioContext
): string | null {
  if (context.tacticEffectivenessLine) {
    return context.tacticEffectivenessLine;
  }

  const tactics = context.tactics;
  if (!tactics) {
    if (context.tacticImpactLine) {
      return (
        context.tacticImpactLine.charAt(0).toUpperCase() +
        context.tacticImpactLine.slice(1)
      );
    }
    return null;
  }

  const won = fixture.result === "W";
  const style = PLAYING_STYLE_LABELS[tactics.playingStyle];
  const attack = ATTACK_FOCUS_LABELS[tactics.attackFocus];
  const defence = DEFENCE_FOCUS_LABELS[tactics.defenceFocus];
  const forward = context.forwardTries ?? 0;
  const back = context.backTries ?? 0;

  if (tactics.playingStyle === "direct" && forward >= 2) {
    return won
      ? `The ${style} game plan paid off — ${attack} focus and ${defence.toLowerCase()} behind it, with the pack supplying ${formatTryCount(forward)}.`
      : `You set up ${style} with ${attack.toLowerCase()} attack, but ${defence.toLowerCase()} couldn't keep ${fixture.opponent} out.`;
  }

  if (tactics.playingStyle === "expansive" && back >= 2) {
    return won
      ? `${style} rugby with ${attack.toLowerCase()} emphasis — the backs finished ${formatTryCount(back)} as planned.`
      : `${style} width created chances (${formatTryCount(back)} back-line tries) but ${defence.toLowerCase()} leaked too often.`;
  }

  if (tactics.defenceFocus === "edge_defence" && fixture.triesAgainst <= 1) {
    return won
      ? `${defence} did its job — ${fixture.opponent} barely got over the line (${fixture.triesAgainst} ${fixture.triesAgainst === 1 ? "try" : "tries"}).`
      : `${defence} kept the score down, but ${style.toLowerCase()} attack couldn't find enough points.`;
  }

  if (tactics.attackFocus === "kicking_game") {
    return won
      ? `${attack} and ${defence.toLowerCase()} — territory from the boot set up a ${fixture.pointsFor}-${fixture.pointsAgainst} win.`
      : `${attack} built pressure, yet ${fixture.opponent} found answers under your ${defence.toLowerCase()} shape.`;
  }

  return won
    ? `${style} with ${attack.toLowerCase()} attack and ${defence.toLowerCase()} — the setup you picked delivered a ${fixture.pointsFor}-${fixture.pointsAgainst} win.`
    : `${style}, ${attack.toLowerCase()} attack, ${defence.toLowerCase()} — not enough today against ${fixture.opponent}.`;
}

function buildContextParagraph(
  fixture: MatchFixture,
  context: ManagerMatchBioContext
): string | null {
  const parts: string[] = [];
  const won = fixture.result === "W";
  const form = context.recentForm ?? [];

  if (form.length > 0) {
    const streak = countFormStreak(form, won ? "W" : "L");
    if (streak >= 3 && won) {
      parts.push(
        pickVariant(
          [
            `That's ${streak} wins on the bounce — the dressing room is buzzing.`,
            `${streak} straight victories now — form is building nicely.`,
          ],
          context.clubName,
          `form-win-${streak}`
        )
      );
    } else if (streak >= 3 && !won) {
      parts.push(
        `${streak} defeats in a row — something has to change before the next outing.`
      );
    }
  }

  const pos = context.tablePosition;
  if (pos != null && context.competition !== "challenge_cup" && context.competition !== "playoffs" && context.competition !== "friendly") {
    if (pos === 1 && won) {
      parts.push(`You stay top of the Super League table.`);
    } else if (pos === 1 && !won) {
      parts.push(`Still top, but rivals will scent blood after those dropped points.`);
    } else if (pos <= 4 && won) {
      parts.push(`${ordinal(pos)} place — still in the title picture.`);
    } else if (pos <= 6 && won) {
      parts.push(`${ordinal(pos)} keeps the play-off spots in sight.`);
    } else if (pos >= 12 && !won) {
      parts.push(`Defeat leaves you ${ordinal(pos)} — the bottom end of the table is uncomfortably close.`);
    } else if (pos >= 10 && !won) {
      parts.push(`Slipping to ${ordinal(pos)} — every point matters from here.`);
    }
  }

  if (context.attendance && fixture.isHome && !context.attendance.excludedFromClubFunds) {
    const gate = context.attendance.attendance.toLocaleString();
    const mood = context.attendance.fanMoodChange;
    if (mood >= 4) {
      parts.push(`${gate} fans went home happy after a result they came to see.`);
    } else if (mood <= -4) {
      parts.push(`${gate} turned up at home and left disappointed.`);
    }
  }

  if (context.injuries && context.injuries.length === 1) {
    parts.push(`${context.injuries[0]} picked up a knock that needs managing.`);
  } else if (context.injuries && context.injuries.length > 1) {
    parts.push(
      `${context.injuries.slice(0, 2).join(" and ")}${context.injuries.length > 2 ? " among others" : ""} require treatment after the game.`
    );
  }

  if (fixture.manOfTheMatch) {
    const motm = fixture.manOfTheMatch;
    const isUser = motm.teamName === context.clubName;
    const summary = motm.performanceSummary ? ` — ${motm.performanceSummary}` : "";
    if (isUser) {
      parts.push(`${motm.playerName} took the man-of-the-match award${summary}.`);
    } else {
      parts.push(`${motm.playerName} was ${fixture.opponent}'s standout${summary}.`);
    }
  }

  return parts.length > 0 ? parts.join(" ") : null;
}

/** Rich match story for manager mode — scoreline, scorers, tactics, and context. */
export function generateManagerMatchBio(
  fixture: MatchFixture,
  seed: string,
  context: ManagerMatchBioContext
): string {
  const paragraphs: string[] = [
    buildHookParagraph(fixture, context),
    buildScoringParagraph(fixture, context),
  ];

  if (context.playedLive && context.liveEvents?.length) {
    const live = buildLiveMomentsParagraph(
      context.liveEvents,
      fixture,
      context.clubName
    );
    if (live) paragraphs.push(live);
  }

  const tactics = buildTacticsParagraph(fixture, context);
  if (tactics) paragraphs.push(tactics);

  const extra = buildContextParagraph(fixture, context);
  if (extra) paragraphs.push(extra);

  return paragraphs.filter(Boolean).join("\n\n");
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
