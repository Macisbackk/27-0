/**
 * Progress Week world-story layer — constrained events that persist in the inbox
 * and on career.worldStory. Reuses inbox + weekly popup queue; no parallel event bus.
 */
import seedrandom from "seedrandom";
import { CURRENT_PLAYABLE_CLUBS, rivalTransferClubs } from "../clubs/super-league-display";
import { getPlayerById } from "../players";
import { areRivalClubs } from "./managerRivals";
import { getManagerPlayer, getManagerPlayerAge } from "./managerPlayers";
import { getManagerModePlayerRating } from "./managerSquadRatings";
import { isPlayerAwayOnLoan, isPlayerLoanedIn } from "./managerLoans";
import { pushInboxMessage, normalizeInboxMessage } from "./managerInbox";
import { getLeagueClubRosterIds } from "./managerLeagueRosters";
import { getManagerSeasonTrophyLabels } from "./managerSeasonTrophies";
import { countLeagueFixturesPlayed } from "./managerChallengeCup";
import {
  getManagerLeagueTable,
  getUserLeagueTablePosition,
} from "./managerFixtures";
import {
  getUserCompetitionId,
  getUserSeasonGames,
} from "./leagueMembership";
import {
  getMillionPoundGameTablePosition,
  MANAGER_LEAGUES,
} from "./managerLeagues";
import {
  isMagicWeekendFixture,
  MAGIC_WEEKEND_VENUE,
} from "./managerMagicWeekend";
import type {
  ClubMoment,
  InboxMessage,
  ManagerCareer,
  ManagerWorldStory,
  WorldStoryChain,
} from "./types";

const MAX_MOMENTS = 48;
const MAX_CHAINS = 12;
const STORY_ID_PREFIX = "story-";

export function emptyWorldStory(): ManagerWorldStory {
  return {
    chains: [],
    shownMilestoneIds: [],
    moments: [],
    departedPlayers: {},
    developingRivalries: [],
  };
}

export function getWorldStory(career: ManagerCareer): ManagerWorldStory {
  return {
    ...emptyWorldStory(),
    ...(career.worldStory ?? {}),
    chains: career.worldStory?.chains ?? [],
    shownMilestoneIds: career.worldStory?.shownMilestoneIds ?? [],
    moments: career.worldStory?.moments ?? [],
    departedPlayers: career.worldStory?.departedPlayers ?? {},
    developingRivalries: career.worldStory?.developingRivalries ?? [],
  };
}

function withStory(
  career: ManagerCareer,
  story: ManagerWorldStory
): ManagerCareer {
  return {
    ...career,
    worldStory: {
      ...story,
      chains: story.chains.slice(0, MAX_CHAINS),
      moments: story.moments.slice(0, MAX_MOMENTS),
    },
    updatedAt: new Date().toISOString(),
  };
}

function appendMoment(
  story: ManagerWorldStory,
  moment: ClubMoment
): ManagerWorldStory {
  if (story.moments.some((m) => m.id === moment.id)) return story;
  return {
    ...story,
    moments: [moment, ...story.moments].slice(0, MAX_MOMENTS),
  };
}

function pushStoryInbox(
  career: ManagerCareer,
  id: string,
  title: string,
  body: string,
  extras?: Partial<InboxMessage>
): ManagerCareer {
  if (career.inboxMessages.some((m) => m.id === id || m.eventId === id)) {
    return career;
  }
  return pushInboxMessage(
    career,
    normalizeInboxMessage(
      {
        id,
        type: "news",
        title,
        body,
        read: false,
        resolved: false,
        sender: "Club Update",
        eventId: id,
        ...extras,
      },
      career
    )
  );
}

export function isStoryInboxMessage(message: InboxMessage): boolean {
  return (
    message.id.startsWith(STORY_ID_PREFIX) ||
    Boolean(message.eventId?.startsWith(STORY_ID_PREFIX))
  );
}

/** Unread story moments for weekly popup (after board, before contracts). */
export function getPendingStoryInboxPopup(
  career: ManagerCareer
): InboxMessage | undefined {
  const acked = new Set(career.acknowledgedManagerEventIds ?? []);
  return career.inboxMessages.find(
    (m) =>
      isStoryInboxMessage(m) &&
      !m.read &&
      !m.resolved &&
      !acked.has(m.id)
  );
}

function recordDepartedPlayer(
  career: ManagerCareer,
  playerId: string
): ManagerCareer {
  const story = getWorldStory(career);
  if (story.departedPlayers[playerId]) return career;
  const player = getManagerPlayer(career, playerId) ?? getPlayerById(playerId);
  if (!player) return career;
  const totals = career.clubCareerTotals?.[playerId];
  const apps = totals?.appearances ?? 0;
  if (apps < 5) return career;
  return withStory(career, {
    ...story,
    departedPlayers: {
      ...story.departedPlayers,
      [playerId]: {
        name: player.name,
        appearances: apps,
        tries: totals?.tries ?? 0,
        seasons: totals?.seasons ?? 1,
        leftSeasonYear: career.seasonYear,
        leftWeek: career.gameWeek,
      },
    },
  });
}

