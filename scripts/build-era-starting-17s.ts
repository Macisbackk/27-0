/**
 * Parse verified historic starting 17s into era-starting-17s.json.
 * Source: data/historic_starting_17_clean_verified.txt
 *
 * Run: npm run build:era-starting-17s
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ROOT = join(process.cwd());
const SOURCE_FILE = "historic_starting_17_clean_verified.txt";
const SOURCE_PATH = join(ROOT, "data", SOURCE_FILE);
const OUTPUT_PATH = join(ROOT, "data", "era-starting-17s.json");

const EXPECTED_NUMBERS = Array.from({ length: 17 }, (_, i) => i + 1);

export type EraStarting17Member = {
  number: number;
  position: string;
  name: string;
};

export type EraStarting17Entry = {
  club: string;
  year: number;
  source: string;
  squad: EraStarting17Member[];
};

const HEADER_RE = /^(.+?) (\d{4})$/;
const PLAYER_RE = /^(\d+)\.\s*(\S+)\s*-\s*(.+)$/;
const SEPARATOR_RE = /^=+$/;

function isRejectedName(name: string): boolean {
  const upper = name.trim().toUpperCase();
  return (
    upper === "NOT_FOUND" ||
    upper.includes("NOT_FOUND") ||
    upper === "INCOMPLETE" ||
    upper === "UNRESOLVED"
  );
}

function isCompleteSquad(squad: EraStarting17Member[]): boolean {
  if (squad.length !== 17) return false;
  const numbers = squad.map((m) => m.number).sort((a, b) => a - b);
  return EXPECTED_NUMBERS.every((n, i) => numbers[i] === n);
}

function parseSource(text: string): EraStarting17Entry[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const entries: EraStarting17Entry[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line || SEPARATOR_RE.test(line) || line.startsWith("HISTORIC ")) {
      i++;
      continue;
    }

    const headerMatch = line.match(HEADER_RE);
    if (!headerMatch) {
      i++;
      continue;
    }

    const club = headerMatch[1].trim();
    const year = Number.parseInt(headerMatch[2], 10);
    const squad: EraStarting17Member[] = [];
    let rejected = false;
    i++;

    while (i < lines.length) {
      const playerLine = lines[i];
      if (!playerLine) {
        i++;
        if (squad.length > 0) break;
        continue;
      }

      if (SEPARATOR_RE.test(playerLine)) break;

      const nextHeader = playerLine.match(HEADER_RE);
      if (nextHeader && squad.length > 0) break;
      if (nextHeader && squad.length === 0) break;

      const playerMatch = playerLine.match(PLAYER_RE);
      if (!playerMatch) {
        if (squad.length > 0) break;
        i++;
        continue;
      }

      const name = playerMatch[3].trim();
      if (isRejectedName(name)) {
        rejected = true;
        break;
      }

      squad.push({
        number: Number.parseInt(playerMatch[1], 10),
        position: playerMatch[2].trim(),
        name,
      });
      i++;
    }

    if (!rejected && isCompleteSquad(squad)) {
      entries.push({
        club,
        year,
        source: SOURCE_FILE,
        squad,
      });
    }

    if (rejected) {
      while (i < lines.length) {
        const peek = lines[i];
        if (!peek || SEPARATOR_RE.test(peek)) break;
        if (peek.match(HEADER_RE)) break;
        i++;
      }
    }
  }

  return entries.sort((a, b) =>
    a.club === b.club ? b.year - a.year : a.club.localeCompare(b.club)
  );
}

function main(): void {
  const text = readFileSync(SOURCE_PATH, "utf8");
  const entries = parseSource(text);

  writeFileSync(OUTPUT_PATH, `${JSON.stringify(entries, null, 2)}\n`);

  const byClub = new Map<string, number>();
  for (const entry of entries) {
    byClub.set(entry.club, (byClub.get(entry.club) ?? 0) + 1);
  }

  console.log(`[era-starting-17s] Wrote ${entries.length} squads → ${OUTPUT_PATH}`);
  for (const [club, count] of [...byClub.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    console.log(`  ${club}: ${count}`);
  }
}

main();
