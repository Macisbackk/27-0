/**
 * Era Normal Mode data-gap report — eligible pools per position.
 * Run: npm run debug:era-data-gaps
 */
import { RECRUIT_SLOT_ORDER, createEmptySquad, SQUAD_STRUCTURE } from "../src/lib/positions";
import {
  getEraModeTeamYearPools,
  getSpinTeamYearPoolsCached,
} from "../src/lib/game/player-pool-eligibility";
import { groupPoolsByClub } from "../src/lib/game/spin-club-pick";
import {
  getRawPlayersForTeamYearPool,
  isPlayerInTeamYearPool,
} from "../src/lib/game/team-year-pools";
import { canPlayerFillTeamYearSlot } from "../src/lib/players/team-year-roster-playable";
import { getPlayableClubNames } from "../src/lib/clubs/super-league-display";
import { getEraWikipediaSquadPlayerIds } from "../src/lib/players/era-wikipedia-squads";
import { isPlayableTeamYearRoster } from "../src/lib/players/team-year-roster-playable";
import { getPlayerById } from "../src/lib/players";
import type { Position } from "../src/lib/types";

const POSITION_LABEL: Record<Position, string> = {
  FULLBACK: "FB",
  WING: "WG",
  CENTRE: "CE",
  STAND_OFF: "SO",
  SCRUM_HALF: "SH",
  PROP: "PF",
  HOOKER: "HK",
  SECOND_ROW: "SR",
  LOOSE_FORWARD: "LF",
};

function auditPosition(slotIndex: number) {
  const squad = createEmptySquad();
  const slot = squad.find((s) => s.slotIndex === slotIndex)!;
  const position = slot.position;
  const usedIds = new Set<string>();
  const eraPools = getSpinTeamYearPoolsCached("era");

  const eligiblePools = eraPools.filter((pool) => {
    const players = getRawPlayersForTeamYearPool(pool).filter(
      (player) =>
        isPlayerInTeamYearPool(player.id, pool) &&
        !usedIds.has(player.id) &&
        canPlayerFillTeamYearSlot(pool.team, pool.year, player, position)
    );
    return players.length > 0;
  });

  const byClub = groupPoolsByClub(eligiblePools);
  const clubYears = new Map<string, string[]>();
  for (const [club, pools] of byClub.entries()) {
    clubYears.set(
      club,
      pools.map((p) => p.year).sort((a, b) => Number(b) - Number(a))
    );
  }

  const allEraPools = getEraModeTeamYearPools();
  const hiddenIncomplete: Array<{ team: string; year: string; reason: string }> =
    [];
  const playableClubs = new Set(getPlayableClubNames());

  for (const pool of allEraPools) {
    const ids = getEraWikipediaSquadPlayerIds(pool.team, pool.year);
    if (!ids || ids.length !== 13) {
      hiddenIncomplete.push({
        team: pool.team,
        year: pool.year,
        reason: `roster size ${ids?.length ?? 0}`,
      });
      continue;
    }
    if (
      !isPlayableTeamYearRoster(pool.team, pool.year, ids, (id) =>
        getPlayerById(id)
      )
    ) {
      hiddenIncomplete.push({
        team: pool.team,
        year: pool.year,
        reason: "failed playability gate",
      });
    }
  }

  const clubsMissingPosition = [...playableClubs].filter(
    (club) => !byClub.has(club)
  );

  return {
    position,
    label: POSITION_LABEL[position],
    slotIndex,
    eligibleClubs: byClub.size,
    eligibleTeamYears: eligiblePools.length,
    clubYears: Object.fromEntries(
      [...clubYears.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    ),
    clubsMissingPosition: clubsMissingPosition.sort(),
    hiddenIncompleteCount: hiddenIncomplete.length,
    hiddenIncomplete: hiddenIncomplete.slice(0, 8),
  };
}

function main(): void {
  console.log("=== Era Normal Mode Data Gap Report ===\n");

  const eraPools = getEraModeTeamYearPools();
  const eraClubs = new Set(eraPools.map((p) => p.team));
  console.log(
    `Total era team-years (excl. 2026): ${eraPools.length} across ${eraClubs.size} clubs\n`
  );

  const summaries = RECRUIT_SLOT_ORDER.map((slotIndex) =>
    auditPosition(slotIndex)
  );

  for (const row of summaries) {
    console.log(`Position: ${row.label} (${row.position})`);
    console.log(`  Eligible clubs: ${row.eligibleClubs}`);
    console.log(`  Eligible team-years: ${row.eligibleTeamYears}`);
    if (row.clubsMissingPosition.length > 0) {
      console.log(
        `  Clubs missing this position: ${row.clubsMissingPosition.join(", ")}`
      );
    }
    console.log(`  Hidden incomplete pools: ${row.hiddenIncompleteCount}`);
    if (row.hiddenIncomplete.length > 0) {
      for (const hidden of row.hiddenIncomplete) {
        console.log(
          `    - ${hidden.team} ${hidden.year}: ${hidden.reason}`
        );
      }
    }
    const clubLines = Object.entries(row.clubYears);
    if (clubLines.length > 0) {
      console.log("  Team-years per club:");
      for (const [club, years] of clubLines) {
        console.log(`    ${club}: ${years.join(", ")}`);
      }
    }
    console.log("");
  }

  const weakest = [...summaries].sort(
    (a, b) => a.eligibleClubs - b.eligibleClubs
  )[0];
  if (weakest && weakest.eligibleClubs <= 4) {
    console.log(
      `NOTE: Weakest coverage is ${weakest.label} with only ${weakest.eligibleClubs} eligible clubs — add verified historic team-years with position coverage.`
    );
  }

  console.log("\nSquad structure reference:");
  for (const { position, count } of SQUAD_STRUCTURE) {
    console.log(`  ${POSITION_LABEL[position]} × ${count}`);
  }
}

main();