/** Call when a first-team player leaves the user club. */
export function rememberPlayerDeparture(
  career: ManagerCareer,
  playerId: string
): ManagerCareer {
  return recordDepartedPlayer(career, playerId);
}

function upsertRivalry(
  story: ManagerWorldStory,
  opponent: string,
  result: "W" | "L" | "D"
): ManagerWorldStory {
  const list = [...story.developingRivalries];
  const idx = list.findIndex((r) => r.club === opponent);
  const row =
    idx >= 0
      ? { ...list[idx]! }
      : { club: opponent, meetings: 0, wins: 0, losses: 0, draws: 0 };
  row.meetings += 1;
  if (result === "W") row.wins += 1;
  else if (result === "L") row.losses += 1;
  else row.draws += 1;
  if (idx >= 0) list[idx] = row;
  else list.push(row);
  list.sort((a, b) => b.meetings - a.meetings);
  return { ...story, developingRivalries: list.slice(0, 8) };
}

function maybeEmitRivalryMoment(
  career: ManagerCareer,
  story: ManagerWorldStory,
  opponent: string
): { career: ManagerCareer; story: ManagerWorldStory; emitted: boolean } {
  const row = story.developingRivalries.find((r) => r.club === opponent);
  if (!row || row.meetings < 4) return { career, story, emitted: false };
  const id = `story-rivalry-${opponent.replace(/\s+/g, "-").toLowerCase()}-m${row.meetings}`;
  if (story.shownMilestoneIds.includes(id)) return { career, story, emitted: false };
  const named = areRivalClubs(career.club, opponent);
  const title = named ? "Derby rivalry" : "Rivalry developing";
  const body = `You have now faced ${opponent} ${row.meetings} times (${row.wins}W ${row.draws}D ${row.losses}L).`;
  let next = pushStoryInbox(career, id, title, body);
  let nextStory = appendMoment(story, {
    id,
    week: career.gameWeek,
    seasonYear: career.seasonYear,
    kind: "rivalry",
    title,
    body,
  });
  nextStory = {
    ...nextStory,
    shownMilestoneIds: [...nextStory.shownMilestoneIds, id],
  };
  return { career: next, story: nextStory, emitted: true };
}

function maybePlayerMilestones(
  career: ManagerCareer,
  story: ManagerWorldStory,
  rng: () => number
): { career: ManagerCareer; story: ManagerWorldStory; emitted: boolean } {
  const thresholds = [10, 25, 50, 100] as const;
  const candidates: {
    id: string;
    title: string;
    body: string;
    playerId: string;
    weight: number;
  }[] = [];

  for (const ps of career.squad) {
    const playerId = ps.playerId;
    const player = getManagerPlayer(career, playerId);
    if (!player) continue;
    const totals = career.clubCareerTotals?.[playerId];
    const clubApps = totals?.appearances ?? 0;
    const season = career.playerSeasonStats[playerId];

    for (const n of thresholds) {
      const mid = `story-apps-${playerId}-${n}`;
      if (clubApps >= n && !story.shownMilestoneIds.includes(mid)) {
        candidates.push({
          id: mid,
          title: n >= 100 ? "Club landmark" : "Appearance milestone",
          body: `${player.name} has made ${n} appearances for ${career.club}.`,
          playerId,
          weight: n >= 50 ? 3 : 1,
        });
      }
    }

    // Significant try milestones only (15+). Smaller totals stay in stats.
    if (season && season.tries >= 15 && season.appearances >= 5) {
      const mid = `story-multi-try-run-${playerId}-s${career.seasonYear}-t${season.tries}`;
      if (
        (season.tries === 15 || season.tries % 10 === 0) &&
        !story.shownMilestoneIds.includes(mid)
      ) {
        candidates.push({
          id: mid,
          title: "Scoring run",
          body: `${player.name} has ${season.tries} tries this season.`,
          playerId,
          weight: 3,
        });
      }
    }
  }

  // Reserve forced into contention
  for (const r of career.reserves) {
    if (r.rating < 78 || r.form < 62) continue;
    const mid = `story-reserve-push-${r.id}-s${career.seasonYear}`;
    if (story.shownMilestoneIds.includes(mid)) continue;
    if (rng() > 0.22) continue;
    candidates.push({
      id: mid,
      title: "Reserve pushing",
      body: `${r.name} is forcing the issue from the reserves after a strong run of form.`,
      playerId: r.id,
      weight: 2,
    });
  }

  if (candidates.length === 0) {
    return { career, story, emitted: false };
  }

  // Prefer rarer / heavier milestones; still only emit one.
  candidates.sort((a, b) => b.weight - a.weight);
  const pick =
    candidates[Math.min(candidates.length - 1, Math.floor(rng() * Math.min(3, candidates.length)))]!;

  let next = pushStoryInbox(career, pick.id, pick.title, pick.body, {
    playerId: pick.playerId,
    playerName:
      getManagerPlayer(career, pick.playerId)?.name ??
      getPlayerById(pick.playerId)?.name,
  });
  let nextStory = appendMoment(story, {
    id: pick.id,
    week: career.gameWeek,
    seasonYear: career.seasonYear,
    kind: "milestone",
    title: pick.title,
    body: pick.body,
    playerId: pick.playerId,
  });
  nextStory = {
    ...nextStory,
    shownMilestoneIds: [...nextStory.shownMilestoneIds, pick.id],
  };
  return { career: next, story: nextStory, emitted: true };
}

