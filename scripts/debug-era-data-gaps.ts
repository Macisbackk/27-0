/**
 * Era Normal Mode data-gap report — eligible pools per position.
 * Run: npm run debug:era-data-gaps
 */
import eraWikipediaSquads from "../data/era-wikipedia-squads.json";
import slVerifiedSquads from "../data/sl-era-verified-squads.json";
import teamYearRostersAudit from "../data/team-year-rosters-audit.json";
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
import {
  getCurrentPlayableClubNames,
  getEraPlayableClubNames,
} from "../src/lib/clubs/super-league-display";
import { isSuperLeagueSeason } from "../src/lib/players/super-league-club-years";
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

type SquadStore = Record<
  string,
  Record<string, { playerIds?: string[]; wikipediaPlayers?: string[] }>
>;

function countStoredSquads(): {
  stored: number;
  storedSuperLeague: number;
  storedByClub: Map<string, number>;
} {
  const sources = [eraWikipediaSquads, slVerifiedSquads] as SquadStore[];
  const seen = new Set<string>();
  const storedByClub = new Map<string, number>();
  let stored = 0;
  let storedSuperLeague = 0;

  for (const store of sources) {
    for (const [club, years] of Object.entries(store)) {
      for (const [year, entry] of Object.entries(years)) {
        if (!entry?.playerIds || entry.playerIds.length !== 13) continue;
        const key = `${club}|${year}`;
        if (seen.has(key)) continue;
        seen.add(key);
        stored++;
        if (isSuperLeagueSeason(club, year)) {
          storedSuperLeague++;
          storedByClub.set(club, (storedByClub.get(club) ?? 0) + 1);
        }
      }
    }
  }

  return { stored, storedSuperLeague, storedByClub };
}

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

  const eraClubs = new Set(getEraPlayableClubNames());
  const clubsMissingPosition = [...eraClubs].filter((club) => !byClub.has(club));

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
  };
}

function main(): void {
  console.log("=== Era Normal Mode Data Gap Report ===\n");

  const stored = countStoredSquads();
  const audit = teamYearRostersAudit as {
    playableCount: number;
    hiddenCount: number;
    hidden: Array<{ team: string; year: string; reason: string }>;
    unresolvedSquads?: Array<{ team: string; year: string; names: string[] }>;
    verifiedSquadsMerged?: number;
  };

  const eraPools = getEraModeTeamYearPools();
  const eraClubs = new Set(eraPools.map((p) => p.team));
  const playableByClub = new Map<string, number>();
  for (const pool of eraPools) {
    playableByClub.set(pool.team, (playableByClub.get(pool.team) ?? 0) + 1);
  }

  console.log(`Stored squads (Wikipedia + verified): ${stored.stored}`);
  console.log(`Stored Super League squads: ${stored.storedSuperLeague}`);
  console.log(`Resolved squads merged: ${audit.verifiedSquadsMerged ?? "—"}`);
  console.log(`Playable era squads (excl. 2026): ${eraPools.length}`);
  console.log(`Hidden incomplete squads: ${audit.hiddenCount}`);
  console.log(
    `Unresolved player names (squads): ${audit.unresolvedSquads?.length ?? 0}`
  );

  const hiddenNonSl = audit.hidden.filter(
    (h) => h.reason === "not a Super League season"
  ).length;
  if (hiddenNonSl > 0) {
    console.log(`Hidden non-Super-League squads: ${hiddenNonSl}`);
  }

  console.log("\nPlayable clubs (era team-year counts):");
  for (const club of getEraPlayableClubNames()) {
    const count = playableByClub.get(club) ?? 0;
    const storedCount = stored.storedByClub.get(club) ?? 0;
    const suffix =
      count === 0 && storedCount > 0 ? ` (${storedCount} stored, not playable)` : "";
    console.log(`  ${club}: ${count}${suffix}`);
  }

  const historicOnly = ["London Broncos", "Salford Red Devils", "Widnes Vikings"];
  for (const club of historicOnly) {
    const inEra = eraClubs.has(club);
    console.log(
      `  ${club} in era spin pools: ${inEra ? "yes" : "no"} (${playableByClub.get(club) ?? 0} team-years)`
    );
  }

  if (audit.unresolvedSquads && audit.unresolvedSquads.length > 0) {
    console.log("\nUnresolved Wikipedia names (sample):");
    for (const row of audit.unresolvedSquads.slice(0, 12)) {
      console.log(`  ${row.team} ${row.year}: ${row.names.join(", ")}`);
    }
    if (audit.unresolvedSquads.length > 12) {
      console.log(`  ... and ${audit.unresolvedSquads.length - 12} more squads`);
    }
  }

  if (audit.hidden.length > 0) {
    console.log("\nHidden squads (sample):");
    for (const row of audit.hidden.slice(0, 12)) {
      console.log(`  ${row.team} ${row.year}: ${row.reason}`);
    }
  }

  console.log(
    `\nCurrent-only clubs (excluded from era): ${getCurrentPlayableClubNames().length}`
  );
  console.log(
    `Total era team-years in spin: ${eraPools.length} across ${eraClubs.size} clubs\n`
  );

  const summaries = RECRUIT_SLOT_ORDER.map((slotIndex) =>
    auditPosition(slotIndex)
  );

  const fb = summaries.find((s) => s.slotIndex === 0)!;
  console.log(`Position: ${fb.label} (${fb.position})`);
  console.log(`  Eligible clubs: ${fb.eligibleClubs}`);
  console.log(`  Eligible team-years: ${fb.eligibleTeamYears}`);
  if (fb.clubsMissingPosition.length > 0) {
    console.log(
      `  Clubs missing this position: ${fb.clubsMissingPosition.join(", ")}`
    );
  }
  console.log("  Team-years per club:");
  for (const [club, years] of Object.entries(fb.clubYears)) {
    console.log(`    ${club}: ${years.join(", ")}`);
  }
  console.log("");

  const weakest = [...summaries].sort(
    (a, b) => a.eligibleClubs - b.eligibleClubs
  )[0];
  if (weakest) {
    console.log(
      `Weakest position coverage: ${weakest.label} — ${weakest.eligibleClubs} clubs, ${weakest.eligibleTeamYears} team-years`
    );
  }

  console.log("\nSquad structure reference:");
  for (const { position, count } of SQUAD_STRUCTURE) {
    console.log(`  ${POSITION_LABEL[position]} × ${count}`);
  }
}

main();
