import { getPlayoffRoundLabel } from "../game/playoff-bracket";
import { isChallengeCupFinalFixture } from "./managerChallengeCup";
import { isChallengeCupFixture } from "./managerFixtureDisplay";
import { isMagicWeekendFixture } from "./managerMagicWeekend";
import { isGrandFinalFixture } from "./managerPlayoffs";
import type { ManagerPillTone } from "./managerSurfaces";
import type {
  CupRoundKey,
  ManagerCompetition,
  ManagerScheduledFixture,
} from "./types";

/** Showcase / knockout weeks that should feel distinct from a league round. */
export type ManagerMatchOccasion =
  | "grand_final"
  | "cup_final"
  | "playoff"
  | "challenge_cup"
  | "wcc"
  | "magic_weekend"
  | "friendly"
  | "league";

export type ManagerMatchOccasionFixture = Pick<
  ManagerScheduledFixture,
  | "competition"
  | "cupRound"
  | "playoffRound"
  | "isNeutral"
  | "venue"
  | "round"
> & {
  /** Optional; present on scheduled fixtures but not required for occasion resolution. */
  label?: string;
};

export interface ManagerMatchOccasionPresentation {
  occasion: ManagerMatchOccasion;
  /** Hub / fixtures eyebrow (e.g. "Grand Final Week"). */
  weekLabel: string;
  badgeLabel: string;
  badgeTone: ManagerPillTone;
  /** Short atmospheric line under the title — omit when redundant with badge. */
  momentLine?: string;
  playCta: string;
  playCtaShort: string;
  simulateCta: string;
  /** Mobile sticky — still action-specific, never bare competition name. */
  simulateCtaShort: string;
  roundStatLabel: string;
  /** Soft wash on the scoreboard card. */
  surfaceClass: string;
  /** CSS modifier on `.matchday-scoreboard`. */
  matchdayModifier: string;
  momentTextClass: string;
  isShowcase: boolean;
}

const SURFACE = {
  grandFinal: "bg-accent-gold/[0.07]",
  cupFinal: "bg-accent-gold/[0.06]",
  playoff: "bg-amber-500/[0.06]",
  cup: "bg-accent-gold/[0.04]",
  wcc: "bg-sky-400/[0.07]",
  magic: "bg-theme-primary/[0.06]",
  friendly: "bg-sky-400/[0.04]",
  league: "bg-theme-primary/[0.04]",
} as const;

export function resolveManagerMatchOccasion(
  fixture: ManagerMatchOccasionFixture
): ManagerMatchOccasion {
  if (isGrandFinalFixture(fixture)) return "grand_final";
  if (isChallengeCupFinalFixture(fixture)) return "cup_final";
  if (fixture.competition === "playoffs") return "playoff";
  if (fixture.competition === "world_club_challenge") return "wcc";
  if (isMagicWeekendFixture(fixture)) return "magic_weekend";
  if (isChallengeCupFixture(fixture.competition)) return "challenge_cup";
  if (fixture.competition === "friendly") return "friendly";
  return "league";
}

function playoffBadgeLabel(playoffRound?: number): string {
  if (!playoffRound) return "Play-Offs";
  return getPlayoffRoundLabel(playoffRound);
}

export type FixtureActionKind = "play" | "simulate" | "simulate-round";

/**
 * Central fixture action labels — competition context lives in badges/headings,
 * not in single-match CTAs.
 */
export function getFixtureActionLabel(input: {
  fixture: ManagerMatchOccasionFixture;
  action: FixtureActionKind;
  compact?: boolean;
}): string {
  const { action } = input;
  if (action === "simulate-round") return "Simulate Round";
  if (action === "play") return "Play Game";
  return "Simulate Game";
}