function maybeBreakthrough(
  career: ManagerCareer,
  story: ManagerWorldStory,
  rng: () => number
): { career: ManagerCareer; story: ManagerWorldStory; emitted: boolean } {
  if (rng() > 0.28) return { career, story, emitted: false };

  const picks: { playerId: string; name: string; body: string; id: string }[] = [];

  for (const ps of career.squad) {
    const age = getManagerPlayerAge(career, ps.playerId) ?? 25;
    if (age > 23) continue;
    const season = career.playerSeasonStats[ps.playerId];
    if (!season || season.appearances < 5) continue;
    if ((season.averageRating ?? 0) < 7.2 && ps.form < 68) continue;
    const player = getManagerPlayer(career, ps.playerId);
    if (!player) continue;
    const rating = getManagerModePlayerRating(
      ps.playerId,
      player.name,
      player.peakRating
    );
    const pot = career.playerDevelopment?.[ps.playerId]?.potential ?? rating + 4;
    if (pot - rating < 4 && season.appearances < 8) continue;
    const id = `story-breakthrough-${ps.playerId}-s${career.seasonYear}`;
    if (story.shownMilestoneIds.includes(id)) continue;
    picks.push({
      playerId: ps.playerId,
      name: player.name,
      id,
      body:
        age <= 20
          ? `${player.name} (${age}) has forced their way into the first team after a strong run of performances.`
          : `${player.name} is enjoying a breakthrough season and is becoming one of the club's key players.`,
    });
  }

  // Season-end style jumps mid-season when promoted reserve thrives
  for (const ps of career.squad) {
    const promotedYear =
      career.playerDevelopment?.[ps.playerId]?.promotedSeasonYear;
    if (promotedYear !== career.seasonYear) continue;
    const season = career.playerSeasonStats[ps.playerId];
    if (!season || season.appearances < 4) continue;
    if ((season.averageRating ?? 0) < 7.0 && ps.form < 65) continue;
    const player = getManagerPlayer(career, ps.playerId);
    if (!player) continue;
    const id = `story-promoted-breakthrough-${ps.playerId}-s${career.seasonYear}`;
    if (story.shownMilestoneIds.includes(id)) continue;
    picks.push({
      playerId: ps.playerId,
      name: player.name,
      id,
      body: `${player.name} has settled quickly after promotion from the reserves.`,
    });
  }

  if (picks.length === 0) return { career, story, emitted: false };
  const pick = picks[Math.floor(rng() * picks.length)]!;
  const title = "Breakthrough";
  let next = pushStoryInbox(career, pick.id, title, pick.body, {
    playerId: pick.playerId,
    playerName: pick.name,
  });
  let nextStory = appendMoment(story, {
    id: pick.id,
    week: career.gameWeek,
    seasonYear: career.seasonYear,
    kind: "breakthrough",
    title,
    body: pick.body,
    playerId: pick.playerId,
  });
  nextStory = {
    ...nextStory,
    shownMilestoneIds: [...nextStory.shownMilestoneIds, pick.id],
  };
  return { career: next, story: nextStory, emitted: true };
}

function fringeAppearances(career: ManagerCareer, playerId: string): number {
  return career.playerSeasonStats[playerId]?.appearances ?? 0;
}

