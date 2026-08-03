import { pushInboxMessage } from "./managerInbox";
import { formatWage } from "./managerContracts";
import { areRivalClubs } from "./managerRivals";
import { getManagerSeasonTrophyLabels } from "./managerSeasonTrophies";
import { shouldShowChallengeCupCelebration } from "./managerChallengeCup";
import { shouldShowLeagueWinnersCelebration } from "./managerPlayoffs";
import type {
  FacilityType,
  ManagerCareer,
  ManagerFixtureRecord,
} from "./types";

const FACILITY_BOARD_LABELS: Record<FacilityType, string> = {
  youth: "Youth academy",
  training: "Training facilities",
  stadium: "Stadium capacity",
  commercial: "Commercial & marketing",
};

const BIG_TRANSFER_FEE = 250_000;
const BOARD_CONFIDENCE_JUMP = 8;
const STRONG_GATE_CAPACITY_PCT = 0.9;
const YOUTH_CALLUP_THRESHOLD = 3;

export interface BoardMailOptions {
  deadlineLabel?: string;
  requiredAction?: string;
}

function appendBoardMail(
  career: ManagerCareer,
  id: string,
  title: string,
  body: string,
  options?: BoardMailOptions
): ManagerCareer {
  if (career.inboxMessages.some((m) => m.id === id || m.eventId === id)) {
    return career;
  }
  return pushInboxMessage(career, {
    id,
    eventId: id,
    type: "board",
    sender: "Board",
    title,
    body,
    week: career.gameWeek,
    season: career.seasonYear,
    gameWeek: career.gameWeek,
    createdAt: new Date().toISOString(),
    read: false,
    // Persist in Open mail until the manager dismisses — not auto-archived.
    resolved: false,
    deadlineLabel: options?.deadlineLabel,
    requiredAction: options?.requiredAction,
  });
}

function seasonTag(career: ManagerCareer): string {
  return `s${career.seasonYear}`;
}

function consecutiveWins(recentForm: string[]): number {
  let streak = 0;
  for (let i = recentForm.length - 1; i >= 0; i--) {
    if (recentForm[i] !== "W") break;
    streak++;
  }
  return streak;
}

function maybeWinStreakMail(career: ManagerCareer): ManagerCareer {
  const streak = consecutiveWins(career.recentForm);
  if (streak < 5) return career;
  const milestone = streak >= 10 ? 10 : 5;
  const id = `board-win-streak-${milestone}-${seasonTag(career)}`;
  const title =
    milestone >= 10 ? "Board note — historic run" : "Board note — winning streak";
  const body =
    milestone >= 10
      ? `The board congratulates the coaching staff on a ${streak}-match winning streak. Results of this calibre lift the whole club — keep standards high.`
      : `Five wins on the bounce have not gone unnoticed. The board is pleased with the run of form and expects the dressing room to keep pushing.`;
  return appendBoardMail(career, id, title, body);
}

function maybeTrophyMails(career: ManagerCareer): ManagerCareer {
  let next = career;
  const year = seasonTag(career);
  const trophies = getManagerSeasonTrophyLabels(career);

  if (
    shouldShowChallengeCupCelebration(career) ||
    trophies.includes("Challenge Cup")
  ) {
    next = appendBoardMail(
      next,
      `board-trophy-challenge-cup-${year}`,
      "Board — Challenge Cup winners",
      `Lifting the Challenge Cup is a landmark for this club. The board extends its congratulations to every player and member of staff involved.`
    );
  }

  if (
    shouldShowLeagueWinnersCelebration(career) ||
    trophies.includes("League Leaders")
  ) {
    next = appendBoardMail(
      next,
      `board-trophy-league-leaders-${year}`,
      "Board — League Leaders",
      `Finishing top of the table is exactly what this board asked for. Well done — the play-offs will decide the championship, but the League Leaders shield is yours.`
    );
  }

  if (trophies.includes("Super League Champions")) {
    next = appendBoardMail(
      next,
      `board-trophy-sl-champions-${year}`,
      "Board — Super League Champions",
      `Grand Final night delivered. The board salutes a Super League title — the highest honour in our competition.`
    );
  }

  if (
    trophies.includes("World Club Challenge") ||
    (career.worldClubChallenge?.history ?? []).some(
      (r) => r.seasonYear === career.seasonYear && r.userResult === "won"
    )
  ) {
    next = appendBoardMail(
      next,
      `board-trophy-wcc-${year}`,
      "Board — World Club Challenge",
      `Beating the NRL champions puts this club on the world stage. The board is immensely proud of the World Club Challenge triumph.`
    );
  }

  return next;
}

