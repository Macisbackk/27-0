/**
 * Validate canonical player databases for identity / position / nation / club /
 * rating / 2026 Super League completeness issues.
 *
 * Run: npx tsx scripts/validate-player-database.ts
 */
import { readFileSync } from "fs";
import { join } from "path";
import { CURRENT_PLAYABLE_CLUBS } from "../src/lib/clubs/super-league-display";
import { normalizePosition } from "../src/lib/players/position-utils";

const DATA = join(__dirname, "..", "data");
const SL = new Set(CURRENT_PLAYABLE_CLUBS as readonly string[]);

type Raw = Record<string, unknown> & {
  id: string;
  name: string;
  club?: string;
  position?: string;
  nationality?: string;
  dateOfBirth?: string;
  birthYear?: number;
  peakRating?: number;
  category?: string;
  availableInGame?: boolean;
  superLeagueEligible?: boolean;
  year?: number;
  cardYear?: number;
};

function load(name: string): Raw[] {
  return JSON.parse(readFileSync(join(DATA, name), "utf8")) as Raw[];
}

function isUnknownNation(v: unknown): boolean {
  if (v == null) return true;
  const s = String(v).trim();
  return !s || /^unknown$/i.test(s) || /^n\/?a$/i.test(s) || /^tbd$/i.test(s);
}

function main() {
  const files = [
    ["current-squads.json", load("current-squads.json")],
    ["historic-players.json", load("historic-players.json")],
    ["legends.json", load("legends.json")],
  ] as const;

  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Map<string, string>();

  let currentSl = 0;
  const byClub: Record<string, number> = {};
  for (const club of SL) byClub[club] = 0;

  for (const [file, rows] of files) {
    for (const p of rows) {
      if (!p.id) errors.push(`${file}: missing id (${p.name})`);
      else if (ids.has(p.id)) {
        errors.push(`duplicate id ${p.id} in ${file} and ${ids.get(p.id)}`);
      } else ids.set(p.id, file);

      if (!p.name?.trim()) errors.push(`${file}:${p.id} missing name`);

      try {
        if (p.position) normalizePosition(String(p.position), p);
        else errors.push(`${file}:${p.id} missing position`);
      } catch {
        errors.push(`${file}:${p.id} invalid position ${p.position}`);
      }

      if (isUnknownNation(p.nationality) && p.availableInGame !== false) {
        warnings.push(`${file}:${p.id} (${p.name}) unknown nationality`);
      }

      if (p.peakRating == null || !Number.isFinite(Number(p.peakRating))) {
        errors.push(`${file}:${p.id} missing peakRating`);
      }

      const isCurrentPlayable =
        file === "current-squads.json" &&
        p.availableInGame !== false &&
        p.superLeagueEligible !== false &&
        SL.has(String(p.club));

      if (isCurrentPlayable) {
        currentSl++;
        byClub[String(p.club)] = (byClub[String(p.club)] ?? 0) + 1;
        const year = p.year ?? p.cardYear;
        if (year !== 2026) {
          warnings.push(`${p.id} playable current but year=${year}`);
        }
        if (p.peakRating != null && Number(p.peakRating) < 80) {
          warnings.push(`${p.id} rating ${p.peakRating} below SL floor 80`);
        }
      }

      if (
        file === "current-squads.json" &&
        p.availableInGame !== false &&
        p.category === "current" &&
        !SL.has(String(p.club))
      ) {
        errors.push(
          `${p.id} Championship/non-SL club still availableInGame (${p.club})`
        );
      }
    }
  }

  for (const club of SL) {
    if ((byClub[club] ?? 0) < 16) {
      errors.push(`${club} has only ${byClub[club] ?? 0} playable Current players (min 16)`);
    }
  }

  console.log("=== validate-player-database ===");
  console.log(`Players scanned: ${ids.size}`);
  console.log(`Current SL playable: ${currentSl}`);
  for (const club of SL) console.log(`  ${club}: ${byClub[club]}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings (unknown nationality etc): ${warnings.length}`);
  for (const e of errors.slice(0, 50)) console.log("  ERROR", e);
  for (const w of warnings.slice(0, 30)) console.log("  WARN", w);
  if (errors.length > 0) process.exit(1);
}

main();