function maybeTransferEnquiry(
  career: ManagerCareer,
  story: ManagerWorldStory,
  rng: () => number
): { career: ManagerCareer; story: ManagerWorldStory; emitted: boolean } {
  if (story.chains.some((c) => c.kind === "transfer_interest" && c.stage < 3)) {
    return { career, story, emitted: false };
  }
  // Roughly one enquiry every ~6–8 weeks when conditions align
  if (rng() > 0.14) return { career, story, emitted: false };

  const buyers = rivalTransferClubs(career.club).filter(
    (c) => c !== career.club
  );
  if (buyers.length === 0) return { career, story, emitted: false };

  const candidates = career.squad.filter((ps) => {
    if (isPlayerAwayOnLoan(career, ps.playerId) || isPlayerLoanedIn(career, ps.playerId)) {
      return false;
    }
    const st = career.playerTransferStatus[ps.playerId];
    if (st?.listed || st?.transferRequested) return false;
    if (story.chains.some((c) => c.playerId === ps.playerId)) return false;
    const apps = fringeAppearances(career, ps.playerId);
    const age = getManagerPlayerAge(career, ps.playerId) ?? 25;
    const player = getManagerPlayer(career, ps.playerId);
    if (!player) return false;
    const rating = getManagerModePlayerRating(
      ps.playerId,
      player.name,
      player.peakRating
    );
    // Fringe or unhappy high-profile — not random
    const fringe = apps <= 4 && career.gameWeek >= 6;
    const quality = rating >= 74 && age <= 29;
    return fringe && quality;
  });

  if (candidates.length === 0) return { career, story, emitted: false };
  const pick = candidates[Math.floor(rng() * candidates.length)]!;
  const player = getManagerPlayer(career, pick.playerId)!;
  const club = buyers[Math.floor(rng() * buyers.length)]!;
  const chainId = `transfer-interest-${pick.playerId}-${career.seasonYear}`;
  const msgId = `${STORY_ID_PREFIX}enquiry-${pick.playerId}-w${career.gameWeek}`;
  const title = "Transfer enquiry";
  const body = `${club} have made an enquiry about ${player.name}. No formal offer has been lodged.`;

  let next = pushStoryInbox(career, msgId, title, body, {
    playerId: pick.playerId,
    playerName: player.name,
    offerClub: club,
  });
  const chain: WorldStoryChain = {
    id: chainId,
    kind: "transfer_interest",
    playerId: pick.playerId,
    clubId: club,
    stage: 1,
    lastWeek: career.gameWeek,
    seasonYear: career.seasonYear,
  };
  let nextStory = {
    ...story,
    chains: [chain, ...story.chains].slice(0, MAX_CHAINS),
  };
  nextStory = appendMoment(nextStory, {
    id: msgId,
    week: career.gameWeek,
    seasonYear: career.seasonYear,
    kind: "transfer_enquiry",
    title,
    body,
    playerId: pick.playerId,
  });
  nextStory = {
    ...nextStory,
    shownMilestoneIds: [...nextStory.shownMilestoneIds, msgId],
  };
  return { career: next, story: nextStory, emitted: true };
}

function advanceTransferChains(
  career: ManagerCareer,
  story: ManagerWorldStory,
  rng: () => number
): { career: ManagerCareer; story: ManagerWorldStory; emitted: boolean } {
  let next = career;
  let nextStory = story;
  let emitted = false;

  const chains = nextStory.chains.map((c) => ({ ...c }));
  for (let i = 0; i < chains.length; i++) {
    const chain = chains[i]!;
    if (chain.kind !== "transfer_interest" || !chain.playerId || !chain.clubId) {
      continue;
    }
    if (career.gameWeek - chain.lastWeek < 2) continue;
    const stillHere = career.squad.some((p) => p.playerId === chain.playerId);
    if (!stillHere) {
      chains[i] = { ...chain, stage: 9, lastWeek: career.gameWeek };
      continue;
    }
    const status = career.playerTransferStatus[chain.playerId];
    const player =
      getManagerPlayer(career, chain.playerId) ?? getPlayerById(chain.playerId);
    if (!player) continue;

    // Stage 1 → 2: transfer request if still fringe
    if (chain.stage === 1 && !status?.transferRequested && !status?.listed) {
      const apps = fringeAppearances(career, chain.playerId);
      if (apps <= 5 && rng() < 0.45) {
        const msgId = `${STORY_ID_PREFIX}request-${chain.playerId}-w${career.gameWeek}`;
        const title = "Transfer request";
        const body = `${player.name} has requested a transfer after failing to secure regular first-team football. ${chain.clubId} remain interested.`;
        next = {
          ...next,
          playerTransferStatus: {
            ...next.playerTransferStatus,
            [chain.playerId]: {
              listed: false,
              askingPrice: 0,
              listedAtGameWeek: next.gameWeek,
              transferRequested: true,
            },
          },
        };
        next = pushStoryInbox(next, msgId, title, body, {
          playerId: chain.playerId,
          playerName: player.name,
          offerClub: chain.clubId,
        });
        nextStory = appendMoment(nextStory, {
          id: msgId,
          week: career.gameWeek,
          seasonYear: career.seasonYear,
          kind: "transfer_request",
          title,
          body,
          playerId: chain.playerId,
        });
        chains[i] = {
          ...chain,
          stage: 2,
          lastWeek: career.gameWeek,
        };
        emitted = true;
        break;
      }
    }

    // Stage 2 → 3: formal offer already handled by transfer market; note completion in story
    if (chain.stage >= 2) {
      const offer = career.inboxMessages.find(
        (m) =>
          !m.resolved &&
          m.playerId === chain.playerId &&
          (m.type === "transfer" || m.type === "transfer_offer_in") &&
          m.offerClub === chain.clubId
      );
      if (offer && chain.stage < 3) {
        chains[i] = { ...chain, stage: 3, lastWeek: career.gameWeek };
      }
    }
  }

  nextStory = { ...nextStory, chains };
  return { career: next, story: nextStory, emitted };
}