/**
 * One composite honour mail per season (highest tier only).
 * Avoids treble + clean-sweep + quadruple all stacking on the same night.
 */
function maybeCompositeHonourMail(career: ManagerCareer): ManagerCareer {
  const trophies = getManagerSeasonTrophyLabels(career);
  const majors = trophies.filter((t) =>
    [
      "League Leaders",
      "Super League Champions",
      "Challenge Cup",
      "World Club Challenge",
    ].includes(t)
  );
  const year = seasonTag(career);

  const available = [
    "League Leaders",
    "Super League Champions",
    "Challenge Cup",
  ];
  if (majors.includes("World Club Challenge")) {
    available.push("World Club Challenge");
  }
  const cleanSweep =
    available.length >= 3 && available.every((label) => majors.includes(label));

  if (cleanSweep) {
    return appendBoardMail(
      career,
      `board-honours-${year}`,
      "Board — clean sweep",
      `Every major prize available has been claimed. The board salutes a clean sweep — a season for the history books.`
    );
  }
  if (majors.length >= 4) {
    return appendBoardMail(
      career,
      `board-honours-${year}`,
      "Board — quadruple season",
      `Four major honours in one season. The board can scarcely believe it — this will be remembered as a golden year for the club.`
    );
  }
  if (majors.length >= 3) {
    return appendBoardMail(
      career,
      `board-honours-${year}`,
      "Board — treble winners",
      `A treble season. The board congratulates everyone at the club on an extraordinary campaign.`
    );
  }
  return career;
}

function maybeYouthUsageMail(
  career: ManagerCareer,
  calledUpReserveCount: number
): ManagerCareer {
  if (calledUpReserveCount < YOUTH_CALLUP_THRESHOLD) return career;
  return appendBoardMail(
    career,
    `board-youth-usage-${seasonTag(career)}`,
    "Board — youth pathway",
    `${calledUpReserveCount} academy / reserve players featured in the matchday squad. The board supports giving young talent a chance — keep developing the pathway.`
  );
}

function maybeRivalWinMail(
  career: ManagerCareer,
  fixture: ManagerFixtureRecord | null | undefined
): ManagerCareer {
  if (!fixture || fixture.result !== "W") return career;
  if (!areRivalClubs(career.club, fixture.opponent)) return career;
  const slug = fixture.opponent.toLowerCase().replace(/\s+/g, "-");
  return appendBoardMail(
    career,
    `board-rival-win-${slug}-${seasonTag(career)}`,
    "Board — derby victory",
    `A win over ${fixture.opponent} always matters to this board and the supporters. Well managed — local bragging rights secured.`
  );
}

function maybePlayoffsMail(career: ManagerCareer): ManagerCareer {
  if (!career.playoffs) return career;
  return appendBoardMail(
    career,
    `board-playoffs-${seasonTag(career)}`,
    "Board — play-off qualification",
    `The board is delighted the club has reached the play-offs. Everything is still to play for — finish the job.`
  );
}

function maybeAttendanceMail(
  career: ManagerCareer,
  fixture: ManagerFixtureRecord | null | undefined
): ManagerCareer {
  const attendance = fixture?.meta?.attendance?.attendance;
  if (attendance == null || !fixture?.isHome) return career;
  const capacity =
    career.attendanceData.stadiumCapacity ||
    career.attendanceData.baseAttendance ||
    0;
  if (capacity <= 0 || attendance < capacity * STRONG_GATE_CAPACITY_PCT) {
    return career;
  }
  // Once per season — repeating "strong gate" letters every home sell-out.
  return appendBoardMail(
    career,
    `board-attendance-${seasonTag(career)}`,
    "Board — strong gate",
    `A near-capacity crowd of ${attendance.toLocaleString()} turned out. The board notes the growing support — keep giving them nights like this.`
  );
}

