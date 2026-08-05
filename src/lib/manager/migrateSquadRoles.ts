import type { ManagerCareer } from "./types";
import {
  evaluateReserveSquadRole,
  evaluateSquadRoleForPlayer,
  normalizeSquadRole,
  SQUAD_ROLE_SCHEMA_VERSION,
} from "./squadRole";

export { SQUAD_ROLE_SCHEMA_VERSION };

/** Map legacy contract roles and re-evaluate where career evidence exists. */
export function migrateSquadRoles(career: ManagerCareer): ManagerCareer {
  if ((career.squadRoleSchemaVersion ?? 0) >= SQUAD_ROLE_SCHEMA_VERSION) {
    return career;
  }

  const startingIds = new Set(career.matchdayXiii ?? []);
  const hasEvidence =
    (career.fixtures?.length ?? 0) > 0 ||
    career.squad.some((p) => p.seasonAppearances > 0);

  const contracts = { ...career.contracts };
  for (const [playerId, contract] of Object.entries(contracts)) {
    const mapped = normalizeSquadRole(contract.squadRole as string);
    const role = hasEvidence
      ? evaluateSquadRoleForPlayer(career, playerId)
      : mapped;
    contracts[playerId] = { ...contract, squadRole: role };
  }

  const reserveContracts = { ...(career.reserveContracts ?? {}) };
  for (const [playerId, contract] of Object.entries(reserveContracts)) {
    const reserve = career.reserves?.find((r) => r.id === playerId);
    const role = reserve
      ? evaluateReserveSquadRole(reserve)
      : normalizeSquadRole(contract.squadRole as string);
    reserveContracts[playerId] = { ...contract, squadRole: role };
  }

  void startingIds;

  return {
    ...career,
    contracts,
    reserveContracts,
    squadRoleSchemaVersion: SQUAD_ROLE_SCHEMA_VERSION,
  };
}