function maybeFormerPlayerReturn(
  career: ManagerCareer,
  story: ManagerWorldStory
): { career: ManagerCareer; story: ManagerWorldStory; emitted: boolean } {
  const nextFix =
    career.schedule.find((f) => f.round > career.currentRound) ??
    career.schedule[career.currentFixtureIndex] ??
    null;
  if (!nextFix) return { career, story, emitted: false };
  const opponent = nextFix.opponent;
  const roster = getLeagueClubRosterIds(career, opponent);
  for (const playerId of roster) {
    const departed = story.departedPlayers[playerId];
    if (!departed) continue;
    const id = `story-former-${playerId}-vs-${opponent.replace(/\s+/g, "-").toLowerCase()}-s${career.seasonYear}`;
    if (story.shownMilestoneIds.includes(id)) continue;
    const title = "Former player";
    const body = `${departed.name} returns with ${opponent} (${departed.appearances} apps, ${departed.tries} tries in ${departed.seasons} season${departed.seasons === 1 ? "" : "s"} at ${career.club}).`;
    let next = pushStoryInbox(career, id, title, body, {
      playerId,
      playerName: departed.name,
      offerClub: opponent,
    });
    let nextStory = appendMoment(story, {
      id,
      week: career.gameWeek,
      seasonYear: career.seasonYear,
      kind: "former_player",
      title,
      body,
      playerId,
    });
    nextStory = {
      ...nextStory,
      shownMilestoneIds: [...nextStory.shownMilestoneIds, id],
    };
    return { career: next, story: nextStory, emitted: true };
  }
  return { career, story, emitted: false };
}

function maybeCupGiantKilling(
  career: ManagerCareer,
  story: ManagerWorldStory
): { career: ManagerCareer; story: ManagerWorldStory; emitted: boolean } {
  const last = career.lastMatchFixture;
  if (!last || last.competition !== "challenge_cup") {
    return { career, story, emitted: false };
  }
  if (last.result !== "W") return { career, story, emitted: false };
  const userInSl = (CURRENT_PLAYABLE_CLUBS as readonly string[]).includes(
    career.club
  );
  const oppIsSl = (CURRENT_PLAYABLE_CLUBS as readonly string[]).includes(
    last.opponent
  );
  const margin = last.pointsFor - last.pointsAgainst;
  const giant =
    (!userInSl && oppIsSl) || (userInSl && margin >= 24);
  if (!giant) return { career, story, emitted: false };
  const id = `story-cup-classic-${last.fixtureId ?? last.round}-s${career.seasonYear}`;
  if (story.shownMilestoneIds.includes(id)) {
    return { career, story, emitted: false };
  }
  const title = !userInSl && oppIsSl ? "Giant killing" : "Cup classic";
  const body = `${career.club} defeated ${last.opponent} ${last.pointsFor}–${last.pointsAgainst} in the Challenge Cup.`;
  let next = pushStoryInbox(career, id, title, body);
  let nextStory = appendMoment(story, {
    id,
    week: career.gameWeek,
    seasonYear: career.seasonYear,
    kind: "cup",
    title,
    body,
  });
  nextStory = {
    ...nextStory,
    shownMilestoneIds: [...nextStory.shownMilestoneIds, id],
  };
  return { career: next, story: nextStory, emitted: true };
}

function maybeCupRoundProgress(
  career: ManagerCareer,
  story: ManagerWorldStory
): { career: ManagerCareer; story: ManagerWorldStory; emitted: boolean } {
  const last = career.lastMatchFixture;
  if (!last || last.competition !== "challenge_cup") {
    return { career, story, emitted: false };
  }
  if (last.result !== "W") return { career, story, emitted: false };
  const round = last.meta?.cupRound ?? "";
  let title: string | null = null;
  let body: string | null = null;
  if (round === "semi_final" || /semi/i.test(round)) {
    title = "Cup Final Reached";
    body = `One more win stands between you and the Challenge Cup after beating ${last.opponent}.`;
  } else if (round === "quarter_final" || /quarter/i.test(round)) {
    title = "Cup Semi-Final";
    body = `${career.club} are into the Challenge Cup semi-finals after beating ${last.opponent}.`;
  } else if (round === "final" || /^final$/i.test(round)) {
    return { career, story, emitted: false };
  }
  if (!title || !body) return { career, story, emitted: false };
  const id = `story-cup-round-${round}-s${career.seasonYear}`;
  if (story.shownMilestoneIds.includes(id)) {
    return { career, story, emitted: false };
  }
  let next = pushStoryInbox(career, id, title, body);
  let nextStory = appendMoment(story, {
    id,
    week: career.gameWeek,
    seasonYear: career.seasonYear,
    kind: "cup",
    title,
    body,
  });
  nextStory = {
    ...nextStory,
    shownMilestoneIds: [...nextStory.shownMilestoneIds, id],
  };
  return { career: next, story: nextStory, emitted: true };
}