export function getManagerMatchOccasionPresentation(
  fixture: ManagerMatchOccasionFixture
): ManagerMatchOccasionPresentation {
  const occasion = resolveManagerMatchOccasion(fixture);
  const playCta = getFixtureActionLabel({
    fixture,
    action: "play",
    compact: false,
  });
  const playCtaShort = getFixtureActionLabel({
    fixture,
    action: "play",
    compact: true,
  });
  const simulateCta = getFixtureActionLabel({
    fixture,
    action: "simulate",
    compact: false,
  });
  const simulateCtaShort = getFixtureActionLabel({
    fixture,
    action: "simulate",
    compact: true,
  });

  switch (occasion) {
    case "grand_final":
      return {
        occasion,
        weekLabel: "Grand Final Week",
        badgeLabel: "Grand Final",
        badgeTone: "gold",
        momentLine: fixture.venue
          ? `One match for the Super League — ${fixture.venue}`
          : "One match for the Super League title",
        playCta,
        playCtaShort,
        simulateCta,
        simulateCtaShort,
        roundStatLabel: "Showpiece",
        surfaceClass: SURFACE.grandFinal,
        matchdayModifier: "matchday-scoreboard--grand-final",
        momentTextClass: "text-accent-gold",
        isShowcase: true,
      };
    case "cup_final":
      return {
        occasion,
        weekLabel: "Cup Final Week",
        badgeLabel: "Cup Final",
        badgeTone: "gold",
        momentLine: fixture.venue
          ? `Challenge Cup glory at ${fixture.venue}`
          : "Challenge Cup glory on the biggest stage",
        playCta,
        playCtaShort,
        simulateCta,
        simulateCtaShort,
        roundStatLabel: "Final",
        surfaceClass: SURFACE.cupFinal,
        matchdayModifier: "matchday-scoreboard--cup-final",
        momentTextClass: "text-accent-gold",
        isShowcase: true,
      };
    case "playoff":
      return {
        occasion,
        weekLabel: "Play-Off Week",
        badgeLabel: playoffBadgeLabel(fixture.playoffRound),
        badgeTone: "amber",
        momentLine:
          fixture.playoffRound === 2
            ? "Semi-final — win and the Grand Final awaits"
            : "Knockout rugby — lose and the season ends",
        playCta,
        playCtaShort,
        simulateCta,
        simulateCtaShort,
        roundStatLabel: "Play-off round",
        surfaceClass: SURFACE.playoff,
        matchdayModifier: "matchday-scoreboard--playoff",
        momentTextClass: "text-amber-200",
        isShowcase: true,
      };
    case "challenge_cup":
      return {
        occasion,
        weekLabel: "Challenge Cup Week",
        badgeLabel: "Challenge Cup",
        badgeTone: "gold",
        // Round/venue already shown in badges and venue label — avoid Home/Away filler.
        momentLine:
          fixture.venue &&
          fixture.venue !== "Home" &&
          fixture.venue !== "Away"
            ? fixture.venue
            : undefined,
        playCta,
        playCtaShort,
        simulateCta,
        simulateCtaShort,
        roundStatLabel: "Cup round",
        surfaceClass: SURFACE.cup,
        matchdayModifier: "matchday-scoreboard--challenge-cup",
        momentTextClass: "text-accent-gold",
        isShowcase: true,
      };
    case "wcc":
      return {
        occasion,
        weekLabel: "WCC",
        badgeLabel: "WCC",
        badgeTone: "sky",
        momentLine: "World Club Challenge — Super League vs NRL champions",
        playCta,
        playCtaShort,
        simulateCta,
        simulateCtaShort,
        roundStatLabel: "Stage",
        surfaceClass: SURFACE.wcc,
        matchdayModifier: "matchday-scoreboard--wcc",
        momentTextClass: "text-sky-300",
        isShowcase: true,
      };
    case "magic_weekend":
      return {
        occasion,
        weekLabel: "Magic Weekend",
        badgeLabel: "Magic Weekend",
        badgeTone: "primary",
        momentLine: "Neutral-venue Super League — festival atmosphere",
        playCta,
        playCtaShort,
        simulateCta,
        simulateCtaShort,
        roundStatLabel: "Game week",
        surfaceClass: SURFACE.magic,
        matchdayModifier: "matchday-scoreboard--magic",
        momentTextClass: "text-theme-primary",
        isShowcase: true,
      };
    case "friendly":
      return {
        occasion,
        weekLabel: "Friendly Week",
        badgeLabel: "Friendly",
        badgeTone: "sky",
        momentLine: "Pre-season — sharpen the squad before Round 1",
        playCta,
        playCtaShort,
        simulateCta,
        simulateCtaShort,
        roundStatLabel: "Pre-season",
        surfaceClass: SURFACE.friendly,
        matchdayModifier: "matchday-scoreboard--friendly",
        momentTextClass: "text-sky-300",
        isShowcase: false,
      };
    default:
      return {
        occasion: "league",
        weekLabel: "Next fixture",
        badgeLabel: "Super League",
        badgeTone: "primary",
        momentLine: undefined,
        playCta,
        playCtaShort,
        simulateCta,
        simulateCtaShort,
        roundStatLabel: "Game week",
        surfaceClass: SURFACE.league,
        matchdayModifier: "",
        momentTextClass: "text-theme-primary",
        isShowcase: false,
      };
  }
}

/** Soft wash for any manager competition surface (cards, panels). */
export function managerOccasionSurfaceClass(
  competition: ManagerCompetition,
  options?: { cupRound?: CupRoundKey; playoffRound?: number; isNeutral?: boolean }
): string {
  return getManagerMatchOccasionPresentation({
    competition,
    cupRound: options?.cupRound,
    playoffRound: options?.playoffRound,
    isNeutral: options?.isNeutral,
    round: 0,
  }).surfaceClass;
}
