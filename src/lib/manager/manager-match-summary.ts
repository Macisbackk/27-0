import seedrandom from "seedrandom";
import type { MatchFixture } from "../game/season-simulation";
import type {
  CupRoundKey,
  ManagerCompetition,
  MatchAttendanceMeta,
} from "./types";
import { getManagerCompetitionLabel } from "./managerFixtureDisplay";

export interface ManagerMatchBioContext {
  clubName: string;
  competition?: ManagerCompetition;
  cupRound?: CupRoundKey;
  tacticImpactLine?: string;
  tacticEffectivenessLine?: string;
  attendance?: MatchAttendanceMeta;
  playedLive?: boolean;
  injuryCount?: number;
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

function formatVenue(fixture: MatchFixture): string {
  if (fixture.isNeutral) return "at a neutral venue";
  return fixture.isHome ? "at home" : "away";
}

function formatTryCount(n: number): string {
  return `${n} try${n !== 1 ? "ies" : ""}`;
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
    return `${owner} hat-trick was the headline act.`;
  }
  if (top.tries === 2) {
    if (sorted.length > 1 && sorted[1]!.tries > 0) {
      return `${top.name} scored twice, with ${sorted[1]!.name} also crossing.`;
    }
    return `${top.name} finished with a brace.`;
  }
  if (sorted.length >= 2) {
    const names = sorted
      .slice(0, 2)
      .map((s) => s.name)
      .join(" and ");
    return `${names} shared the tries.`;
  }
  return `${top.name} got over the line.`;
}

function formatKickingBattle(fixture: MatchFixture): string | null {
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

  const tryMargin = fixture.triesFor - fixture.triesAgainst;
  const pointsMargin = fixture.pointsFor - fixture.pointsAgainst;

  if (tryMargin === 0 && pointsMargin !== 0) {
    if (pointsMargin > 0) {
      return `The sides finished level on tries, but your kicking game edged it ${userGoals} goals to ${oppGoals}.`;
    }
    return `Tries were shared, but their goal-kicking won it ${oppGoals} to ${userGoals} off the boot.`;
  }

  if (userGoals >= 4 && oppGoals <= 1) {
    return `A reliable kicking display — ${userGoals} goals from the tee helped control the scoreboard.`;
  }
  if (oppGoals >= 4 && userGoals <= 1) {
    return `${fixture.opponent} punished errors with the boot, landing ${oppGoals} goals.`;
  }
  if (userGoals > oppGoals && fixture.result === "W") {
    return `Goals from the boot (${userGoals}) kept the pressure on when the line was defended.`;
  }
  if (oppGoals > userGoals && fixture.result === "L") {
    return `Their kicker was clinical with ${oppGoals} goals — yours managed ${userGoals}.`;
  }
  return null;
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
    if (won && heavy) {
      return `${clubName} marched into the next round with a commanding ${score} ${venue} win over ${fixture.opponent} in the ${compLabel}.`;
    }
    if (won && close) {
      return `A ${score} ${venue} win over ${fixture.opponent} kept your Challenge Cup run alive in a tense ${compLabel} tie.`;
    }
    if (!won && close) {
      return `${fixture.opponent} ended your cup run with a narrow ${fixture.pointsAgainst}-${fixture.pointsFor} win ${venue} in the ${compLabel}.`;
    }
    if (!won) {
      return `Cup heartbreak for ${clubName} — a ${fixture.pointsAgainst}-${fixture.pointsFor} defeat ${venue} to ${fixture.opponent} in the ${compLabel}.`;
    }
    return `${clubName} booked their place in the next round with a ${score} ${venue} win over ${fixture.opponent}.`;
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
  won: boolean
): string {
  const userTries = fixture.triesFor;
  const oppTries = fixture.triesAgainst;
  const detail = fixture.scoringDetail;

  if (userTries === 0 && oppTries === 0) {
    return "A rare scoreless stalemate on the try line — every point came off the boot.";
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
  const oppScorerLine = detail
    ? formatTopScorerLine(detail.opponent.tryScorers, false)
    : null;

  if (won && userScorerLine) {
    parts.push(userScorerLine);
  } else if (!won && oppScorerLine) {
    const line =
      oppScorerLine.charAt(0).toLowerCase() + oppScorerLine.slice(1);
    parts.push(`${fixture.opponent} were led by ${line}`);
  } else if (userScorerLine) {
    parts.push(userScorerLine);
  }

  const kicking = formatKickingBattle(fixture);
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

  if (context.attendance && fixture.isHome) {
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
        ? ` (${motm.performanceSummary})`
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
  const tryStory = buildTryNarrative(fixture, context.clubName, won);
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