function nextUpcomingScheduleFixture(career: ManagerCareer) {
  return (
    career.schedule.find((f) => f.round > career.currentRound) ??
    career.schedule[career.currentFixtureIndex] ??
    null
  );
}

function lastMatchWasCupOrRival(career: ManagerCareer): boolean {
  const last = career.lastMatchFixture;
  if (!last) return false;
  if (last.competition === "challenge_cup") return true;
  return areRivalClubs(career.club, last.opponent);
}

function maybeBigMatchPreview(
  career: ManagerCareer,
  story: ManagerWorldStory
): { career: ManagerCareer; story: ManagerWorldStory; emitted: boolean } {
  if (lastMatchWasCupOrRival(career)) {
    return { career, story, emitted: false };
  }

  const nextFix = nextUpcomingScheduleFixture(career);
  if (!nextFix || nextFix.competition === "friendly") {
    return { career, story, emitted: false };
  }

  const fixtureKey =
    nextFix.id ??
    `${nextFix.competition}-${nextFix.round}-${nextFix.opponent}`;
  const id = `story-big-match-${fixtureKey}-s${career.seasonYear}`;
  if (story.shownMilestoneIds.includes(id)) {
    return { career, story, emitted: false };
  }

  let title: string | null = null;
  let body: string | null = null;

  if (nextFix.competition === "million_pound_game") {
    title = "Million Pound Game";
    body = `Everything is on the line against ${nextFix.opponent} — the winner stays in Super League.`;
  } else if (
    nextFix.competition === "challenge_cup" &&
    (nextFix.cupRound === "final" || /^final$/i.test(nextFix.cupRound ?? ""))
  ) {
    title = "Cup Final";
    body = `The Challenge Cup final against ${nextFix.opponent} is next.`;
  } else if (isMagicWeekendFixture(nextFix)) {
    title = "Magic Weekend";
    body = `${career.club} head to Magic Weekend at ${MAGIC_WEEKEND_VENUE} to face ${nextFix.opponent}.`;
  } else if (nextFix.competition === "league") {
    const position = getUserLeagueTablePosition(career);
    const seasonGames = getUserSeasonGames(career);
    const remaining = seasonGames - countLeagueFixturesPlayed(career);
    if (
      position >= 1 &&
      position <= 2 &&
      remaining > 0 &&
      remaining <= 4
    ) {
      title = "Title Race";
      body =
        position === 1
          ? `${career.club} lead the table with ${remaining} league game${remaining === 1 ? "" : "s"} left.`
          : `${career.club} are ${position === 2 ? "second" : `${position}th`} with ${remaining} league game${remaining === 1 ? "" : "s"} left in the title race.`;
    }
  }

  if (!title && areRivalClubs(career.club, nextFix.opponent)) {
    title = "Big Match";
    body = `You're facing rivals ${nextFix.opponent} this week.`;
  }

  if (!title || !body) return { career, story, emitted: false };

  let next = pushStoryInbox(career, id, title, body, {
    offerClub: nextFix.opponent,
  });
  let nextStory = appendMoment(story, {
    id,
    week: career.gameWeek,
    seasonYear: career.seasonYear,
    kind: "fixture",
    title,
    body,
  });
  nextStory = {
    ...nextStory,
    shownMilestoneIds: [...nextStory.shownMilestoneIds, id],
  };
  return { career: next, story: nextStory, emitted: true };
}

