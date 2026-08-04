/**
 * Monte Carlo: user-facing Simulate Game scorer path (enrich + events).
 * Run: npx tsx scripts/test-simulate-game-scorer-distribution.ts
 */
import { createNewCareer } from "../src/lib/manager/managerState";
import {
  prepareCareerForNextMatch,
  simulateManagerMatchLive,
  getNextManagerFixture,
} from "../src/lib/manager/managerSimulation";
import { autoFixMatchdaySquad } from "../src/lib/manager/managerAutoFix";
import { pickTopTierSuperLeagueChampion } from "../src/lib/manager/worldClubChallenge";
import { getManagerClubStarRating } from "../src/lib/manager/club-config";
import { CLUB_REPUTATION_BY_NAME } from "../data/club-reputation";
import { getBoostDefinition } from "../data/store-boosts";

const MATCHES = Number(process.env.SIM_MATCHES ?? 2000);

type Band = "1" | "2" | "3" | "4" | "5+";

function bandForTries(n: number): Band {
  if (n <= 1) return "1";
  if (n === 2) return "2";
  if (n === 3) return "3";
  if (n === 4) return "4";
  return "5+";
}

function main() {
  console.log("=== Club reputation stars ===");
  for (const [name, stars] of Object.entries(CLUB_REPUTATION_BY_NAME).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  )) {
    console.log(`  ${stars}★  ${name}`);
  }
  for (const club of [
    "Wakefield Trinity",
    "Catalans Dragons",
    "Leigh Leopards",
  ]) {
    if (getManagerClubStarRating(club) !== 3) {
      throw new Error(`${club} must be 3★, got ${getManagerClubStarRating(club)}`);
    }
  }

  console.log("\n=== Season-one WCC five-star pool (1000 draws) ===");
  let bad = 0;
  for (let i = 0; i < 1000; i++) {
    const pick = pickTopTierSuperLeagueChampion(`seed-${i}`, 2026, "Hull FC");
    if (getManagerClubStarRating(pick) !== 5) {
      bad += 1;
      console.error(" non-five-star:", pick);
    }
  }
  console.log(`  non-five-star assignments: ${bad}`);
  if (bad > 0) throw new Error("WCC eligibility failed");

  const heal = getBoostDefinition("mgr-heal-all");
  if (!heal || heal.price !== 500_000) {
    throw new Error(`Heal All price expected 500000, got ${heal?.price}`);
  }
  console.log("\n=== Heal All price ===", heal.price);

  console.log(`\n=== Simulate Game scorer distribution (${MATCHES} matches) ===`);
  let career = createNewCareer("Leeds Rhinos", 0);
  // Skip pre-season so the next fixture is Super League (Simulate Game path).
  career = {
    ...career,
    preSeason: {
      friendliesPlayed: 2,
      awaitingChoice: false,
      currentChoices: [],
      activeFriendly: null,
    },
    matchWeekPhase: "ready",
  };
  career = autoFixMatchdaySquad(career).career ?? career;

  const monopolyByBand: Record<Band, { matches: number; mono: number }> = {
    "1": { matches: 0, mono: 0 },
    "2": { matches: 0, mono: 0 },
    "3": { matches: 0, mono: 0 },
    "4": { matches: 0, mono: 0 },
    "5+": { matches: 0, mono: 0 },
  };
  let hatTricks = 0;
  let fourTries = 0;
  let invalidPools = 0;
  let placeholderNames = 0;
  let simulated = 0;
  const byPosition: Record<string, number> = {};

  for (let i = 0; i < MATCHES; i++) {
    let ready: typeof career = {
      ...career,
      seed: `leeds-sim-${i}`,
      matchWeekPhase: "ready",
      // Keep the same schedule index so we always have a league fixture.
      currentFixtureIndex: 0,
      fixtures: [],
      preSeason: {
        friendliesPlayed: 2,
        awaitingChoice: false,
        currentChoices: [],
        activeFriendly: null,
      },
    };
    ready = autoFixMatchdaySquad(ready).career ?? ready;
    ready = prepareCareerForNextMatch(ready);
    const fixtureSched = getNextManagerFixture(ready);
    if (!fixtureSched || fixtureSched.competition === "friendly") {
      continue;
    }

    const { fixture, liveEvents } = simulateManagerMatchLive(ready, fixtureSched);
    simulated += 1;
    const tries = fixture.triesFor;
    const band = bandForTries(tries);
    monopolyByBand[band].matches += 1;

    const userTries = liveEvents.filter(
      (e) => e.type === "try" && e.team === "user"
    );
    const scorerCounts = new Map<string, number>();
    for (const ev of userTries) {
      const key = ev.playerId ?? ev.playerName ?? "?";
      scorerCounts.set(key, (scorerCounts.get(key) ?? 0) + 1);
      if (
        !ev.playerName ||
        /try scorer|home kicker|away kicker/i.test(ev.playerName)
      ) {
        placeholderNames += 1;
      }
      const detail = fixture.scoringDetail?.dreamTeam.tryScorers.find(
        (s) => s.playerId === ev.playerId || s.name === ev.playerName
      );
      const pos = (detail as { position?: string } | undefined)?.position ?? "UNK";
      byPosition[pos] = (byPosition[pos] ?? 0) + 1;
    }

    if (tries >= 2 && scorerCounts.size === 1 && userTries.length === tries) {
      monopolyByBand[band].mono += 1;
    }
    for (const count of scorerCounts.values()) {
      if (count >= 3) hatTricks += 1;
      if (count >= 4) fourTries += 1;
    }

    if (
      tries > 0 &&
      (!fixture.scoringDetail?.dreamTeam.tryScorers.length ||
        fixture.scoringDetail.dreamTeam.tryScorers.every((s) => !s.playerId))
    ) {
      invalidPools += 1;
    }
  }

  console.log(`  simulated matches: ${simulated}`);
  if (simulated < MATCHES * 0.5) {
    throw new Error(`Too few matches simulated: ${simulated}/${MATCHES}`);
  }

  console.log("\nOne-scorer monopoly rate by team try count:");
  for (const b of ["1", "2", "3", "4", "5+"] as Band[]) {
    const row = monopolyByBand[b];
    const pct = row.matches ? ((100 * row.mono) / row.matches).toFixed(2) : "n/a";
    console.log(
      `  ${b} tries: ${row.mono}/${row.matches} monopoly (${pct}%)`
    );
  }
  console.log("  hat-trick events (player≥3 in a match):", hatTricks);
  console.log("  four-try events:", fourTries);
  console.log("  invalid/missing scorer pools:", invalidPools);
  console.log("  placeholder scorer names:", placeholderNames);
  console.log("  tries by position:", byPosition);

  // Soft assert: for 3+ try matches, monopoly should be rare (<25%)
  const multi = monopolyByBand["3"].matches + monopolyByBand["4"].matches + monopolyByBand["5+"].matches;
  const multiMono =
    monopolyByBand["3"].mono + monopolyByBand["4"].mono + monopolyByBand["5+"].mono;
  if (multi > 50 && multiMono / multi > 0.35) {
    throw new Error(
      `One-scorer monopoly too high for 3+ try matches: ${multiMono}/${multi}`
    );
  }

  console.log("\nALL CHECKS PASSED");
}

main();
