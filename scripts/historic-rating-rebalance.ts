/**
 * Historic player rating rebalance + audit report.
 * Run: npx tsx scripts/historic-rating-rebalance.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");

type Raw = Record<string, unknown>;

/** Explicit player updates from user request. */
const EXPLICIT_UPDATES: Record<string, Raw> = {
  "st-helens-hist-anthony-sullivan": {
    peakRating: 87,
    rating: 87,
    nationality: "Wales",
    yearsActive: "1988–2001",
    category: "historic",
    appearances: 316,
    tries: 224,
    intlCaps: 15,
  },
  "hull-kr-hist-craig-hall": {
    peakRating: 88,
    rating: 88,
    nationality: "England",
    yearsActive: "2007–2025",
    category: "historic",
    appearances: 408,
    tries: 249,
    intlCaps: 2,
  },
  "catalans-hist-clint-greenshields": {
    peakRating: 87,
    rating: 87,
    nationality: "Australia",
    category: "historic",
    appearances: 188,
    tries: 101,
    intlCaps: 3,
  },
  "st-helens-hist-darren-albert": {
    peakRating: 88,
    rating: 88,
    nationality: "Australia",
    category: "historic",
    appearances: 236,
    tries: 165,
    intlCaps: 3,
  },
  "castleford-hist-denny-solomona": {
    peakRating: 88,
    rating: 88,
    yearsActive: "2014–2016",
    category: "historic",
    appearances: 66,
    tries: 70,
    intlCaps: 0,
  },
  "castleford-hist-greg-eden": {
    peakRating: 86,
    rating: 86,
    nationality: "England",
    position: "WING",
    category: "historic",
    appearances: 251,
    tries: 173,
    intlCaps: 0,
  },
  "wakefield-hist-henry-fa-afili": {
    peakRating: 87,
    rating: 87,
    nationality: "Samoa",
    yearsActive: "2000–2007",
    category: "historic",
    appearances: 191,
    tries: 111,
    intlCaps: 2,
  },
  "salford-hist-jodie-broughton": {
    peakRating: 86,
    rating: 86,
    yearsActive: "2008–2021",
    category: "historic",
    appearances: 216,
    tries: 134,
    intlCaps: 0,
  },
  "catalans-hist-justin-murphy": {
    peakRating: 86,
    rating: 86,
    nationality: "France",
    yearsActive: "1999–2008",
    category: "historic",
    appearances: 141,
    tries: 104,
    intlCaps: 2,
  },
  "bradford-hist-karl-pryce": {
    peakRating: 87,
    rating: 87,
    nationality: "England",
    yearsActive: "2003–2016",
    category: "historic",
    appearances: 178,
    tries: 101,
    intlCaps: 2,
  },
  "salford-hist-ken-sio": {
    peakRating: 87,
    rating: 87,
    nationality: "Australia",
    yearsActive: "2011–2023",
    category: "historic",
    appearances: 261,
    tries: 168,
    intlCaps: 0,
  },
  "wigan-cur-jai-field": {
    peakRating: 90,
    rating: 90,
  },
  "warrington-cur-george-williams": {
    peakRating: 89,
    rating: 89,
  },
};

/** Historic players that may legitimately stay 90+ (generational calibre). */
const KEEP_90_PLUS = new Set<string>([
  // None in historic file at 95+ tier — legends are separate file
]);

/** Reduce generic inflated 90+ historic ratings to 85-89 unless whitelisted. */
function suggestRebalance(
  player: Raw,
  currentRating: number
): { newRating: number; reason: string } | null {
  const id = player.id as string;
  if (EXPLICIT_UPDATES[id]) return null;

  const name = (player.name as string) ?? "";
  const tries = (player.tries as number) ?? 0;
  const apps = (player.appearances as number) ?? 0;
  const intl = (player.intlCaps as number) ?? 0;
  const mos = player.manOfSteel === true;
  const clubLeg = player.clubLegend === true;

  if (currentRating < 90) return null;

  // Genuine generational / MoS signals → cap at 90-92 max for historic
  if (mos && tries >= 150) {
    if (currentRating > 92) {
      return {
        newRating: 92,
        reason: "MoS calibre — capped at 92 (historic tier, not legend)",
      };
    }
    return null;
  }
  if (mos && tries >= 120) {
    if (currentRating > 91) {
      return {
        newRating: 91,
        reason: "MoS star — capped at 91",
      };
    }
    return null;
  }
  if (clubLeg && tries >= 100 && intl >= 10) {
    if (currentRating > 89) {
      return {
        newRating: 89,
        reason: "Club legend + international — capped at 89 (strong intl tier)",
      };
    }
    return null;
  }

  // High try scorers / strong careers → 87-89
  if (tries >= 100 || (tries >= 70 && intl >= 3)) {
    const target = Math.min(89, Math.max(87, currentRating - 4));
    if (target < currentRating) {
      return {
        newRating: target,
        reason: `Strong career (${tries} tries) — elite club legend tier 87-89`,
      };
    }
  }

  // Good professionals with 90+ inflation → 85-87
  if (tries >= 50 || apps >= 150) {
    const target = Math.min(87, Math.max(85, currentRating - 5));
    if (target < currentRating) {
      return {
        newRating: target,
        reason: `Solid SL career — reduced to strong professional band 85-87`,
      };
    }
  }

  // Default: any remaining 90+ historic without clear elite legacy → 84-86
  const target = Math.min(86, Math.max(84, currentRating - 6));
  if (target < currentRating) {
    return {
      newRating: target,
      reason: "Inflated 90+ without generational legacy — reduced to 84-86",
    };
  }

  return null;
}

