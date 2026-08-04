/**
 * Current Super League 90+ ability audit (schema version 1).
 * Decisions reflect 2025/2026 current ability — not historic peak reputation.
 */

export const CURRENT_NINETY_PLUS_AUDIT_VERSION = 1;

export type NinetyPlusAuditDecision = "remain" | "downgrade";

export interface CurrentNinetyPlusAuditEntry {
  playerId: string;
  name: string;
  club: string;
  oldRating: number;
  newRating: number;
  decision: NinetyPlusAuditDecision;
  justification: string;
}

export interface CurrentNinetyPlusAudit {
  version: number;
  entries: CurrentNinetyPlusAuditEntry[];
}

export const CURRENT_NINETY_PLUS_AUDIT: CurrentNinetyPlusAudit = {
  version: CURRENT_NINETY_PLUS_AUDIT_VERSION,
  entries: [
    {
      playerId: "wigan-cur-bevan-french",
      name: "Bevan French",
      club: "Wigan Warriors",
      oldRating: 96,
      newRating: 96,
      decision: "remain",
      justification:
        "Still the clearest elite playmaker in Super League — 2025/26 form and influence remain GOAT-adjacent.",
    },
    {
      playerId: "leeds-cur-jake-connor",
      name: "Jake Connor",
      club: "Leeds Rhinos",
      oldRating: 96,
      newRating: 96,
      decision: "remain",
      justification:
        "Continues to drive Leeds attack with elite kicking, distribution and game management.",
    },
    {
      playerId: "wigan-cur-jai-field",
      name: "Jai Field",
      club: "Wigan Warriors",
      oldRating: 95,
      newRating: 95,
      decision: "remain",
      justification:
        "Elite fullback speed and strike remain unmatched; still a genuine 90+ difference-maker.",
    },
    {
      playerId: "wigan-cur-liam-marshall",
      name: "Liam Marshall",
      club: "Wigan Warriors",
      oldRating: 95,
      newRating: 95,
      decision: "remain",
      justification:
        "Proven elite finisher and consistent try threat at the top of the competition.",
    },
    {
      playerId: "wigan-cur-liam-farrell",
      name: "Liam Farrell",
      club: "Wigan Warriors",
      oldRating: 95,
      newRating: 90,
      decision: "remain",
      justification:
        "Aging but still elite when selected for champions; trim from inflated 95 while keeping true 90+ ability.",
    },
    {
      playerId: "st-helens-cur-daryl-clark",
      name: "Daryl Clark",
      club: "St Helens",
      oldRating: 95,
      newRating: 86,
      decision: "downgrade",
      justification:
        "High-class veteran hooker, but 95 was reputation inflation — current ability is strong squad, not world-class.",
    },
    {
      playerId: "hull-fc-cur-zak-hardaker",
      name: "Zak Hardaker",
      club: "Hull FC",
      oldRating: 95,
      newRating: 85,
      decision: "downgrade",
      justification:
        "Peak years (Leeds Man of Steel era) are historic; 2025/26 Hull FC centre role is solid senior depth, not a 95. Historic year-cards unchanged.",
    },
    {
      playerId: "hull-kr-cur-mikey-lewis",
      name: "Mikey Lewis",
      club: "Hull KR",
      oldRating: 94,
      newRating: 94,
      decision: "remain",
      justification:
        "Man-of-Steel calibre half — still the standout creative force at Hull KR.",
    },
    {
      playerId: "hull-kr-cur-dean-hadley",
      name: "Dean Hadley",
      club: "Hull KR",
      oldRating: 94,
      newRating: 85,
      decision: "downgrade",
      justification:
        "Excellent club servant and leader, but not a true 90+ athlete on current ability standards.",
    },
    {
      playerId: "hull-kr-cur-peta-hiku",
      name: "Peta Hiku",
      club: "Hull KR",
      oldRating: 94,
      newRating: 86,
      decision: "downgrade",
      justification:
        "Quality centre with NRL pedigree, yet 94 overstates 2025/26 Super League current ability.",
    },
    {
      playerId: "catalans-cur-tommy-makinson",
      name: "Tommy Makinson",
      club: "Catalans Dragons",
      oldRating: 94,
      newRating: 85,
      decision: "downgrade",
      justification:
        "Past his Saints peak; Catalans form is useful but no longer elite 90+.",
    },
    {
      playerId: "wakefield-cur-mike-mcmeeken",
      name: "Mike McMeeken",
      club: "Wakefield Trinity",
      oldRating: 94,
      newRating: 86,
      decision: "downgrade",
      justification:
        "Reliable pack leader for Trinity, not a league-wide 94-rated elite.",
    },
    {
      playerId: "york-cur-paul-mcshane",
      name: "Paul McShane",
      club: "York Knights",
      oldRating: 94,
      newRating: 82,
      decision: "downgrade",
      justification:
        "Championship/veteran profile — reputation from Castleford peak should not keep a 94 current card.",
    },
    {
      playerId: "st-helens-cur-mark-percival",
      name: "Mark Percival",
      club: "St Helens",
      oldRating: 93,
      newRating: 93,
      decision: "remain",
      justification:
        "When fit remains an elite Super League centre — keep genuine 90+.",
    },
    {
      playerId: "st-helens-cur-jack-welsby",
      name: "Jack Welsby",
      club: "St Helens",
      oldRating: 93,
      newRating: 93,
      decision: "remain",
      justification:
        "Still among the best young fullbacks/playmakers in the competition.",
    },
    {
      playerId: "st-helens-cur-alex-walmsley",
      name: "Alex Walmsley",
      club: "St Helens",
      oldRating: 93,
      newRating: 93,
      decision: "remain",
      justification:
        "Dominant front-rower when available; current ability still supports 90+.",
    },
    {
      playerId: "st-helens-cur-jonny-lomax",
      name: "Jonny Lomax",
      club: "St Helens",
      oldRating: 93,
      newRating: 85,
      decision: "downgrade",
      justification:
        "Aging half whose peak Saints years are behind him — strong mentor, not 93 current.",
    },
    {
      playerId: "wigan-cur-luke-thompson",
      name: "Luke Thompson",
      club: "Wigan Warriors",
      oldRating: 93,
      newRating: 93,
      decision: "remain",
      justification:
        "Elite prop output for Wigan remains clearly 90+ standard.",
    },
    {
      playerId: "wigan-cur-jake-wardle",
      name: "Jake Wardle",
      club: "Wigan Warriors",
      oldRating: 93,
      newRating: 93,
      decision: "remain",
      justification:
        "Top-tier centre for champions with consistent elite carries and defence.",
    },
    {
      playerId: "hull-kr-cur-elliot-minchella",
      name: "Elliot Minchella",
      club: "Hull KR",
      oldRating: 93,
      newRating: 93,
      decision: "remain",
      justification:
        "Captain and engine of a title-contending pack — still merits 90+.",
    },
    {
      playerId: "leeds-cur-james-mcdonnell",
      name: "James McDonnell",
      club: "Leeds Rhinos",
      oldRating: 93,
      newRating: 87,
      decision: "downgrade",
      justification:
        "Very good second-rower, but 93 was ahead of sustained elite evidence.",
    },
    {
      playerId: "leeds-cur-brodie-croft",
      name: "Brodie Croft",
      club: "Leeds Rhinos",
      oldRating: 93,
      newRating: 87,
      decision: "downgrade",
      justification:
        "Solid halfback option; not consistently operating at true 90+ Super League elite.",
    },
    {
      playerId: "hull-fc-cur-lewis-martin",
      name: "Lewis Martin",
      club: "Hull FC",
      oldRating: 93,
      newRating: 87,
      decision: "downgrade",
      justification:
        "Exciting young wing with upside — current ability is high-80s, not locked-in 93.",
    },
    {
      playerId: "wigan-cur-junior-nsemba",
      name: "Junior Nsemba",
      club: "Wigan Warriors",
      oldRating: 92,
      newRating: 92,
      decision: "remain",
      justification:
        "Rising elite edge forward already producing genuine 90+ minutes.",
    },
    {
      playerId: "hull-kr-cur-jez-litten",
      name: "Jez Litten",
      club: "Hull KR",
      oldRating: 92,
      newRating: 92,
      decision: "remain",
      justification:
        "Elite hooker form for Hull KR — service and dummy-half threat stay 90+.",
    },
    {
      playerId: "leeds-cur-ash-handley",
      name: "Ash Handley",
      club: "Leeds Rhinos",
      oldRating: 92,
      newRating: 92,
      decision: "remain",
      justification:
        "Long-term elite finisher; still a clear 90+ wing/centre threat.",
    },
    {
      playerId: "hull-kr-cur-joe-burgess",
      name: "Joe Burgess",
      club: "Hull KR",
      oldRating: 92,
      newRating: 84,
      decision: "downgrade",
      justification:
        "Experienced wing whose best years are past — solid, not 92 current.",
    },
    {
      playerId: "warrington-cur-ben-currie",
      name: "Ben Currie",
      club: "Warrington Wolves",
      oldRating: 92,
      newRating: 86,
      decision: "downgrade",
      justification:
        "Quality back-rower aging out of true elite tier.",
    },
    {
      playerId: "hull-fc-cur-herman-eseese",
      name: "Herman Ese'ese",
      club: "Hull FC",
      oldRating: 92,
      newRating: 90,
      decision: "remain",
      justification:
        "Powerful front-rower still producing elite minutes; trim only the soft inflation above 90.",
    },
    {
      playerId: "st-helens-cur-matty-lees",
      name: "Matty Lees",
      club: "St Helens",
      oldRating: 91,
      newRating: 91,
      decision: "remain",
      justification:
        "High-work-rate elite prop standard remains intact.",
    },
    {
      playerId: "hull-kr-cur-tom-amone",
      name: "Tom Amone",
      club: "Hull KR",
      oldRating: 91,
      newRating: 91,
      decision: "remain",
      justification:
        "Impact prop for contenders — current ability supports 90+.",
    },
    {
      playerId: "hull-kr-cur-tom-davies",
      name: "Tom Davies",
      club: "Hull KR",
      oldRating: 91,
      newRating: 85,
      decision: "downgrade",
      justification:
        "Useful finisher, but not a consistent 90+ elite wing by 2025/26 standards.",
    },
    {
      playerId: "wakefield-cur-tom-johnstone",
      name: "Tom Johnstone",
      club: "Wakefield Trinity",
      oldRating: 91,
      newRating: 91,
      decision: "remain",
      justification:
        "When fit remains one of the competition's elite strike wings.",
    },
    {
      playerId: "warrington-cur-marc-sneyd",
      name: "Marc Sneyd",
      club: "Warrington Wolves",
      oldRating: 91,
      newRating: 91,
      decision: "remain",
      justification:
        "Elite kicking and control still mark him as a true 90+ half.",
    },
    {
      playerId: "warrington-cur-toby-king",
      name: "Toby King",
      club: "Warrington Wolves",
      oldRating: 91,
      newRating: 91,
      decision: "remain",
      justification:
        "Consistent high-level centre with international-quality defence and carry.",
    },
    {
      playerId: "warrington-cur-matty-ashton",
      name: "Matty Ashton",
      club: "Warrington Wolves",
      oldRating: 91,
      newRating: 91,
      decision: "remain",
      justification:
        "Elite pace and finishing keep him firmly in the 90+ band.",
    },
    {
      playerId: "huddersfield-cur-niall-evalds",
      name: "Niall Evalds",
      club: "Huddersfield Giants",
      oldRating: 91,
      newRating: 85,
      decision: "downgrade",
      justification:
        "Capable fullback on a rebuilding side — reputation exceeds current 90+ case.",
    },
    {
      playerId: "leigh-cur-edwin-ipape",
      name: "Edwin Ipape",
      club: "Leigh Leopards",
      oldRating: 91,
      newRating: 91,
      decision: "remain",
      justification:
        "Dynamic elite hooker whose current form still justifies 90+.",
    },
    {
      playerId: "leigh-cur-lachlan-lam",
      name: "Lachlan Lam",
      club: "Leigh Leopards",
      oldRating: 91,
      newRating: 91,
      decision: "remain",
      justification:
        "Creative half still operating at genuine star level for Leigh.",
    },
    {
      playerId: "leigh-cur-umyla-hanley",
      name: "Umyla Hanley",
      club: "Leigh Leopards",
      oldRating: 91,
      newRating: 85,
      decision: "downgrade",
      justification:
        "Promising outside back — not yet proven as a locked-in 90+ elite.",
    },
    {
      playerId: "hull-fc-cur-joe-batchelor",
      name: "Joe Batchelor",
      club: "Hull FC",
      oldRating: 91,
      newRating: 84,
      decision: "downgrade",
      justification:
        "Solid second-rower; 91 overstated current ability versus true elites.",
    },
    {
      playerId: "york-cur-paul-vaughan",
      name: "Paul Vaughan",
      club: "York Knights",
      oldRating: 91,
      newRating: 80,
      decision: "downgrade",
      justification:
        "Championship veteran — prior NRL/SL reputation should not keep a 91 current rating.",
    },
    {
      playerId: "wigan-cur-adam-keighran",
      name: "Adam Keighran",
      club: "Wigan Warriors",
      oldRating: 90,
      newRating: 90,
      decision: "remain",
      justification:
        "Versatile elite utility still delivering 90-level impact for Wigan.",
    },
    {
      playerId: "hull-kr-cur-oliver-gildart",
      name: "Oliver Gildart",
      club: "Hull KR",
      oldRating: 90,
      newRating: 84,
      decision: "downgrade",
      justification:
        "Depth centre with past highs — current ability sits in the mid-80s.",
    },
    {
      playerId: "leeds-cur-mikolaj-oledzki",
      name: "Mikolaj Oledzki",
      club: "Leeds Rhinos",
      oldRating: 90,
      newRating: 90,
      decision: "remain",
      justification:
        "England-calibre prop still meeting the 90+ current bar.",
    },
    {
      playerId: "warrington-cur-george-williams",
      name: "George Williams",
      club: "Warrington Wolves",
      oldRating: 90,
      newRating: 90,
      decision: "remain",
      justification:
        "International half still producing star-level control and creativity.",
    },
    {
      playerId: "st-helens-cur-curtis-sironen",
      name: "Curtis Sironen",
      club: "St Helens",
      oldRating: 90,
      newRating: 85,
      decision: "downgrade",
      justification:
        "Useful edge forward, but not a clear 90+ standout on 2025/26 form.",
    },
    {
      playerId: "huddersfield-cur-joe-greenwood",
      name: "Joe Greenwood",
      club: "Huddersfield Giants",
      oldRating: 90,
      newRating: 83,
      decision: "downgrade",
      justification:
        "Experienced pack man on a lower-ranked side — reputation-only 90.",
    },
    {
      playerId: "huddersfield-cur-adam-swift",
      name: "Adam Swift",
      club: "Huddersfield Giants",
      oldRating: 90,
      newRating: 83,
      decision: "downgrade",
      justification:
        "Veteran wing whose peak try-scoring years no longer justify 90 current.",
    },
    {
      playerId: "leigh-cur-kai-o-donnell",
      name: "Kai O'Donnell",
      club: "Leigh Leopards",
      oldRating: 90,
      newRating: 84,
      decision: "downgrade",
      justification:
        "Competent second-rower; 90 was ahead of sustained elite evidence.",
    },
  ],
};

export const CURRENT_NINETY_PLUS_AUDIT_BY_ID: Readonly<
  Record<string, CurrentNinetyPlusAuditEntry>
> = Object.fromEntries(
  CURRENT_NINETY_PLUS_AUDIT.entries.map((e) => [e.playerId, e])
);