function maybeLeagueTableMoment(
  career: ManagerCareer,
  story: ManagerWorldStory
): { career: ManagerCareer; story: ManagerWorldStory; emitted: boolean } {
  const position = getUserLeagueTablePosition(career);
  if (position <= 0) return { career, story, emitted: false };

  const competitionId = getUserCompetitionId(career);
  const rules = MANAGER_LEAGUES[competitionId].boardRules;
  const table = getManagerLeagueTable(career);
  const seasonGames = getUserSeasonGames(career);
  const remaining = Math.max(0, seasonGames - countLeagueFixturesPlayed(career));
  const maxPtsPerGame = 2;
  const userRow = table.find((r) => r.team === career.club);

  type Beat = { id: string; title: string; body: string; weight: number };
  const beats: Beat[] = [];

  if (position === 1) {
    beats.push({
      id: `story-league-leaders-s${career.seasonYear}`,
      title: "League leaders",
      body: `${career.club} sit top of the table.`,
      weight: 5,
    });
  }

  if (career.gameWeek > 6 && position <= rules.playoffsMaxPosition) {
    beats.push({
      id: `story-playoff-places-s${career.seasonYear}`,
      title: "Playoff places",
      body: `${career.club} are inside the playoff places.`,
      weight: 4,
    });
  }

  if (
    userRow &&
    position <= rules.playoffsMaxPosition &&
    remaining > 0 &&
    rules.playoffsMaxPosition < table.length
  ) {
    const outsider = table.find(
      (r) => r.position === rules.playoffsMaxPosition + 1
    );
    if (
      outsider &&
      userRow.leaguePoints > outsider.leaguePoints + remaining * maxPtsPerGame
    ) {
      beats.push({
        id: `story-playoff-qualified-s${career.seasonYear}`,
        title: "Playoff Qualification Secured",
        body: `${career.club} cannot fall outside the playoff places.`,
        weight: 6,
      });
    }
  }

  const mpgPos = getMillionPoundGameTablePosition(competitionId, table.length);
  if (userRow && position < mpgPos && remaining > 0) {
    const dangerRow = table.find((r) => r.position === mpgPos);
    if (
      dangerRow &&
      userRow.leaguePoints > dangerRow.leaguePoints + remaining * maxPtsPerGame
    ) {
      beats.push({
        id: `story-survival-secured-s${career.seasonYear}`,
        title: "Survival Secured",
        body: `${career.club} are mathematically safe from the relegation zone.`,
        weight: 5,
      });
    }
  }

  const fresh = beats
    .filter((b) => !story.shownMilestoneIds.includes(b.id))
    .sort((a, b) => b.weight - a.weight);
  if (fresh.length === 0) return { career, story, emitted: false };

  const pick = fresh[0]!;
  let next = pushStoryInbox(career, pick.id, pick.title, pick.body);
  let nextStory = appendMoment(story, {
    id: pick.id,
    week: career.gameWeek,
    seasonYear: career.seasonYear,
    kind: "league",
    title: pick.title,
    body: pick.body,
  });
  nextStory = {
    ...nextStory,
    shownMilestoneIds: [...nextStory.shownMilestoneIds, pick.id],
  };
  return { career: next, story: nextStory, emitted: true };
}

function getCurrentWinStreak(career: ManagerCareer): number {
  const played = career.fixtures.filter(
    (f) => (f.competition ?? "league") !== "friendly"
  );
  let streak = 0;
  for (let i = played.length - 1; i >= 0; i -= 1) {
    if (played[i]!.result === "W") streak += 1;
    else break;
  }
  return streak;
}

function maybeWinStreak(
  career: ManagerCareer,
  story: ManagerWorldStory
): { career: ManagerCareer; story: ManagerWorldStory; emitted: boolean } {
  const streak = getCurrentWinStreak(career);
  const milestones = [10, 8, 5] as const;
  const hit = milestones.find(
    (m) =>
      streak >= m &&
      !story.shownMilestoneIds.includes(`story-win-streak-${m}`)
  );
  if (!hit) return { career, story, emitted: false };

  const id = `story-win-streak-${hit}`;
  const title = "Winning run";
  const body = `${career.club} are on a ${streak}-match winning streak.`;
  let next = pushStoryInbox(career, id, title, body);
  let nextStory = appendMoment(story, {
    id,
    week: career.gameWeek,
    seasonYear: career.seasonYear,
    kind: "streak",
    title,
    body,
  });
  nextStory = {
    ...nextStory,
    shownMilestoneIds: [...nextStory.shownMilestoneIds, id],
  };
  return { career: next, story: nextStory, emitted: true };
}

function getCareerTotalWins(career: ManagerCareer): number {
  let total = career.wins;
  for (const s of career.seasonHistory) {
    total += s.wins;
  }
  return total;
}

function maybeManagerCareerWins(
  career: ManagerCareer,
  story: ManagerWorldStory
): { career: ManagerCareer; story: ManagerWorldStory; emitted: boolean } {
  const total = getCareerTotalWins(career);
  const thresholds = [200, 100, 50] as const;
  const hit = thresholds.find(
    (t) =>
      total >= t &&
      !story.shownMilestoneIds.includes(`story-career-wins-${t}`)
  );
  if (!hit) return { career, story, emitted: false };

  const id = `story-career-wins-${hit}`;
  const title = "Career milestone";
  const body = `You have recorded ${hit} wins as a manager.`;
  let next = pushStoryInbox(career, id, title, body);
  let nextStory = appendMoment(story, {
    id,
    week: career.gameWeek,
    seasonYear: career.seasonYear,
    kind: "career",
    title,
    body,
  });
  nextStory = {
    ...nextStory,
    shownMilestoneIds: [...nextStory.shownMilestoneIds, id],
  };
  return { career: next, story: nextStory, emitted: true };
}