function load<T>(path: string): T {
  return JSON.parse(readFileSync(join(ROOT, path), "utf8")) as T;
}

function save(path: string, data: unknown): void {
  writeFileSync(join(ROOT, path), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function findIdByName(players: Raw[], name: string): string | null {
  const p = players.find((x) => x.name === name);
  return p ? (p.id as string) : null;
}

function main() {
  const historicPath = "data/historic-players.json";
  const currentPath = "data/current-squads.json";
  const additionsPath = "data/player-additions.json";
  const overridesPath = "data/rating-overrides.json";

  const historic = load<Raw[]>(historicPath);
  const current = load<Raw[]>(currentPath);
  const additions = load<{ historic?: Raw[]; current?: Raw[] }>(additionsPath);
  const overrides = load<Record<string, number>>(overridesPath);

  const report: {
    player: string;
    id: string;
    oldRating: number;
    newRating: number;
    reason: string;
  }[] = [];

  // Resolve explicit IDs by name where needed
  const idAliases: Record<string, string> = {};
  for (const [id, data] of Object.entries(EXPLICIT_UPDATES)) {
    if (historic.some((p) => p.id === id) || current.some((p) => p.id === id)) continue;
  }

  const applyTo = (players: Raw[], file: string) => {
    for (const p of players) {
      const id = p.id as string;
      const oldRating = (p.peakRating ?? p.rating) as number;

      if (EXPLICIT_UPDATES[id]) {
        const upd = EXPLICIT_UPDATES[id];
        const newRating = (upd.peakRating ?? upd.rating) as number;
        Object.assign(p, upd);
        if (newRating !== oldRating || Object.keys(upd).length > 2) {
          report.push({
            player: p.name as string,
            id,
            oldRating,
            newRating,
            reason: "Explicit user update",
          });
        }
        overrides[id] = newRating;
        continue;
      }

      if (file !== historicPath) continue;
      if (KEEP_90_PLUS.has(id)) continue;
      if (p.availableInGame === false) continue;

      const suggestion = suggestRebalance(p, oldRating);
      if (!suggestion) continue;

      p.peakRating = suggestion.newRating;
      p.rating = suggestion.newRating;
      if (overrides[id] !== undefined) overrides[id] = suggestion.newRating;
      report.push({
        player: p.name as string,
        id,
        oldRating,
        newRating: suggestion.newRating,
        reason: suggestion.reason,
      });
    }
  };

  applyTo(historic, historicPath);
  applyTo(current, currentPath);

  // Sync additions
  if (additions.historic) {
    for (const p of additions.historic) {
      const src = historic.find((h) => h.id === p.id);
      if (src) Object.assign(p, src);
    }
  }
  if (additions.current) {
    for (const p of additions.current) {
      const src = current.find((h) => h.id === p.id);
      if (src) Object.assign(p, src);
    }
  }

  save(historicPath, historic);
  save(currentPath, current);
  save(additionsPath, additions);
  save(overridesPath, overrides);

  const reportPath = "data/historic-rating-rebalance-report.json";
  const remaining90 = historic.filter(
    (p) => ((p.peakRating ?? p.rating) as number) >= 90
  );
  save(reportPath, {
    generatedAt: new Date().toISOString(),
    changes: report.sort((a, b) => b.oldRating - a.oldRating),
    remaining90Plus: remaining90.map((p) => ({
      name: p.name,
      id: p.id,
      rating: p.peakRating ?? p.rating,
    })),
  });

  console.log(`\nHistoric rating rebalance complete`);
  console.log(`  Changes: ${report.length}`);
  console.log(`  Remaining historic 90+: ${remaining90.length}`);
  console.log(`  Report: ${reportPath}`);
}

main();
