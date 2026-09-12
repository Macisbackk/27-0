import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const DATA = join(__dirname, "..", "data");

const PREFIX: Record<string, string> = {
  "sheffield-eagles-hist-": "sheffield-hist-",
  "wakefield-trinity-hist-": "wakefield-hist-",
  "bradford-bulls-hist-": "bradford-hist-",
  "warrington-wolves-hist-": "warrington-hist-",
  "wigan-warriors-hist-": "wigan-hist-",
  "huddersfield-giants-hist-": "huddersfield-hist-",
  "barrow-raiders-hist-": "barrow-hist-",
  "leeds-rhinos-hist-": "leeds-hist-",
  "castleford-tigers-hist-": "castleford-hist-",
  "widnes-vikings-hist-": "widnes-hist-",
  "featherstone-rovers-hist-": "featherstone-hist-",
  "workington-town-hist-": "workington-hist-",
};

const TEAM_YEAR: Record<string, string> = {
  "Sheffield Eagles": "sheffield-eagles",
  "Wakefield Trinity": "wakefield-trinity",
  "Bradford Bulls": "bradford-bulls",
  "Warrington Wolves": "warrington-wolves",
  "Wigan Warriors": "wigan-warriors",
  "Huddersfield Giants": "huddersfield-giants",
  "Barrow Raiders": "barrow-raiders",
  "Leeds Rhinos": "leeds-rhinos",
  "Castleford Tigers": "castleford-tigers",
  "Widnes Vikings": "widnes-vikings",
  "St Helens": "st-helens",
  "Hull FC": "hull-fc",
  "Hull KR": "hull-kr",
  "Leigh Leopards": "leigh-leopards",
  "Featherstone Rovers": "featherstone-rovers",
  "Workington Town": "workington-town",
  Hunslet: "hunslet",
  Halifax: "halifax",
};

function fixId(id: string): string {
  let out = id;
  for (const [from, to] of Object.entries(PREFIX)) {
    if (out.startsWith(from)) out = to + out.slice(from.length);
  }
  return out;
}

type Raw = {
  id: string;
  name: string;
  club?: string;
  year?: number;
  teamYearId?: string;
  basePlayerId?: string;
  source?: string;
};

const historic = JSON.parse(
  readFileSync(join(DATA, "historic-players.json"), "utf8")
) as Raw[];

let renamed = 0;
for (const p of historic) {
  if (p.source !== "sheffield-1998-presl-lance-todd") continue;
  const oldId = p.id;
  p.id = fixId(p.id);
  p.basePlayerId = fixId(String(p.basePlayerId ?? p.id));
  if (typeof p.year === "number" && p.club) {
    const slug =
      TEAM_YEAR[p.club] ??
      p.club.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    p.teamYearId = `${slug}-${p.year}`;
  }
  if (oldId !== p.id) renamed++;
}

const seen = new Set<string>();
const cleaned: Raw[] = [];
for (const p of historic) {
  if (seen.has(p.id)) continue;
  seen.add(p.id);
  cleaned.push(p);
}

writeFileSync(
  join(DATA, "historic-players.json"),
  `${JSON.stringify(cleaned, null, 2)}\n`,
  "utf8"
);

let lt = JSON.parse(
  readFileSync(join(DATA, "lance-todd-winners.json"), "utf8")
) as string[];
lt = [...new Set(lt.map(fixId))].sort((a, b) => a.localeCompare(b));
writeFileSync(
  join(DATA, "lance-todd-winners.json"),
  `${JSON.stringify(lt, null, 2)}\n`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      renamed,
      historic: cleaned.length,
      lanceTodd: lt.length,
      sheffield1998: cleaned.filter(
        (p) => p.club === "Sheffield Eagles" && p.year === 1998
      ).length,
    },
    null,
    2
  )
);