function syncRivalryFromLastMatch(
  career: ManagerCareer,
  story: ManagerWorldStory
): ManagerWorldStory {
  const last = career.lastMatchFixture;
  if (!last || last.competition === "friendly") return story;
  if (last.result !== "W" && last.result !== "L" && last.result !== "D") {
    return story;
  }
  return upsertRivalry(story, last.opponent, last.result);
}

/**
 * Run once per Progress Week after transfer/inbox processing.
 * Emits at most one new popup-worthy story in typical weeks (chains may add a second step rarely).
 */
export function processWorldStoryForWeek(career: ManagerCareer): ManagerCareer {
  if (career.gameWeek <= 0) return career;
  const rng = seedrandom(
    `${career.seed}-world-story-w${career.gameWeek}-s${career.seasonYear}`
  );

  let next = career;
  let story = getWorldStory(next);
  story = syncRivalryFromLastMatch(next, story);

  // Always check chain advances (may emit)
  {
    const r = advanceTransferChains(next, story, rng);
    next = r.career;
    story = r.story;
    if (r.emitted) {
      return withStory(next, story);
    }
  }

  // Priority narrative beats — stop after first emit so weeks stay quiet
  const former = maybeFormerPlayerReturn(next, story);
  next = former.career;
  story = former.story;
  if (former.emitted) return withStory(next, story);

  const cupClassic = maybeCupGiantKilling(next, story);
  next = cupClassic.career;
  story = cupClassic.story;
  if (cupClassic.emitted) return withStory(next, story);

  const cupRound = maybeCupRoundProgress(next, story);
  next = cupRound.career;
  story = cupRound.story;
  if (cupRound.emitted) return withStory(next, story);

  const bigMatch = maybeBigMatchPreview(next, story);
  next = bigMatch.career;
  story = bigMatch.story;
  if (bigMatch.emitted) return withStory(next, story);

  const leagueMoment = maybeLeagueTableMoment(next, story);
  next = leagueMoment.career;
  story = leagueMoment.story;
  if (leagueMoment.emitted) return withStory(next, story);

  const opp = next.lastMatchFixture?.opponent;
  if (opp) {
    const riv = maybeEmitRivalryMoment(next, story, opp);
    next = riv.career;
    story = riv.story;
    if (riv.emitted) return withStory(next, story);
  }

  const br = maybeBreakthrough(next, story, rng);
  next = br.career;
  story = br.story;
  if (br.emitted) return withStory(next, story);

  const streak = maybeWinStreak(next, story);
  next = streak.career;
  story = streak.story;
  if (streak.emitted) return withStory(next, story);

  const careerWins = maybeManagerCareerWins(next, story);
  next = careerWins.career;
  story = careerWins.story;
  if (careerWins.emitted) return withStory(next, story);

  const enq = maybeTransferEnquiry(next, story, rng);
  next = enq.career;
  story = enq.story;
  if (enq.emitted) return withStory(next, story);

  const ms = maybePlayerMilestones(next, story, rng);
  next = ms.career;
  story = ms.story;

  return withStory(next, story);
}

/** Derive a short season narrative label from actual season outcomes. */
export function deriveSeasonNarrativeLabel(career: ManagerCareer): string {
  const history = career.seasonHistory;
  const prev = history[history.length - 1];
  const position = getUserLeagueTablePosition(career);
  const labels = getManagerSeasonTrophyLabels(career);
  const cupWin = labels.includes("Challenge Cup");
  const leagueWin =
    labels.includes("Super League Champions") ||
    labels.includes("League Leaders");
  const wcc = labels.includes("World Club Challenge");
  const youthApps = career.squad.filter((ps) => {
    const age = getManagerPlayerAge(career, ps.playerId) ?? 30;
    const apps = career.playerSeasonStats[ps.playerId]?.appearances ?? 0;
    return age <= 22 && apps >= 8;
  }).length;

  if (wcc && (leagueWin || cupWin)) return "THE CLEAN SWEEP";
  if (leagueWin && prev && prev.position >= 8) return "THE COMEBACK";
  if (leagueWin) {
    return prev?.playoffFinish?.includes("Champions")
      ? "THE TITLE DEFENCE"
      : "THE DOMINANT SEASON";
  }
  if (cupWin && position >= 8) return "THE CUP RUN";
  if (cupWin) return "THE DOUBLE CHASE";
  if (youthApps >= 4) return "THE YOUNG GUNS";
  if (position >= 10 && (career.wins ?? 0) >= 3) return "THE GREAT ESCAPE";
  if (prev && position <= 4 && prev.position >= 9) return "THE RETURN";
  if (position >= 11) return "THE REBUILD";
  if (position <= 4) return "THE BREAKTHROUGH";
  return "THE CAMPAIGN";
}
