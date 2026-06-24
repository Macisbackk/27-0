/**
 * Add verified year-specific historic cards + career spans for unresolved era squads.
 * Run: npx tsx scripts/apply-era-unresolved-fixes.ts
 * Then: npm run build:team-year-rosters
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { Player } from "../src/lib/types";

const DATA = join(process.cwd(), "data");

type CardSpec = {
  id: string;
  name: string;
  club: string;
  year: number;
  position: Player["position"];
  peakRating: number;
  nationality?: string;
  birthYear?: number;
};

function slug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function clubPrefix(club: string): string {
  if (club === "Bradford Bulls") return "bradford-hist";
  if (club === "Leeds Rhinos") return "leeds-hist";
  if (club === "Hull FC") return "hull-fc-hist";
  if (club === "Widnes Vikings") return "widnes-hist";
  if (club === "Wigan Warriors") return "wigan-hist";
  if (club === "Warrington Wolves") return "warrington-hist";
  if (club === "Wakefield Trinity") return "wakefield-hist";
  if (club === "St Helens") return "st-helens-hist";
  if (club === "Hull KR") return "hull-kr-hist";
  if (club === "London Broncos") return "london-hist";
  if (club === "Toulouse Olympique") return "toulouse-hist";
  return `${slug(club)}-hist`;
}

function makeCard(spec: CardSpec): Record<string, unknown> {
  const value =
    spec.peakRating >= 90
      ? 2_470_000
      : spec.peakRating >= 86
        ? 1_650_000
        : spec.peakRating >= 83
          ? 1_145_000
          : spec.peakRating >= 80
            ? 735_000
            : 620_000;
  return {
    id: spec.id,
    name: spec.name,
    position: spec.position,
    club: spec.club,
    nationality: spec.nationality ?? "England",
    era: "MODERN_ERA",
    yearsActive: `${spec.year}–${spec.year}`,
    cardYear: spec.year,
    category: "historic",
    peakRating: spec.peakRating,
    rating: spec.peakRating,
    value,
    ...(spec.birthYear ? { birthYear: spec.birthYear } : {}),
  };
}

function yearCard(
  club: string,
  name: string,
  year: number,
  position: Player["position"],
  peakRating: number,
  nationality?: string
): CardSpec {
  const prefix = clubPrefix(club);
  return {
    id: `${prefix}-${slug(name)}-${year}`,
    name,
    club,
    year,
    position,
    peakRating,
    nationality,
  };
}

const CARD_SPECS: CardSpec[] = [
  // Bradford Bulls
  yearCard("Bradford Bulls", "Ryan Atkins", 2006, "CENTRE", 82),
  yearCard("Bradford Bulls", "Iestyn Harris", 2006, "STAND_OFF", 89),
  yearCard("Bradford Bulls", "Terry Newton", 2006, "HOOKER", 86),
  yearCard("Bradford Bulls", "Brett Ferres", 2006, "SECOND_ROW", 83),
  yearCard("Bradford Bulls", "Paul Johnson", 2006, "SECOND_ROW", 82),
  yearCard("Bradford Bulls", "Sam Burgess", 2006, "LOOSE_FORWARD", 76),
  yearCard("Bradford Bulls", "Semi Tadulala", 2009, "WING", 79, "Fiji"),
  yearCard("Bradford Bulls", "Paul Sykes", 2009, "CENTRE", 80),
  yearCard("Bradford Bulls", "Chris Nero", 2009, "CENTRE", 81),
  yearCard("Bradford Bulls", "Ben Jeffries", 2009, "STAND_OFF", 82),
  yearCard("Bradford Bulls", "Terry Newton", 2009, "HOOKER", 87),
  yearCard("Bradford Bulls", "Steve Menzies", 2009, "SECOND_ROW", 88, "Australia"),
  yearCard("Bradford Bulls", "Paul Sykes", 2012, "CENTRE", 81),
  yearCard("Bradford Bulls", "Chev Walker", 2012, "CENTRE", 83),
  yearCard("Bradford Bulls", "Ben Jeffries", 2012, "STAND_OFF", 81),
  yearCard("Bradford Bulls", "Luke Gale", 2012, "SCRUM_HALF", 84),
  yearCard("Bradford Bulls", "Tom Burgess", 2012, "HOOKER", 78),
  yearCard("Bradford Bulls", "Matt Diskin", 2012, "HOOKER", 85),
  yearCard("Bradford Bulls", "Olivier Elima", 2012, "SECOND_ROW", 82, "France"),
  yearCard("Bradford Bulls", "John Bateman", 2012, "LOOSE_FORWARD", 77),
  // Leeds Rhinos
  yearCard("Leeds Rhinos", "Danny Williams", 2008, "WING", 83),
  yearCard("Leeds Rhinos", "Kallum Watkins", 2008, "CENTRE", 74),
  yearCard("Leeds Rhinos", "Gareth Ellis", 2008, "SECOND_ROW", 88),
  yearCard("Leeds Rhinos", "Ben Jones-Bishop", 2009, "FULLBACK", 80),
  yearCard("Leeds Rhinos", "Ryan Hall", 2009, "WING", 88),
  yearCard("Leeds Rhinos", "Kallum Watkins", 2009, "CENTRE", 78),
  yearCard("Leeds Rhinos", "Zak Hardaker", 2013, "FULLBACK", 88),
  yearCard("Leeds Rhinos", "Ryan Hall", 2013, "WING", 89),
  yearCard("Leeds Rhinos", "Ben Jones-Bishop", 2013, "WING", 83),
  yearCard("Leeds Rhinos", "Kallum Watkins", 2013, "CENTRE", 90),
  yearCard("Leeds Rhinos", "Liam Hood", 2013, "HOOKER", 79),
  yearCard("Leeds Rhinos", "Zak Hardaker", 2016, "FULLBACK", 90),
  yearCard("Leeds Rhinos", "Ash Handley", 2016, "WING", 83),
  yearCard("Leeds Rhinos", "Tom Briscoe", 2016, "WING", 84),
  yearCard("Leeds Rhinos", "Kallum Watkins", 2016, "CENTRE", 91),
  yearCard("Leeds Rhinos", "Brett Ferres", 2016, "SECOND_ROW", 84),
  yearCard("Leeds Rhinos", "Stevie Ward", 2016, "LOOSE_FORWARD", 83),
  // Hull FC
  yearCard("Hull FC", "Mark Calderwood", 2009, "WING", 82),
  yearCard("Hull FC", "Tom Briscoe", 2009, "CENTRE", 80),
  yearCard("Hull FC", "Craig Hall", 2009, "CENTRE", 79),
  yearCard("Hull FC", "Matty Russell", 2012, "FULLBACK", 80),
  yearCard("Hull FC", "Tom Lineham", 2012, "WING", 82),
  yearCard("Hull FC", "Reece Lyne", 2012, "WING", 78),
  yearCard("Hull FC", "Ben Crooks", 2012, "CENTRE", 80),
  yearCard("Hull FC", "Jordan Turner", 2012, "CENTRE", 84),
  yearCard("Hull FC", "Richard Horne", 2012, "STAND_OFF", 86),
  yearCard("Hull FC", "Andy Lynch", 2012, "PROP", 85),
  yearCard("Hull FC", "Richard Horne", 2013, "STAND_OFF", 85),
  yearCard("Hull FC", "Andy Lynch", 2013, "PROP", 84),
  yearCard("Hull FC", "Joe Westerman", 2012, "LOOSE_FORWARD", 84),
  yearCard("Hull FC", "Jamie Shaul", 2013, "FULLBACK", 78),
  yearCard("Hull FC", "Tom Lineham", 2013, "WING", 83),
  yearCard("Hull FC", "Tom Briscoe", 2013, "WING", 84),
  yearCard("Hull FC", "Ben Crooks", 2013, "CENTRE", 81),
  yearCard("Hull FC", "Daniel Holdsworth", 2013, "STAND_OFF", 82, "Australia"),
  yearCard("Hull FC", "Jacob Miller", 2013, "SCRUM_HALF", 79),
  yearCard("Hull FC", "Richard Horne", 2013, "STAND_OFF", 85),
  yearCard("Hull FC", "Andy Lynch", 2013, "PROP", 84),
  yearCard("Hull FC", "Gareth Ellis", 2013, "SECOND_ROW", 89),
  yearCard("Hull FC", "Paul Johnson", 2013, "SECOND_ROW", 83),
  // Wakefield
  yearCard("Wakefield Trinity", "Aaron Murphy", 2009, "WING", 76),
  // Wigan
  yearCard("Wigan Warriors", "Ryan Hampshire", 2015, "FULLBACK", 78),
  yearCard("Wigan Warriors", "Josh Charnley", 2015, "WING", 86),
  yearCard("Wigan Warriors", "Joe Burgess", 2015, "WING", 84),
  yearCard("Wigan Warriors", "Oliver Gildart", 2015, "CENTRE", 79),
  yearCard("Wigan Warriors", "George Williams", 2015, "STAND_OFF", 82),
  yearCard("Wigan Warriors", "Ryan Sutton", 2015, "PROP", 77),
  yearCard("Wigan Warriors", "Liam Farrell", 2015, "SECOND_ROW", 87),
  yearCard("Wigan Warriors", "Josh Charnley", 2016, "WING", 87),
  yearCard("Wigan Warriors", "Oliver Gildart", 2016, "CENTRE", 80),
  yearCard("Wigan Warriors", "Dan Sarginson", 2016, "CENTRE", 82),
  yearCard("Wigan Warriors", "George Williams", 2016, "STAND_OFF", 84),
  yearCard("Wigan Warriors", "Ryan Sutton", 2016, "PROP", 78),
  yearCard("Wigan Warriors", "Joe Bretherton", 2016, "PROP", 76),
  yearCard("Wigan Warriors", "Liam Farrell", 2016, "SECOND_ROW", 88),
  // Warrington
  yearCard("Warrington Wolves", "Matty Russell", 2015, "FULLBACK", 82),
  yearCard("Warrington Wolves", "Kevin Penny", 2015, "WING", 80),
  yearCard("Warrington Wolves", "Toby King", 2015, "CENTRE", 81),
  yearCard("Warrington Wolves", "Stefan Ratchford", 2015, "STAND_OFF", 85),
  yearCard("Warrington Wolves", "Gareth O'Brien", 2015, "SCRUM_HALF", 79),
  yearCard("Warrington Wolves", "Chris Hill", 2015, "PROP", 87),
  yearCard("Warrington Wolves", "Anthony England", 2015, "PROP", 80),
  yearCard("Warrington Wolves", "Daryl Clark", 2015, "SCRUM_HALF", 86),
  yearCard("Warrington Wolves", "Ben Currie", 2015, "LOOSE_FORWARD", 84),
  yearCard("Warrington Wolves", "Ben Harrison", 2015, "SECOND_ROW", 83),
  // St Helens 2015
  yearCard("St Helens", "Thomas Makinson", 2015, "FULLBACK", 86),
  yearCard("St Helens", "Adam Swift", 2015, "WING", 82),
  yearCard("St Helens", "Mark Percival", 2015, "CENTRE", 84),
  yearCard("St Helens", "Josh Jones", 2015, "CENTRE", 80),
  yearCard("St Helens", "Travis Burns", 2015, "STAND_OFF", 83, "Australia"),
  yearCard("St Helens", "Alex Walmsley", 2015, "PROP", 86),
  yearCard("St Helens", "Luke Thompson", 2015, "PROP", 82),
  yearCard("St Helens", "Jack Ashworth", 2015, "SECOND_ROW", 80),
  // Hull KR 2020
  yearCard("Hull KR", "Ben Crooks", 2020, "WING", 82),
  yearCard("Hull KR", "Greg Minikin", 2020, "CENTRE", 83),
  yearCard("Hull KR", "Jordan Abdull", 2020, "STAND_OFF", 84),
  yearCard("Hull KR", "Mikey Lewis", 2020, "SCRUM_HALF", 78),
  yearCard("Hull KR", "Robbie Mulhern", 2020, "PROP", 83),
  yearCard("Hull KR", "Mitch Garbutt", 2020, "PROP", 82),
  yearCard("Hull KR", "Jez Litten", 2020, "HOOKER", 80),
  yearCard("Hull KR", "Weller Hauraki", 2020, "SECOND_ROW", 81, "New Zealand"),
  yearCard("Hull KR", "Harvey Livett", 2020, "SECOND_ROW", 77),
  yearCard("Hull KR", "Dean Hadley", 2020, "LOOSE_FORWARD", 78),
  yearCard("Hull KR", "Will Dagger", 2020, "FULLBACK", 78),
  yearCard("Hull KR", "Kane Linnett", 2020, "CENTRE", 84),
  yearCard("Hull KR", "Shaun Kenny-Dowall", 2020, "CENTRE", 83, "New Zealand"),
];

const WIKIPEDIA_ID_REPLACEMENTS: Record<string, Record<string, Record<string, string>>> = {
  "Bradford Bulls": {
    "2006": {
      "warrington-hist-ryan-atkins": "bradford-hist-ryan-atkins-2006",
      "iestyn-harris": "bradford-hist-iestyn-harris-2006",
      "wigan-leg-terry-newton": "bradford-hist-terry-newton-2006",
      "castleford-hist-brett-ferres": "bradford-hist-brett-ferres-2006",
      "wigan-hist-paul-johnson": "bradford-hist-paul-johnson-2006",
      "sam-burgess": "bradford-hist-sam-burgess-2006",
    },
    "2009": {
      "wakefield-hist-semi-tadulala": "bradford-hist-semi-tadulala-2009",
      "wakefield-hist-paul-sykes": "bradford-hist-paul-sykes-2009",
      "huddersfield-hist-chris-nero": "bradford-hist-chris-nero-2009",
      "wakefield-hist-ben-jeffries": "bradford-hist-ben-jeffries-2009",
      "wigan-leg-terry-newton": "bradford-hist-terry-newton-2009",
      "catalans-hist-steve-menzies": "bradford-hist-steve-menzies-2009",
    },
    "2012": {
      "wakefield-hist-paul-sykes": "bradford-hist-paul-sykes-2012",
      "leeds-hist-chev-walker": "bradford-hist-chev-walker-2012",
      "wakefield-hist-ben-jeffries": "bradford-hist-ben-jeffries-2012",
      "luke-gale": "bradford-hist-luke-gale-2012",
      "huddersfield-cur-thomas-burgess": "bradford-hist-tom-burgess-2012",
      "leeds-hist-matt-diskin": "bradford-hist-matt-diskin-2012",
      "catalans-hist-olivier-elima": "bradford-hist-olivier-elima-2012",
      "wigan-hist-john-bateman": "bradford-hist-john-bateman-2012",
    },
  },
  "Leeds Rhinos": {
    "2008": {
      "leeds-cur-kallum-watkins": "leeds-hist-kallum-watkins-2008",
      "gareth-ellis": "leeds-hist-gareth-ellis-2008",
    },
    "2009": {
      "york-cur-ben-jones-bishop": "leeds-hist-ben-jones-bishop-2009",
      "leeds-cur-ryan-hall": "leeds-hist-ryan-hall-2009",
      "leeds-cur-kallum-watkins": "leeds-hist-kallum-watkins-2009",
    },
    "2013": {
      "hull-fc-cur-zak-hardaker": "leeds-hist-zak-hardaker-2013",
      "leeds-cur-ryan-hall": "leeds-hist-ryan-hall-2013",
      "york-cur-ben-jones-bishop": "leeds-hist-ben-jones-bishop-2013",
      "leeds-cur-kallum-watkins": "leeds-hist-kallum-watkins-2013",
      "castleford-cur-liam-hood": "leeds-hist-liam-hood-2013",
    },
    "2016": {
      "hull-fc-cur-zak-hardaker": "leeds-hist-zak-hardaker-2016",
      "leeds-cur-ash-handley": "leeds-hist-ash-handley-2016",
      "hull-fc-cur-tom-briscoe": "leeds-hist-tom-briscoe-2016",
      "leeds-cur-kallum-watkins": "leeds-hist-kallum-watkins-2016",
      "leeds-hist-stevie-ward": "leeds-hist-stevie-ward-2016",
    },
  },
  "Hull FC": {
    "2009": {
      "leeds-hist-mark-calderwood": "hull-fc-hist-mark-calderwood-2009",
      "hull-fc-cur-tom-briscoe": "hull-fc-hist-tom-briscoe-2009",
      "hull-kr-hist-craig-hall": "hull-fc-hist-craig-hall-2009",
    },
    "2012": {
      "york-cur-matty-russell": "hull-fc-hist-matty-russell-2012",
      "wakefield-hist-tom-lineham": "hull-fc-hist-tom-lineham-2012",
      "wakefield-hist-reece-lyne": "hull-fc-hist-reece-lyne-2012",
      "hull-kr-hist-ben-crooks": "hull-fc-hist-ben-crooks-2012",
      "st-helens-hist-jordan-turner": "hull-fc-hist-jordan-turner-2012",
      "richard-horne": "hull-fc-hist-richard-horne-2012",
      "andy-lynch": "hull-fc-hist-andy-lynch-2012",
      "castleford-cur-joe-westerman": "hull-fc-hist-joe-westerman-2012",
    },
    "2013": {
      "hull-fc-hist-jamie-shaul": "hull-fc-hist-jamie-shaul-2013",
      "wakefield-hist-tom-lineham": "hull-fc-hist-tom-lineham-2013",
      "hull-fc-cur-tom-briscoe": "hull-fc-hist-tom-briscoe-2013",
      "hull-kr-hist-ben-crooks": "hull-fc-hist-ben-crooks-2013",
      "salford-hist-daniel-holdsworth": "hull-fc-hist-daniel-holdsworth-2013",
      "wakefield-hist-jacob-miller": "hull-fc-hist-jacob-miller-2013",
      "richard-horne": "hull-fc-hist-richard-horne-2013",
      "andy-lynch": "hull-fc-hist-andy-lynch-2013",
      "gareth-ellis": "hull-fc-hist-gareth-ellis-2013",
      "wigan-hist-paul-johnson": "hull-fc-hist-paul-johnson-2013",
    },
  },
  "Wigan Warriors": {
    "2015": {
      "wakefield-hist-ryan-hampshire": "wigan-hist-ryan-hampshire-2015",
      "leigh-cur-josh-charnley": "wigan-hist-josh-charnley-2015",
      "hull-kr-cur-joe-burgess": "wigan-hist-joe-burgess-2015",
      "hull-kr-cur-oliver-gildart": "wigan-hist-oliver-gildart-2015",
      "warrington-cur-george-williams": "wigan-hist-george-williams-2015",
      "bradford-cur-ryan-sutton": "wigan-hist-ryan-sutton-2015",
      "wigan-cur-liam-farrell": "wigan-hist-liam-farrell-2015",
    },
    "2016": {
      "leigh-cur-josh-charnley": "wigan-hist-josh-charnley-2016",
      "hull-kr-cur-oliver-gildart": "wigan-hist-oliver-gildart-2016",
      "wigan-hist-dan-sarginson": "wigan-hist-dan-sarginson-2016",
      "warrington-cur-george-williams": "wigan-hist-george-williams-2016",
      "bradford-cur-ryan-sutton": "wigan-hist-ryan-sutton-2016",
      "toulouse-cur-joe-bretherton": "wigan-hist-joe-bretherton-2016",
      "wigan-cur-liam-farrell": "wigan-hist-liam-farrell-2016",
    },
  },
  "Warrington Wolves": {
    "2015": {
      "york-cur-matty-russell": "warrington-hist-matty-russell-2015",
      "wakefield-hist-kevin-penny": "warrington-hist-kevin-penny-2015",
      "warrington-cur-toby-king": "warrington-hist-toby-king-2015",
      "wakefield-leg-stefan-ratchford": "warrington-hist-stefan-ratchford-2015",
      "leigh-cur-gareth-obrien": "warrington-hist-gareth-o-brien-2015",
      "wakefield-hist-chris-hill": "warrington-hist-chris-hill-2015",
      "wakefield-hist-anthony-england": "warrington-hist-anthony-england-2015",
      "st-helens-cur-daryl-clark": "warrington-hist-daryl-clark-2015",
      "warrington-cur-ben-currie": "warrington-hist-ben-currie-2015",
      "wakefield-hist-ben-harrison": "warrington-hist-ben-harrison-2015",
    },
  },
  "St Helens": {
    "2015": {
      "catalans-cur-tommy-makinson": "st-helens-hist-thomas-makinson-2015",
      "huddersfield-cur-adam-swift": "st-helens-hist-adam-swift-2015",
      "st-helens-cur-mark-percival": "st-helens-hist-mark-percival-2015",
      "st-helens-hist-josh-jones": "st-helens-hist-josh-jones-2015",
      "hull-kr-hist-travis-burns": "st-helens-hist-travis-burns-2015",
      "st-helens-cur-alex-walmsley": "st-helens-hist-alex-walmsley-2015",
      "wigan-cur-luke-thompson": "st-helens-hist-luke-thompson-2015",
      "castleford-cur-jack-ashworth": "st-helens-hist-jack-ashworth-2015",
    },
  },
  "Hull KR": {
    "2020": {
      "hull-kr-hist-ben-crooks": "hull-kr-hist-ben-crooks-2020",
      "castleford-hist-greg-minikin": "hull-kr-hist-greg-minikin-2020",
      "hull-fc-hist-jordan-abdull": "hull-kr-hist-jordan-abdull-2020",
      "hull-kr-cur-mikey-lewis": "hull-kr-hist-mikey-lewis-2020",
      "leigh-cur-robbie-mulhern": "hull-kr-hist-robbie-mulhern-2020",
      "leeds-hist-mitch-garbutt": "hull-kr-hist-mitch-garbutt-2020",
      "hull-kr-cur-jez-litten": "hull-kr-hist-jez-litten-2020",
      "salford-hist-weller-hauraki": "hull-kr-hist-weller-hauraki-2020",
      "wakefield-hist-harvey-livett": "hull-kr-hist-harvey-livett-2020",
      "hull-kr-cur-dean-hadley": "hull-kr-hist-dean-hadley-2020",
      "york-cur-will-dagger": "hull-kr-hist-will-dagger-2020",
    },
  },
};

// Leeds 2008 — Danny Williams not in replacement map (no old id); patch by name index
const WIKIPEDIA_INDEX_REPLACEMENTS: Record<
  string,
  Record<string, Record<number, string>>
> = {
  "Leeds Rhinos": {
    "2008": {
      2: "leeds-hist-danny-williams-2008",
    },
  },
  "Wakefield Trinity": {
    "2009": {
      0: "wakefield-hist-aaron-murphy-2009",
    },
  },
};

const CAREER_SPAN_ADDITIONS: Record<string, string[]> = {
  "hull-fc-hist-danny-tickle": ["Widnes Vikings"],
  "st-helens-cur-matt-whitley": ["Widnes Vikings"],
  "wigan-hist-paul-johnson": ["Widnes Vikings"],
  "bradford-cur-joe-mellor": ["Widnes Vikings"],
  "bradford-hist-manase-manuokafoa": ["Widnes Vikings"],
  "kevin-brown": ["Widnes Vikings"],
  "hull-kr-hist-craig-hall": ["Hull FC"],
  "leeds-hist-mark-calderwood": ["Hull FC"],
  "richard-horne": ["Hull FC"],
  "andy-lynch": ["Hull FC", "Bradford Bulls"],
  "gareth-ellis": ["Hull FC", "Leeds Rhinos"],
};

function main(): void {
  const historicPath = join(DATA, "historic-players.json");
  const historic = JSON.parse(readFileSync(historicPath, "utf-8")) as Record<
    string,
    unknown
  >[];
  const existingIds = new Set(historic.map((p) => p.id as string));
  let added = 0;

  for (const spec of CARD_SPECS) {
    if (existingIds.has(spec.id)) continue;
    historic.push(makeCard(spec));
    existingIds.add(spec.id);
    added++;
  }

  writeFileSync(historicPath, `${JSON.stringify(historic, null, 2)}\n`);

  const spansPath = join(DATA, "club-career-spans.json");
  const spans = JSON.parse(readFileSync(spansPath, "utf-8")) as Record<
    string,
    string[]
  >;
  let spansAdded = 0;
  for (const [playerId, clubs] of Object.entries(CAREER_SPAN_ADDITIONS)) {
    const existing = new Set(spans[playerId] ?? []);
    for (const club of clubs) {
      if (!existing.has(club)) {
        existing.add(club);
        spansAdded++;
      }
    }
    spans[playerId] = [...existing];
  }
  writeFileSync(spansPath, `${JSON.stringify(spans, null, 2)}\n`);

  const wikiPath = join(DATA, "era-wikipedia-squads.json");
  const wiki = JSON.parse(readFileSync(wikiPath, "utf-8")) as Record<
    string,
    Record<string, { playerIds: string[] }>
  >;
  let wikiUpdates = 0;

  for (const [club, years] of Object.entries(WIKIPEDIA_ID_REPLACEMENTS)) {
    for (const [year, replacements] of Object.entries(years)) {
      const entry = wiki[club]?.[year];
      if (!entry?.playerIds) continue;
      entry.playerIds = entry.playerIds.map((id) => {
        const next = replacements[id];
        if (next) {
          wikiUpdates++;
          return next;
        }
        return id;
      });
    }
  }

  for (const [club, years] of Object.entries(WIKIPEDIA_INDEX_REPLACEMENTS)) {
    for (const [year, indices] of Object.entries(years)) {
      const entry = wiki[club]?.[year];
      if (!entry?.playerIds) continue;
      for (const [indexStr, newId] of Object.entries(indices)) {
        const index = Number(indexStr);
        if (entry.playerIds[index]) {
          entry.playerIds[index] = newId;
          wikiUpdates++;
        }
      }
    }
  }

  writeFileSync(wikiPath, `${JSON.stringify(wiki, null, 2)}\n`);

  console.log(`Added ${added} historic player cards`);
  console.log(`Updated ${spansAdded} club-career-span links`);
  console.log(`Updated ${wikiUpdates} era-wikipedia-squads player IDs`);
  console.log("Run: npm run build:team-year-rosters");
}

main();