function maybeConfidenceMail(
  career: ManagerCareer,
  previousBoardConfidence: number | undefined
): ManagerCareer {
  if (previousBoardConfidence == null) return career;
  const jump = career.boardConfidence - previousBoardConfidence;
  if (jump >= BOARD_CONFIDENCE_JUMP) {
    // Once per season — weekly boost letters were identical spam.
    return appendBoardMail(
      career,
      `board-confidence-boost-${seasonTag(career)}`,
      "Board — confidence rising",
      `Board confidence has climbed to ${career.boardConfidence}% (up ${jump} points). The directors are noticing the progress — maintain this trajectory.`
    );
  }
  if (jump <= -BOARD_CONFIDENCE_JUMP) {
    return appendBoardMail(
      career,
      `board-confidence-drop-${seasonTag(career)}`,
      "Board — performance warning",
      `Board confidence has fallen to ${career.boardConfidence}% (down ${Math.abs(jump)} points). Results must improve before the board reviews your position.`,
      {
        deadlineLabel: "Next board review",
        requiredAction: "Improve league results and matchday performances",
      }
    );
  }
  return career;
}

function maybeWagePressureMail(career: ManagerCareer): ManagerCareer {
  if (career.wageBill <= career.wageBudget) return career;
  const over = career.wageBill - career.wageBudget;
  // Once per season — weekly financial warnings repeated the same letter.
  return appendBoardMail(
    career,
    `board-wage-warning-${seasonTag(career)}`,
    "Board — financial warning",
    `The wage bill is ${over.toLocaleString()} over budget. The board expects corrective action through sales, releases, or wage discipline.`,
    {
      deadlineLabel: "Within 4 weeks",
      requiredAction: "Bring the wage bill back under budget",
    }
  );
}

export interface BoardMilestoneContext {
  /** Board confidence before this match / action. */
  previousBoardConfidence?: number;
  /** Reserves called up for the match (capture before clearReserveCallUps). */
  calledUpReserveCount?: number;
  /** Just completed fixture (after apply). */
  fixture?: ManagerFixtureRecord | null;
}

/**
 * Append unique Club Board inbox messages for career milestones.
 * Safe to call repeatedly — stable season-scoped IDs prevent duplicates.
 * At most one "routine" letter (confidence / wage / attendance / youth)
 * is added per call so a single result night cannot flood the inbox.
 */
export function maybeAddBoardMilestoneInbox(
  career: ManagerCareer,
  fixtureOrContext?: ManagerFixtureRecord | null | BoardMilestoneContext,
  maybeContext?: BoardMilestoneContext
): ManagerCareer {
  const context: BoardMilestoneContext =
    fixtureOrContext != null &&
    typeof fixtureOrContext === "object" &&
    "result" in fixtureOrContext
      ? { ...(maybeContext ?? {}), fixture: fixtureOrContext }
      : ((fixtureOrContext as BoardMilestoneContext | null | undefined) ??
        maybeContext ??
        {});

  const fixture = context.fixture ?? career.lastMatchFixture ?? null;
  let next = career;

  // Milestone letters (unique season events) — always eligible.
  next = maybeWinStreakMail(next);
  next = maybeTrophyMails(next);
  next = maybeCompositeHonourMail(next);
  next = maybeRivalWinMail(next, fixture);
  next = maybePlayoffsMail(next);

  // Routine letters — pick at most one new one this call.
  const routineBuilders: Array<(c: ManagerCareer) => ManagerCareer> = [
    (c) => maybeConfidenceMail(c, context.previousBoardConfidence),
    (c) => maybeWagePressureMail(c),
    (c) => maybeAttendanceMail(c, fixture),
    (c) => maybeYouthUsageMail(c, context.calledUpReserveCount ?? 0),
  ];

  for (const build of routineBuilders) {
    const candidate = build(next);
    if (candidate.inboxMessages.length > next.inboxMessages.length) {
      next = candidate;
      break;
    }
  }

  return next;
}

