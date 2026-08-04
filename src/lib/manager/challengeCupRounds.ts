/**
 * Canonical Challenge Cup round IDs and labels — single source of truth.
 * Storage uses underscore keys (CupRoundKey); hyphenated aliases are accepted
 * only during legacy migration.
 */
import type { CupRoundKey, ManagerCareer, ManagerFixtureRecord } from "./types";
import { CUP_ROUND_LABELS } from "./types";

/** Bump when round-label migration rules change. */
export const CHALLENGE_CUP_ROUND_SCHEMA_VERSION = 3;

export type ChallengeCupRoundId = CupRoundKey;

/** Full competition labels — re-export of CUP_ROUND_LABELS. */
export const CHALLENGE_CUP_ROUND_LABELS: Record<ChallengeCupRoundId, string> =
  CUP_ROUND_LABELS;

const CANONICAL_IDS = new Set<string>(Object.keys(CUP_ROUND_LABELS));

/** Known legacy round strings → canonical CupRoundKey. */
const LEGACY_ROUND_ALIASES: Record<string, CupRoundKey> = {
  preliminary: "round_one",
  prelim: "round_one",
  round1: "round_one",
  "round-1": "round_one",
  "round-one": "round_one",
  r1: "round_one",
  round_one: "round_one",
  round2: "round_two",
  "round-2": "round_two",
  "round-two": "round_two",
  r2: "round_two",
  round_two: "round_two",
  "round-of-16": "last_sixteen",
  round_of_16: "last_sixteen",
  roundof16: "last_sixteen",
  last16: "last_sixteen",
  "last-16": "last_sixteen",
  last_16: "last_sixteen",
  last_sixteen: "last_sixteen",
  r16: "last_sixteen",
  quarters: "quarter_final",
  quarter: "quarter_final",
  quarterfinal: "quarter_final",
  "quarter-final": "quarter_final",
  "quarter-finals": "quarter_final",
  qf: "quarter_final",
  quarter_final: "quarter_final",
  semis: "semi_final",
  semi: "semi_final",
  semifinal: "semi_final",
  "semi-final": "semi_final",
  "semi-finals": "semi_final",
  sf: "semi_final",
  semi_final: "semi_final",
  "cup-final": "final",
  cup_final: "final",
  cupfinal: "final",
  final: "final",
  finals: "final",
};

/**
 * Resolve any stored round string to a canonical CupRoundKey.
 * Never defaults to `final` — unknown values return null.
 */
export function normalizeCupRoundId(
  raw: string | null | undefined
): CupRoundKey | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (CANONICAL_IDS.has(trimmed)) return trimmed as CupRoundKey;
  const key = trimmed.toLowerCase().replace(/\s+/g, "-");
  const underscored = key.replace(/-/g, "_");
  if (CANONICAL_IDS.has(underscored)) return underscored as CupRoundKey;
  return LEGACY_ROUND_ALIASES[key] ?? LEGACY_ROUND_ALIASES[underscored] ?? null;
}

/** Label for a round ID — never invents "Challenge Cup Final" for unknown data. */
export function getChallengeCupRoundLabel(
  roundId: CupRoundKey | string | null | undefined
): string {
  if (roundId == null || roundId === "") {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[challenge-cup] Missing roundId — using neutral Challenge Cup label"
      );
    }
    return "Challenge Cup";
  }
  const normalized = normalizeCupRoundId(String(roundId));
  if (!normalized) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[challenge-cup] Unrecognised roundId "${roundId}" — using neutral label`
      );
    }
    return "Challenge Cup";
  }
  return CHALLENGE_CUP_ROUND_LABELS[normalized];
}

/** True only when the fixture is explicitly the Final. */
export function isChallengeCupFinalRound(
  roundId: CupRoundKey | string | null | undefined
): boolean {
  return normalizeCupRoundId(roundId == null ? null : String(roundId)) === "final";
}

function migrateFixtureRound(
  fixture: ManagerFixtureRecord
): ManagerFixtureRecord {
  if (fixture.competition !== "challenge_cup") return fixture;
  const raw = fixture.meta?.cupRound;
  if (raw == null) return fixture;
  const normalized = normalizeCupRoundId(String(raw));
  if (!normalized) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[challenge-cup] Could not migrate fixture round "${raw}" (id=${fixture.fixtureId ?? "?"})`
      );
    }
    return fixture;
  }
  if (normalized === raw) return fixture;
  return {
    ...fixture,
    meta: {
      injuries: fixture.meta?.injuries ?? [],
      ...fixture.meta,
      cupRound: normalized,
    },
  };
}

/**
 * Migrate legacy cup round strings on saved fixtures / schedule.
 * Does not redraw the bracket or invent Final labels.
 */
export function migrateChallengeCupRoundLabels(
  career: ManagerCareer
): ManagerCareer {
  const version = career.challengeCupRoundSchemaVersion ?? 0;
  if (version >= CHALLENGE_CUP_ROUND_SCHEMA_VERSION) return career;

  const fixtures = career.fixtures.map(migrateFixtureRound);
  const schedule = career.schedule?.map((s) => {
    if (s.competition !== "challenge_cup" || s.cupRound == null) return s;
    const normalized = normalizeCupRoundId(String(s.cupRound));
    if (!normalized) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[challenge-cup] Could not migrate schedule round "${s.cupRound}" (id=${s.id})`
        );
      }
      return s;
    }
    if (normalized === s.cupRound) return s;
    return { ...s, cupRound: normalized };
  });

  let lastMatchFixture = career.lastMatchFixture;
  if (lastMatchFixture) {
    lastMatchFixture = migrateFixtureRound(lastMatchFixture);
  }

  return {
    ...career,
    fixtures,
    ...(schedule ? { schedule } : {}),
    ...(lastMatchFixture ? { lastMatchFixture } : {}),
    challengeCupRoundSchemaVersion: CHALLENGE_CUP_ROUND_SCHEMA_VERSION,
  };
}
