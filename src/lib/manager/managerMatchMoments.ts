import type { MatchFixture } from "../game/season-simulation";
import type { ManagerCareer, ManagerCompetition } from "./types";
import { getManagerCompetitionLabel } from "./managerFixtureDisplay";
import { pushInboxMessage } from "./managerInbox";

export type MatchKeyMomentTone = "gold" | "primary" | "red" | "sky";

export interface ManagerMatchKeyMoment {
  id: string;
  label: string;
  headline: string;
  body: string;
  tone: MatchKeyMomentTone;
}

function competitionLabel(competition?: ManagerCompetition): string {
  if (!competition) return "League";
  return getManagerCompetitionLabel(competition);
}

export function getManagerMatchKeyMoment(
  fixture: MatchFixture,
  clubName: string,
  competition?: ManagerCompetition
): ManagerMatchKeyMoment | null {
  const won = fixture.result === "W";
  const lost = fixture.result === "L";
  const margin = Math.abs(fixture.pointsFor - fixture.pointsAgainst);
  const comp = competitionLabel(competition);
  const score = `${fixture.pointsFor}-${fixture.pointsAgainst}`;
  const vs = fixture.opponent;

  if (competition === "challenge_cup" && won) {
    return {
      id: "cup-win",
      label: "Cup tie",
      headline: `Challenge Cup win — ${score} vs ${vs}`,
      body: `${clubName} are through to the next round of the Challenge Cup.`,
      tone: "gold",
    };
  }

  if (competition === "playoffs" && won) {
    return {
      id: "playoff-win",
      label: "Play-offs",
      headline: `Play-off victory — ${score} vs ${vs}`,
      body: `${clubName} stay alive in the play-off hunt.`,
      tone: "gold",
    };
  }

  if (fixture.isUpset && won) {
    return {
      id: "upset-win",
      label: "Upset",
      headline: `Upset win — ${score} vs ${vs}`,
      body: `Against the odds, ${clubName} pulled off a famous ${comp.toLowerCase()} result.`,
      tone: "gold",
    };
  }

  if (fixture.isThrashing && won) {
    return {
      id: "thrashing-win",
      label: "Statement win",
      headline: `Dominant display — ${score} vs ${vs}`,
      body: `${clubName} sent a message with a commanding ${comp.toLowerCase()} win.`,
      tone: "primary",
    };
  }

  if (fixture.isThrashing && lost) {
    return {
      id: "thrashing-loss",
      label: "Heavy defeat",
      headline: `Heavy loss — ${score} vs ${vs}`,
      body: `${clubName} were well beaten — the dressing room will need a response.`,
      tone: "red",
    };
  }

  if (competition === "challenge_cup" && lost && margin <= 6) {
    return {
      id: "cup-narrow-loss",
      label: "Cup exit",
      headline: `Narrow cup exit — ${score} vs ${vs}`,
      body: `So close in the Challenge Cup — ${clubName} fall just short.`,
      tone: "red",
    };
  }

  if (competition === "playoffs" && lost) {
    return {
      id: "playoff-loss",
      label: "Play-offs",
      headline: `Play-off defeat — ${score} vs ${vs}`,
      body: `${clubName}'s season hangs by a thread after a play-off loss.`,
      tone: "red",
    };
  }

  if (won && margin <= 4) {
    return {
      id: "narrow-win",
      label: "Narrow win",
      headline: `Nail-biter — ${score} vs ${vs}`,
      body: `${clubName} edged a tight ${comp.toLowerCase()} contest.`,
      tone: "sky",
    };
  }

  if (lost && margin <= 4) {
    return {
      id: "narrow-loss",
      label: "Narrow loss",
      headline: `Heartbreaker — ${score} vs ${vs}`,
      body: `${clubName} came up just short in a fine ${comp.toLowerCase()} battle.`,
      tone: "red",
    };
  }

  return null;
}

export function addMatchKeyMomentInboxMessage(
  career: ManagerCareer,
  fixture: MatchFixture,
  moment: ManagerMatchKeyMoment
): ManagerCareer {
  const fixtureKey = `r${fixture.round}-${fixture.opponent}`;
  const msgId = `match-moment-${fixtureKey}`;
  if (career.inboxMessages.some((m) => m.id === msgId)) return career;

  return pushInboxMessage(career, {
    id: msgId,
    type: "news",
    title: moment.headline,
    body: moment.body,
    week: career.gameWeek,
    season: career.seasonYear,
    gameWeek: career.gameWeek,
    createdAt: new Date().toISOString(),
    read: false,
    resolved: true,
  });
}
