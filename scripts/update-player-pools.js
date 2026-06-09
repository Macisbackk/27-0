const fs = require("fs");

function slug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function makePlayer({ idPrefix, name, position, club, nationality, rating }) {
  return {
    id: `${idPrefix}-${slug(name)}`,
    name,
    position,
    club,
    nationality,
    era: "CONTEMPORARY_ERA",
    yearsActive: "2024–Present",
    category: "current",
    peakRating: rating,
    value: 0,
    intlCaps: 0,
  };
}

const legends = JSON.parse(fs.readFileSync("data/legends.json", "utf8"));
const removeIds = new Set([
  "daryl-clark",
  "jermaine-mcgillvary",
  "josh-charnley",
  "ryan-hall",
]);
const filteredLegends = legends.filter((p) => !removeIds.has(p.id));
fs.writeFileSync("data/legends.json", JSON.stringify(filteredLegends, null, 2) + "\n");

const cur = JSON.parse(fs.readFileSync("data/current-squads.json", "utf8"));

const yorkRoster = [
  ["Toa Mata'afa", "FULLBACK", "New Zealand", 84],
  ["Ben Jones-Bishop", "WING", "England", 80],
  ["Jordan Lipp", "CENTRE", "England", 78],
  ["Sam Wood", "CENTRE", "England", 77],
  ["Scott Galeano", "WING", "Australia", 79],
  ["Ata Hingano", "STAND_OFF", "New Zealand", 81],
  ["Liam Harris", "SCRUM_HALF", "England", 83],
  ["Jack Martin", "PROP", "England", 80],
  ["Paul McShane", "HOOKER", "England", 82],
  ["Paul Vaughan", "PROP", "Australia", 85],
  ["Josh Griffin", "SECOND_ROW", "England", 81],
  ["Jesse Dee", "SECOND_ROW", "England", 79],
  ["Jordan Thompson", "LOOSE_FORWARD", "England", 80],
  ["Denive Balmforth", "HOOKER", "England", 76],
  ["Xavier Va'a", "PROP", "New Zealand", 75],
  ["Justin Sangare", "PROP", "France", 77],
  ["Kieran Hudson", "SECOND_ROW", "England", 76],
  ["Danny Richardson", "STAND_OFF", "England", 78],
  ["Oli Field", "SCRUM_HALF", "England", 75],
  ["Kieran Buchanan", "CENTRE", "Scotland", 77],
  ["John Sagaga", "WING", "Australia", 76],
  ["Jon Bennison", "STAND_OFF", "England", 74],
  ["Will Dagger", "FULLBACK", "England", 75],
  ["Jack Smith", "LOOSE_FORWARD", "England", 74],
  ["Nikau Williams", "WING", "New Zealand", 75],
  ["Matty Foster", "SECOND_ROW", "England", 74],
];

const toulouseRoster = [
  ["Olly Ashall-Bott", "FULLBACK", "England", 82],
  ["Paul Ulberg", "WING", "Cook Islands", 80],
  ["Reubenn Rennie", "CENTRE", "Cook Islands", 79],
  ["Paul Marcon", "CENTRE", "France", 78],
  ["Benjamin Laguerre", "WING", "France", 77],
  ["Thomas Lacans", "STAND_OFF", "France", 80],
  ["Jake Shorrocks", "SCRUM_HALF", "England", 83],
  ["Lambert Belmas", "PROP", "France", 79],
  ["Brendan Hands", "HOOKER", "Australia", 78],
  ["James Roumanos", "PROP", "Australia", 77],
  ["Maxime Stefani", "SECOND_ROW", "France", 80],
  ["Mathieu Jussaume", "SECOND_ROW", "France", 79],
  ["Anthony Marion", "LOOSE_FORWARD", "France", 81],
  ["Calum Gahan", "HOOKER", "Scotland", 76],
  ["Joe Cator", "SECOND_ROW", "England", 82],
  ["Joe Bretherton", "PROP", "England", 78],
  ["Rob Butler", "PROP", "England", 77],
  ["Baptiste Rodriguez", "LOOSE_FORWARD", "France", 75],
  ["Romeo Tropis", "STAND_OFF", "France", 76],
  ["AJ Wallace", "WING", "Jamaica", 77],
  ["Ellis Gillam", "SECOND_ROW", "England", 75],
  ["Henry O'Kane", "PROP", "Ireland", 76],
  ["Tyler Dupree", "PROP", "England", 84],
  ["Pierre-Jean Lima", "LOOSE_FORWARD", "France", 74],
  ["Luke Polselli", "CENTRE", "Italy", 76],
  ["Trevor Chiffolleau", "SECOND_ROW", "France", 74],
];

const yorkPlayers = yorkRoster.map(([name, position, nationality, rating]) =>
  makePlayer({
    idPrefix: "york-cur",
    name,
    position,
    club: "York Knights",
    nationality,
    rating,
  })
);

const toulousePlayers = toulouseRoster.map(
  ([name, position, nationality, rating]) =>
    makePlayer({
      idPrefix: "toulouse-cur",
      name,
      position,
      club: "Toulouse Olympique",
      nationality,
      rating,
    })
);

const merged = [...cur, ...yorkPlayers, ...toulousePlayers];
fs.writeFileSync(
  "data/current-squads.json",
  JSON.stringify(merged, null, 2) + "\n"
);

console.log(
  JSON.stringify({
    legendsRemoved: legends.length - filteredLegends.length,
    yorkAdded: yorkPlayers.length,
    toulouseAdded: toulousePlayers.length,
    totalCurrent: merged.length,
  })
);