/** Facility upgrade path — call from purchaseFacilityUpgrade. */
export function addBoardFacilityUpgradeInbox(
  career: ManagerCareer,
  type: FacilityType,
  newLevel: number
): ManagerCareer {
  const label = FACILITY_BOARD_LABELS[type];
  return appendBoardMail(
    career,
    `board-facility-${type}-l${newLevel}-${seasonTag(career)}`,
    "Board — facility investment",
    `The board approves the upgrade of ${label} to ${newLevel}★. Sensible investment in the club's infrastructure.`
  );
}

/** WCC win — call from completeUserWorldClubChallenge. */
export function addBoardWorldClubChallengeWinInbox(
  career: ManagerCareer
): ManagerCareer {
  return appendBoardMail(
    career,
    `board-trophy-wcc-${seasonTag(career)}`,
    "Board — World Club Challenge",
    `Beating the NRL champions puts this club on the world stage. The board is immensely proud of the World Club Challenge triumph.`
  );
}

/** Big sale / major signing — call from transfer complete paths. */
export function addBoardTransferMilestoneInbox(
  career: ManagerCareer,
  kind: "sale" | "signing",
  playerName: string,
  fee: number,
  playerId?: string
): ManagerCareer {
  if (fee < BIG_TRANSFER_FEE) return career;
  const idBase = playerId ?? playerName.toLowerCase().replace(/\s+/g, "-");
  if (kind === "sale") {
    return appendBoardMail(
      career,
      `board-big-sale-${idBase}-${seasonTag(career)}`,
      "Board — major sale",
      `${playerName} has left for a fee of ${formatWage(fee)}. The board is satisfied with the return — reinvest wisely.`
    );
  }
  return appendBoardMail(
    career,
    `board-major-signing-${idBase}-${seasonTag(career)}`,
    "Board — major signing",
    `${playerName} arrives for ${formatWage(fee)}. The board backs this statement signing — make it count on the field.`
  );
}

/** Unread board mail for weekly / hub popup queue (decision-first ordering). */
export function getPendingBoardInboxPopup(
  career: ManagerCareer
): import("./types").InboxMessage | undefined {
  const acked = new Set(career.acknowledgedManagerEventIds ?? []);
  return career.inboxMessages.find(
    (m) =>
      (m.type === "board" || m.id.startsWith("board-")) &&
      !m.read &&
      !m.resolved &&
      !acked.has(m.id)
  );
}

/** Season objectives letter — once per season when intro is shown. */
export function ensureBoardObjectivesInbox(
  career: ManagerCareer
): ManagerCareer {
  const id = `board-objectives-s${career.seasonYear}`;
  if (career.inboxMessages.some((m) => m.id === id || m.eventId === id)) {
    return career;
  }
  return appendBoardMail(
    career,
    id,
    "Board — season objectives",
    `Primary target: ${career.boardExpectation}. The board starts at ${career.boardConfidence}% confidence. Hit your target at season's end to earn rewards and protect your job. Secondary aims: Challenge Cup progress, wage discipline, and squad development.`,
    {
      deadlineLabel: `End of ${career.seasonYear} season`,
      requiredAction: `Deliver: ${career.boardExpectation}`,
    }
  );
}

/** End-of-season board review — once when the campaign closes. */
export function ensureBoardEndOfSeasonReviewInbox(
  career: ManagerCareer
): ManagerCareer {
  if (!career.isSeasonComplete) return career;
  const id = `board-eos-review-s${career.seasonYear}`;
  return appendBoardMail(
    career,
    id,
    "Board — end-of-season review",
    `The board has reviewed the ${career.seasonYear} campaign. Primary target was ${career.boardExpectation}. Final confidence sits at ${career.boardConfidence}%. Check Season Rewards and prepare for the next season.`,
    {
      deadlineLabel: "Off-season",
      requiredAction: "Review season rewards and plan the next campaign",
    }
  );
}
