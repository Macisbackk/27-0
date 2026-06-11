/**
 * Update/add historic player records for batch request.
 * Run: npx tsx scripts/update-historic-player-batch.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");

type Raw = Record<string, unknown>;

function load<T>(file: string): T {
  return JSON.parse(readFileSync(join(ROOT, file), "utf8")) as T;
}

function save(file: string, data: unknown): void {
  writeFileSync(join(ROOT, file), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function findById(players: Raw[], id: string): Raw | undefined {
  return players.find((p) => p.id === id);
}

function syncAdditions(
  additions: { historic?: Raw[]; current?: Raw[] },
  player: Raw,
  bucket: "historic" | "current"
): void {
  const list = bucket === "historic" ? additions.historic : additions.current;
  if (!list) return;
  const idx = list.findIndex((p) => p.id === player.id);
  if (idx >= 0) list[idx] = { ...list[idx], ...player };
  else list.push(player);
}

function patch(
  players: Raw[],
  id: string,
  updates: Raw
): boolean {
  const p = findById(players, id);
  if (!p) return false;
  Object.assign(p, updates);
  return true;
}

function main() {
  const historicPath = "data/historic-players.json";
  const currentPath = "data/current-squads.json";
  const additionsPath = "data/player-additions.json";

  const historic = load<Raw[]>(historicPath);
  const current = load<Raw[]>(currentPath);
  const additions = load<{ historic?: Raw[]; current?: Raw[] }>(additionsPath);

  const updates: { id: string; file: string }[] = [];

  const historicPatches: [string, Raw][] = [
    [
      "bradford-hist-jarrod-sammut",
      {
        nationality: "Malta",
        yearsActive: "2007–2025",
        category: "historic",
        appearances: 305,
        tries: 181,
        intlCaps: 2,
        peakRating: 86,
        rating: 86,
      },
    ],
    [
      "bradford-hist-ben-harris",
      {
        nationality: "Australia",
        yearsActive: "2002–2010",
        category: "historic",
        peakRating: 84,
        rating: 84,
        appearances: 164,
        tries: 49,
        intlCaps: 2,
      },
    ],
    [
      "bradford-hist-jason-crookes",
      {
        nationality: "England",
        yearsActive: "2007–2019",
        category: "historic",
        appearances: 186,
        tries: 56,
        intlCaps: 0,
      },
    ],
    [
      "bradford-hist-stuart-spruce",
      {
        nationality: "England",
        yearsActive: "1989–2007",
        category: "historic",
        peakRating: 86,
        rating: 86,
        appearances: 267,
        tries: 109,
        intlCaps: 2,
      },
    ],
    [
      "bradford-hist-michael-platt",
      {
        nationality: "Ireland",
        yearsActive: "2001–2015",
        category: "historic",
        appearances: 256,
        tries: 91,
        intlCaps: 2,
      },
    ],
    [
      "hull-fc-hist-chris-green",
      {
        nationality: "England",
        yearsActive: "2011–2022",
        category: "historic",
        appearances: 202,
        tries: 20,
        intlCaps: 0,
      },
    ],
    [
      "salford-hist-greg-johnson",
      {
        nationality: "Jamaica",
        yearsActive: "2011–2024",
        category: "historic",
        peakRating: 83,
        rating: 83,
        appearances: 165,
        tries: 81,
        intlCaps: 2,
      },
    ],
    [
      "hull-kr-hist-cory-paterson",
      {
        category: "historic",
        peakRating: 86,
        rating: 86,
      },
    ],
    [
      "wigan-hist-paul-johnson",
      {
        name: "Paul Johnson",
        position: "CENTRE",
        nationality: "England",
        yearsActive: "1996–2014",
        category: "historic",
        appearances: 240,
        tries: 84,
        intlCaps: 2,
      },
    ],
    [
      "london-hist-rob-jackson",
      {
        nationality: "England",
        yearsActive: "2002–2010",
        category: "historic",
        peakRating: 81,
        rating: 81,
        intlCaps: 0,
      },
    ],
    [
      "huddersfield-hist-lee-gaskell",
      {
        nationality: "England",
        yearsActive: "2008–2025",
        category: "historic",
        peakRating: 86,
        rating: 86,
        appearances: 273,
        tries: 91,
        intlCaps: 0,
      },
    ],
    [
      "widnes-hist-corey-thompson",
      {
        nationality: "Australia",
        yearsActive: "2014–2019",
        category: "historic",
        peakRating: 84,
        rating: 84,
        appearances: 57,
        tries: 41,
        club: "Widnes Vikings",
        availableInGame: false,
      },
    ],
  ];

  for (const [id, data] of historicPatches) {
    if (patch(historic, id, data)) {
      updates.push({ id, file: historicPath });
      const p = findById(historic, id)!;
      syncAdditions(additions, p, "historic");
    } else {
      console.warn(`Missing historic id: ${id}`);
    }
  }

  // Stuart Spruce id might be bradford-hist-stuart-spruce - check actual id
  const spruce = historic.find((p) => p.name === "Stuart Spruce");
  if (spruce && !updates.some((u) => u.id === spruce.id)) {
    Object.assign(spruce, {
      nationality: "England",
      yearsActive: "1989–2007",
      category: "historic",
      peakRating: 86,
      rating: 86,
      appearances: 267,
      tries: 109,
      intlCaps: 2,
    });
    updates.push({ id: spruce.id as string, file: historicPath });
    syncAdditions(additions, spruce, "historic");
  }

  // Paul Johnson historic id
  const paulHist = historic.find(
    (p) => p.name === "Paul Johnson" && p.club === "Wigan Warriors"
  );
  if (paulHist) {
    Object.assign(paulHist, {
      position: "CENTRE",
      nationality: "England",
      yearsActive: "1996–2014",
      category: "historic",
      appearances: 240,
      tries: 84,
      intlCaps: 2,
    });
    if (!updates.some((u) => u.id === paulHist.id)) {
      updates.push({ id: paulHist.id as string, file: historicPath });
    }
    syncAdditions(additions, paulHist, "historic");
  }

  // Tom Briscoe — current (has Present)
  if (
    patch(current, "hull-fc-cur-tom-briscoe", {
      peakRating: 87,
      rating: 87,
      appearances: 427,
      tries: 213,
    })
  ) {
    updates.push({ id: "hull-fc-cur-tom-briscoe", file: currentPath });
    syncAdditions(additions, findById(current, "hull-fc-cur-tom-briscoe")!, "current");
  } else {
    const tb = current.find((p) => p.name === "Tom Briscoe");
    if (tb) {
      Object.assign(tb, {
        peakRating: 87,
        rating: 87,
        appearances: 427,
        tries: 213,
      });
      updates.push({ id: tb.id as string, file: currentPath });
      syncAdditions(additions, tb, "current");
    }
  }

  // Nathan McAvoy — add if missing
  if (!historic.some((p) => p.name === "Nathan McAvoy")) {
    const mcavoy: Raw = {
      id: "bradford-hist-nathan-mcavoy",
      name: "Nathan McAvoy",
      position: "WING",
      club: "Bradford Bulls",
      nationality: "England",
      era: "SUPER_LEAGUE_ORIGINS",
      yearsActive: "1994–2006",
      category: "historic",
      peakRating: 81,
      rating: 81,
      value: 385000,
      intlCaps: 2,
      appearances: 142,
      tries: 68,
      clubLegend: false,
    };
    historic.push(mcavoy);
    syncAdditions(additions, mcavoy, "historic");
    updates.push({ id: "bradford-hist-nathan-mcavoy", file: historicPath + " (new)" });
  } else {
    patch(
      historic,
      historic.find((p) => p.name === "Nathan McAvoy")!.id as string,
      {
        nationality: "England",
        category: "historic",
        peakRating: 81,
        rating: 81,
        intlCaps: 2,
      }
    );
  }

  save(historicPath, historic);
  save(currentPath, current);
  save(additionsPath, additions);

  console.log(`Updated ${updates.length} player records:`);
  for (const u of updates) console.log(`  - ${u.id} (${u.file})`);
}

main();
