import type { MatchFixture } from "../game/season-simulation";
import type { ManagerCareer, ManagerCompetition } from "./types";
import { getManagerCompetitionLabel } from "./managerFixtureDisplay";
import { pushInboxMessage } from "./managerInbox";

export type MatchKeyMomentTone = "gold" | "primary" | "red" | "sky" | "muted";

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

function isCloseMargin(margin: number): boolean {
  return margin <= 6;
}

function isDominantMargin(margin: number, isThrashing?: boolean): boolean {
  return isThrashing === true || margin >= 20;
}

function isComfortableMargin(margin: number): boolean {
  return margin >= 7 && margin <= 19;
}

function isHighScoring(fixture: MatchFixture): boolean {
  return fixture.pointsFor + fixture.pointsAgainst >= 56;
}

export function getManagerMatchKeyMoment(
  fixture: MatchFixture,
  clubName: string,
  competition?: ManagerCompetition
): ManagerMatchKeyMoment | null {
  const won = fixture.result === "W";
  const lost = fixture.result === "L";
  const margin = Math.abs(fixture.pointsFor - fixture.pointsAgainst);
  const comp = competitionLabel(competition).toLowerCase();
  const vs = fixture.opponent;
  const close = isCloseMargin(margin);
  const dominant = isDominantMargin(margin, fixture.isThrashing);
  const comfortable = isComfortableMargin(margin);

  if (competition === "friendly") {
    return {
      id: "friendly",
      label: "Friendly",
      headline: won ? "Pre-season run-out" : "Friendly defeat",
      body: won
        ? `Useful minutes against ${vs} — no league points on the line.`
        : `${clubName} lost a friendly to ${vs}; nothing that defines the season.`,
      tone: "muted",
    };
  }

  if (competition === "challenge_cup" && won) {
    return {
      id: "cup-win",
      label: "Cup tie",
      headline: close ? "Cup tie survived" : dominant ? "Cup demolition" : "Into the next round",
      body: close
        ? `${clubName} scraped past ${vs} — the Challenge Cup run continues.`
        : dominant
          ? `${clubName} blew ${vs} away and marched into the next round.`
          : `${clubName} beat ${vs} to keep the Challenge Cup dream alive.`,
      tone: "gold",
    };
  }

  if (competition === "challenge_cup" && lost) {
    return {
      id: "cup-loss",
      label: "Cup exit",
      headline: close ? "Cup heartbreak" : dominant ? "Cup rout" : "Out of the cup",
      body: close
        ? `So close against ${vs} — ${clubName}'s Challenge Cup run is over.`
        : dominant
          ? `${vs} ended the cup run in brutal fashion.`
          : `${vs} knocked ${clubName} out of the Challenge Cup.`,
      tone: "red",
    };
  }

  if (competition === "playoffs" && won) {
    return {
      id: "playoff-win",
      label: "Play-offs",
      headline: close ? "Play-off thriller" : dominant ? "Play-off statement" : "Still in the hunt",
      body: close
        ? `${clubName} survived a nail-biter against ${vs} — Old Trafford remains in sight.`
        : dominant
          ? `${clubName} hammered ${vs} and took a huge step towards the Grand Final.`
          : `${clubName} beat ${vs} to stay alive in the play-offs.`,
      tone: "gold",
    };
  }

  if (competition === "playoffs" && lost) {
    return {
      id: "playoff-loss",
      label: "Play-offs",
      headline: close ? "Play-off agony" : "Season over",
      body: close
        ? `${vs} ended ${clubName}'s play-off campaign by the finest margin.`
        : `${vs} knocked ${clubName} out of the play-offs.`,
      tone: "red",
    };
  }

  if (fixture.isUpset && won) {
    return {
      id: "upset-win",
      label: "Upset",
      headline: "Against the odds",
      body: `${clubName} weren't fancied against ${vs} but pulled off a famous ${comp} win.`,
      tone: "gold",
    };
  }

  if (fixture.isUpset && lost) {
    return {
      id: "upset-loss",
      label: "Shock defeat",
      headline: "Favourites fall short",
      body: `${clubName} were tipped to beat ${vs} and came up well short — a result that stings.`,
      tone: "red",
    };
  }

  if (won && fixture.triesAgainst === 0 && fixture.triesFor >= 3) {
    return {
      id: "shutout-win",
      label: "Clean sheet",
      headline: "Defence untroubled",
      body: `${clubName} kept ${vs} try-less — a complete ${comp} performance at both ends.`,
      tone: "primary",
    };
  }

  if (lost && fixture.triesFor === 0) {
    return {
      id: "blank-loss",
      label: "Blank afternoon",
      headline: "No answer in attack",
      body: `${clubName} couldn't cross against ${vs} — a frustrating ${comp} afternoon.`,
      tone: "red",
    };
  }

  if (won && dominant) {
    return {
      id: "dominant-win",
      label: "Statement win",
      headline: "Dominant display",
      body: `${clubName} put ${vs} to the sword in a one-sided ${comp} win.`,
      tone: "primary",
    };
  }

  if (lost && dominant) {
    return {
      id: "dominant-loss",
      label: "Heavy defeat",
      headline: "Well beaten",
      body: `${vs} had far too much for ${clubName} — a chastening ${comp} defeat.`,
      tone: "red",
    };
  }

  if (isHighScoring(fixture) && close) {
    return {
      id: "shootout",
      label: "Shoot-out",
      headline: won ? "Points galore" : "High-scoring heartbreak",
      body: won
        ? `${clubName} edged a wild ${comp} shoot-out against ${vs}.`
        : `${clubName} scored plenty against ${vs} but still came up short.`,
      tone: won ? "sky" : "red",
    };
  }

  if (won && close) {
    return {
      id: "narrow-win",
      label: "Narrow win",
      headline: "Nail-biter",
      body: `${clubName} edged a tight ${comp} contest against ${vs}.`,
      tone: "sky",
    };
  }

  if (lost && close) {
    return {
      id: "narrow-loss",
      label: "Narrow loss",
      headline: "Heartbreaker",
      body: `${clubName} came up just short against ${vs} in a game that could have gone either way.`,
      tone: "red",
    };
  }

  if (won && comfortable) {
    return {
      id: "comfortable-win",
      label: "Comfortable win",
      headline: "Professional job",
      body: `${clubName} controlled the ${comp} clash with ${vs} and won without needing a late scare.`,
      tone: "primary",
    };
  }

  if (lost && comfortable) {
    return {
      id: "comfortable-loss",
      label: "Outplayed",
      headline: "Second best",
      body: `${vs} were clearly the better side — ${clubName} never really got a foothold.`,
      tone: "red",
    };
  }

  if (won) {
    return {
      id: "routine-win",
      label: "League win",
      headline: fixture.isHome ? "Home comforts" : "Away day success",
      body: `${clubName} took the ${comp} points against ${vs}${fixture.isHome ? " in front of their own fans" : " on the road"}.`,
      tone: "primary",
    };
  }

  if (lost) {
    return {
      id: "routine-loss",
      label: "Defeat",
      headline: fixture.isHome ? "Home disappointment" : "Away day defeat",
      body: `${clubName} lost a ${comp} fixture to ${vs}${fixture.isHome ? " at home" : ""}.`,
      tone: "muted",
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
