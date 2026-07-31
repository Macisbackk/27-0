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

function appendBoardMail(
  career: ManagerCareer,
  id: string,
  title: string,
  body: string
): ManagerCareer {
  if (career.inboxMessages.some((m) => m.id === id)) return career;
  return pushInboxMessage(career, {
    id,
    type: "board",
    title,
    body,
    week: career.gameWeek,
    season: career.seasonYear,
    gameWeek: career.gameWeek,
    createdAt: new Date().toISOString(),
    read: false,
    resolved: true,
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

function maybeTrebleMails(career: ManagerCareer): ManagerCareer {
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
  let next = career;

  if (majors.length >= 4) {
    next = appendBoardMail(
      next,
      `board-quad-${year}`,
      "Board — quadruple season",
      `Four major honours in one season. The board can scarcely believe it — this will be remembered as a golden year for the club.`
    );
  } else if (majors.length >= 3) {
    next = appendBoardMail(
      next,
      `board-treble-${year}`,
      "Board — treble winners",
      `A treble season. The board congratulates everyone at the club on an extraordinary campaign.`
    );
  }

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
    next = appendBoardMail(
      next,
      `board-clean-sweep-${year}`,
      "Board — clean sweep",
      `Every major prize available has been claimed. The board salutes a clean sweep — a season for the history books.`
    );
  }

  return next;
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
  return appendBoardMail(
    career,
    `board-attendance-${seasonTag(career)}-w${career.gameWeek}`,
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
  if (jump < BOARD_CONFIDENCE_JUMP) return career;
  return appendBoardMail(
    career,
    `board-confidence-boost-${seasonTag(career)}-w${career.gameWeek}`,
    "Board — confidence rising",
    `Board confidence has climbed to ${career.boardConfidence}% (up ${jump} points). The directors are noticing the progress — maintain this trajectory.`
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
 * Safe to call repeatedly — message IDs prevent duplicates.
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

  next = maybeWinStreakMail(next);
  next = maybeTrophyMails(next);
  next = maybeTrebleMails(next);
  next = maybeYouthUsageMail(next, context.calledUpReserveCount ?? 0);
  next = maybeRivalWinMail(next, fixture);
  next = maybePlayoffsMail(next);
  next = maybeAttendanceMail(next, fixture);
  next = maybeConfidenceMail(next, context.previousBoardConfidence);

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
