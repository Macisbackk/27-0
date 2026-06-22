import type { Position } from "../../src/lib/types";

/** Year-card overrides: id → base player + season-specific fields. */
export type YearCardOverride = {
  baseId: string;
  club: string;
  position: Position;
  rating?: number;
  nationality?: string;
  appearances?: number;
  tries?: number;
  superLeagueWinner?: boolean;
  challengeCupWinner?: boolean;
  manOfSteel?: boolean;
  dreamTeamYears?: number[];
};

export const YEAR_CARD_OVERRIDES: Record<string, YearCardOverride> = {
  "catalans-hist-thomas-bosc-2008": { baseId: "thomas-bosc", club: "Catalans Dragons", position: "STAND_OFF", rating: 82 },
  "catalans-hist-stacey-jones-2008": { baseId: "catalans-hist-stacey-jones", club: "Catalans Dragons", position: "SCRUM_HALF", rating: 81 },
  "catalans-hist-gregory-mounis-2008": { baseId: "catalans-hist-gregory-mounis", club: "Catalans Dragons", position: "LOOSE_FORWARD", rating: 80 },

  "leeds-cur-zak-hardaker-2015": { baseId: "hull-fc-cur-zak-hardaker", club: "Leeds Rhinos", position: "FULLBACK", rating: 88, superLeagueWinner: true, challengeCupWinner: true },
  "leeds-cur-ash-handley-2015": { baseId: "leeds-cur-ash-handley", club: "Leeds Rhinos", position: "WING", rating: 82, superLeagueWinner: true },
  "leeds-cur-tom-briscoe-2015": { baseId: "hull-fc-cur-tom-briscoe", club: "Leeds Rhinos", position: "WING", rating: 84, superLeagueWinner: true, challengeCupWinner: true },
  "leeds-cur-kallum-watkins-2015": { baseId: "leeds-cur-kallum-watkins", club: "Leeds Rhinos", position: "CENTRE", rating: 90, superLeagueWinner: true, challengeCupWinner: true },
  "leeds-hist-joel-moon-2015": { baseId: "leeds-hist-joel-moon", club: "Leeds Rhinos", position: "CENTRE", rating: 86, superLeagueWinner: true, challengeCupWinner: true },
  "leeds-hist-danny-mcguire-2015": { baseId: "danny-mcguire", club: "Leeds Rhinos", position: "STAND_OFF", rating: 91, superLeagueWinner: true, challengeCupWinner: true },
  "leeds-leg-rob-burrow-2015": { baseId: "rob-burrow", club: "Leeds Rhinos", position: "SCRUM_HALF", rating: 88, superLeagueWinner: true, challengeCupWinner: true },
  "leeds-leg-jamie-peacock-2015": { baseId: "jamie-peacock", club: "Leeds Rhinos", position: "PROP", rating: 90, superLeagueWinner: true, challengeCupWinner: true },
  "leeds-hist-kylie-leuluai-2015": { baseId: "kylie-leuluai", club: "Leeds Rhinos", position: "PROP", rating: 89, superLeagueWinner: true, challengeCupWinner: true },
  "leeds-hist-paul-aiton-2015": { baseId: "wakefield-hist-paul-aiton", club: "Leeds Rhinos", position: "HOOKER", rating: 83, superLeagueWinner: true, challengeCupWinner: true },
  "leeds-leg-jamie-jones-buchanan-2015": { baseId: "jamie-jones-buchanan", club: "Leeds Rhinos", position: "SECOND_ROW", rating: 87, superLeagueWinner: true, challengeCupWinner: true },
  "leeds-hist-brett-delaney-2015": { baseId: "leeds-hist-brett-delaney", club: "Leeds Rhinos", position: "SECOND_ROW", rating: 84, superLeagueWinner: true, challengeCupWinner: true },
  "leeds-leg-kevin-sinfield-2015": { baseId: "kevin-sinfield", club: "Leeds Rhinos", position: "LOOSE_FORWARD", rating: 93, superLeagueWinner: true, challengeCupWinner: true },

  "london-hist-alex-walker-2018": { baseId: "london-hist-alex-walker", club: "London Broncos", position: "FULLBACK", rating: 78 },
  "london-hist-rhys-williams-2018": { baseId: "salford-hist-rhys-williams", club: "London Broncos", position: "WING", rating: 77 },
  "london-hist-kieran-dixon-2018": { baseId: "london-hist-kieran-dixon", club: "London Broncos", position: "WING", rating: 79 },
  "london-hist-ben-hellewell-2018": { baseId: "salford-cur-ben-hellewell", club: "London Broncos", position: "CENTRE", rating: 80 },
  "london-hist-elliot-kear-2018": { baseId: "bradford-hist-elliot-kear", club: "London Broncos", position: "CENTRE", rating: 79 },
  "london-hist-jarrod-sammut-2018": { baseId: "bradford-hist-jarrod-sammut", club: "London Broncos", position: "SCRUM_HALF", rating: 81 },
  "london-hist-eddie-battye-2018": { baseId: "wakefield-hist-eddie-battye", club: "London Broncos", position: "PROP", rating: 78 },
  "london-hist-mark-ioane-2018": { baseId: "london-hist-mark-ioane", club: "London Broncos", position: "PROP", rating: 79 },
  "london-hist-eloi-pelissier-2018": { baseId: "catalans-hist-eloi-pelissier", club: "London Broncos", position: "HOOKER", rating: 77 },
  "london-hist-jay-pitts-2018": { baseId: "wakefield-cur-jay-pitts", club: "London Broncos", position: "SECOND_ROW", rating: 80 },
  "london-hist-will-lovell-2018": { baseId: "london-hist-will-lovell", club: "London Broncos", position: "SECOND_ROW", rating: 78 },
  "london-hist-sadiq-adebiyi-2018": { baseId: "london-hist-sadiq-adebiyi", club: "London Broncos", position: "LOOSE_FORWARD", rating: 79 },

  "salford-hist-niall-evalds-2015": { baseId: "huddersfield-cur-niall-evalds", club: "Salford Red Devils", position: "FULLBACK", rating: 80 },
  "salford-hist-ben-jones-bishop-2015": { baseId: "york-cur-ben-jones-bishop", club: "Salford Red Devils", position: "WING", rating: 82 },
  "salford-hist-greg-johnson-2015": { baseId: "salford-hist-greg-johnson", club: "Salford Red Devils", position: "WING", rating: 79 },
  "salford-hist-oliver-gildart-2015": { baseId: "hull-kr-cur-oliver-gildart", club: "Salford Red Devils", position: "CENTRE", rating: 78 },
  "salford-hist-iain-thornley-2015": { baseId: "wigan-hist-iain-thornley", club: "Salford Red Devils", position: "CENTRE", rating: 79 },
  "salford-hist-rangi-chase-2015": { baseId: "rangi-chase", club: "Salford Red Devils", position: "STAND_OFF", rating: 84 },
  "salford-hist-josh-wood-2015": { baseId: "salford-hist-josh-wood", club: "Salford Red Devils", position: "SCRUM_HALF", rating: 78 },
  "salford-hist-olsi-krasniqi-2015": { baseId: "london-hist-olsi-krasniqi", club: "Salford Red Devils", position: "PROP", rating: 80 },
  "salford-hist-adrian-morley-2015": { baseId: "adrian-morley", club: "Salford Red Devils", position: "PROP", rating: 86 },
  "salford-hist-liam-hood-2015": { baseId: "castleford-cur-liam-hood", club: "Salford Red Devils", position: "HOOKER", rating: 79 },
  "salford-hist-jake-bibby-2015": { baseId: "huddersfield-cur-jake-bibby", club: "Salford Red Devils", position: "SECOND_ROW", rating: 78 },
  "salford-hist-reni-maitua-2015": { baseId: "salford-hist-reni-maitua", club: "Salford Red Devils", position: "SECOND_ROW", rating: 82 },
  "salford-hist-james-greenwood-2015": { baseId: "hull-kr-hist-james-greenwood", club: "Salford Red Devils", position: "LOOSE_FORWARD", rating: 80 },

  "wakefield-hist-matt-blaymire-2009": { baseId: "wakefield-hist-matt-blaymire", club: "Wakefield Trinity", position: "FULLBACK", rating: 79 },
  "wakefield-hist-luke-george-2009": { baseId: "wakefield-hist-luke-george", club: "Wakefield Trinity", position: "WING", rating: 78 },
  "wakefield-hist-damien-blanch-2009": { baseId: "wakefield-hist-damien-blanch", club: "Wakefield Trinity", position: "WING", rating: 80 },
  "wakefield-hist-aaron-murphy-2009": { baseId: "huddersfield-leg-aaron-murphy", club: "Wakefield Trinity", position: "CENTRE", rating: 81 },
  "wakefield-hist-ryan-atkins-2009": { baseId: "warrington-hist-ryan-atkins", club: "Wakefield Trinity", position: "CENTRE", rating: 82 },
  "wakefield-hist-jamie-rooney-2009": { baseId: "wakefield-hist-jamie-rooney", club: "Wakefield Trinity", position: "STAND_OFF", rating: 80 },
  "wakefield-hist-danny-brough-2009": { baseId: "danny-brough", club: "Wakefield Trinity", position: "SCRUM_HALF", rating: 84 },
  "wakefield-hist-danny-sculthorpe-2009": { baseId: "wigan-hist-danny-sculthorpe", club: "Wakefield Trinity", position: "PROP", rating: 81 },
  "wakefield-hist-ricky-bibey-2009": { baseId: "wakefield-hist-ricky-bibey", club: "Wakefield Trinity", position: "PROP", rating: 79 },
  "wakefield-hist-sam-obst-2009": { baseId: "wakefield-hist-sam-obst", club: "Wakefield Trinity", position: "HOOKER", rating: 80 },
  "wakefield-hist-steve-snitch-2009": { baseId: "wakefield-hist-steve-snitch", club: "Wakefield Trinity", position: "SECOND_ROW", rating: 78 },
  "wakefield-hist-oliver-wilkes-2009": { baseId: "wakefield-hist-oliver-wilkes", club: "Wakefield Trinity", position: "SECOND_ROW", rating: 83 },

  "wigan-hist-mark-calderwood-2006": { baseId: "leeds-leg-mark-calderwood", club: "Wigan Warriors", position: "WING", rating: 82 },
  "wigan-hist-brett-dallas-2006": { baseId: "wigan-hist-brett-dallas", club: "Wigan Warriors", position: "WING", rating: 80 },
  "wigan-hist-pat-richards-2006": { baseId: "pat-richards", club: "Wigan Warriors", position: "CENTRE", rating: 85 },
  "wigan-hist-sean-gleeson-2006": { baseId: "wakefield-hist-sean-gleeson", club: "Wigan Warriors", position: "CENTRE", rating: 79 },
  "wigan-hist-kevin-brown-2006": { baseId: "kevin-brown", club: "Wigan Warriors", position: "STAND_OFF", rating: 81 },
  "wigan-hist-dennis-moran-2006": { baseId: "london-hist-dennis-moran", club: "Wigan Warriors", position: "SCRUM_HALF", rating: 80 },
  "wigan-hist-stuart-fielden-2006": { baseId: "stuart-fielden", club: "Wigan Warriors", position: "PROP", rating: 87 },
  "wigan-hist-scott-logan-2006": { baseId: "hull-fc-hist-scott-logan", club: "Wigan Warriors", position: "PROP", rating: 80 },
  "wigan-hist-michael-mcilorum-2006": { baseId: "wigan-hist-michael-mcilorum", club: "Wigan Warriors", position: "HOOKER", rating: 78 },
  "wigan-hist-mickey-higham-2006": { baseId: "warrington-hist-mickey-higham", club: "Wigan Warriors", position: "SECOND_ROW", rating: 84 },
  "wigan-hist-gareth-hock-2006": { baseId: "salford-hist-gareth-hock", club: "Wigan Warriors", position: "SECOND_ROW", rating: 82 },
  "wigan-hist-sean-oloughlin-2006": { baseId: "sean-oloughlin", club: "Wigan Warriors", position: "LOOSE_FORWARD", rating: 90 },

  "wigan-hist-richie-mathers-2008": { baseId: "leeds-hist-richard-mathers", club: "Wigan Warriors", position: "FULLBACK", rating: 82 },
  "wigan-hist-pat-richards-2008": { baseId: "pat-richards", club: "Wigan Warriors", position: "WING", rating: 86 },
  "wigan-hist-trent-barrett-2008": { baseId: "wigan-hist-trent-barrett", club: "Wigan Warriors", position: "WING", rating: 83 },
  "wigan-hist-karl-pryce-2008": { baseId: "bradford-hist-karl-pryce", club: "Wigan Warriors", position: "CENTRE", rating: 80 },
  "wigan-hist-cameron-phelps-2008": { baseId: "widnes-hist-cameron-phelps", club: "Wigan Warriors", position: "CENTRE", rating: 79 },
  "wigan-hist-sam-tomkins-2008": { baseId: "wigan-hist-sam-tomkins", club: "Wigan Warriors", position: "STAND_OFF", rating: 78 },
  "wigan-hist-thomas-leuluai-2008": { baseId: "wigan-hist-thomas-leuluai", club: "Wigan Warriors", position: "SCRUM_HALF", rating: 85 },
  "wigan-hist-stuart-fielden-2008": { baseId: "stuart-fielden", club: "Wigan Warriors", position: "PROP", rating: 86 },
  "wigan-hist-lee-mossop-2008": { baseId: "wigan-hist-lee-mossop", club: "Wigan Warriors", position: "PROP", rating: 79 },
  "wigan-hist-michael-mcilorum-2008": { baseId: "wigan-hist-michael-mcilorum", club: "Wigan Warriors", position: "HOOKER", rating: 80 },
  "wigan-hist-joel-tomkins-2008": { baseId: "wigan-hist-joel-tomkins", club: "Wigan Warriors", position: "SECOND_ROW", rating: 81 },
  "wigan-hist-gareth-hock-2008": { baseId: "salford-hist-gareth-hock", club: "Wigan Warriors", position: "SECOND_ROW", rating: 83 },
  "wigan-hist-sean-oloughlin-2008": { baseId: "sean-oloughlin", club: "Wigan Warriors", position: "LOOSE_FORWARD", rating: 91 },

  "wigan-hist-kris-radlinski-2006": { baseId: "kris-radlinski", club: "Wigan Warriors", position: "FULLBACK", rating: 88 },
};
