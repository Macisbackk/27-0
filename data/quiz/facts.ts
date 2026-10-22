import type { QuizTeamId } from "@/lib/quiz/types";

export interface FinalRecord {
  year: number;
  winnerId: QuizTeamId | "sheffield";
  runnerUpId: QuizTeamId | "sheffield";
  winnerName: string;
  runnerUpName: string;
  score?: string;
  /** Only set where the final was not played at the usual venue. */
  venue?: string;
}

/** Super League Grand Final — winners and runners-up. */
export const GRAND_FINALS: FinalRecord[] = [
  { year: 1998, winnerId: "wigan", runnerUpId: "leeds", winnerName: "Wigan Warriors", runnerUpName: "Leeds Rhinos", score: "10-4" },
  { year: 1999, winnerId: "st-helens", runnerUpId: "bradford", winnerName: "St Helens", runnerUpName: "Bradford Bulls", score: "8-6" },
  { year: 2000, winnerId: "st-helens", runnerUpId: "wigan", winnerName: "St Helens", runnerUpName: "Wigan Warriors", score: "29-16" },
  { year: 2001, winnerId: "bradford", runnerUpId: "wigan", winnerName: "Bradford Bulls", runnerUpName: "Wigan Warriors", score: "37-6" },
  { year: 2002, winnerId: "st-helens", runnerUpId: "bradford", winnerName: "St Helens", runnerUpName: "Bradford Bulls", score: "19-18" },
  { year: 2003, winnerId: "bradford", runnerUpId: "wigan", winnerName: "Bradford Bulls", runnerUpName: "Wigan Warriors", score: "25-12" },
  { year: 2004, winnerId: "leeds", runnerUpId: "bradford", winnerName: "Leeds Rhinos", runnerUpName: "Bradford Bulls", score: "16-8" },
  { year: 2005, winnerId: "bradford", runnerUpId: "leeds", winnerName: "Bradford Bulls", runnerUpName: "Leeds Rhinos", score: "15-6" },
  { year: 2006, winnerId: "st-helens", runnerUpId: "hull-fc", winnerName: "St Helens", runnerUpName: "Hull FC", score: "26-4" },
  { year: 2007, winnerId: "leeds", runnerUpId: "st-helens", winnerName: "Leeds Rhinos", runnerUpName: "St Helens", score: "33-6" },
  { year: 2008, winnerId: "leeds", runnerUpId: "st-helens", winnerName: "Leeds Rhinos", runnerUpName: "St Helens", score: "24-16" },
  { year: 2009, winnerId: "leeds", runnerUpId: "st-helens", winnerName: "Leeds Rhinos", runnerUpName: "St Helens", score: "18-10" },
  { year: 2010, winnerId: "wigan", runnerUpId: "st-helens", winnerName: "Wigan Warriors", runnerUpName: "St Helens", score: "22-10" },
  { year: 2011, winnerId: "leeds", runnerUpId: "st-helens", winnerName: "Leeds Rhinos", runnerUpName: "St Helens", score: "32-16" },
  { year: 2012, winnerId: "leeds", runnerUpId: "warrington", winnerName: "Leeds Rhinos", runnerUpName: "Warrington Wolves", score: "26-18" },
  { year: 2013, winnerId: "wigan", runnerUpId: "warrington", winnerName: "Wigan Warriors", runnerUpName: "Warrington Wolves", score: "30-16" },
  { year: 2014, winnerId: "st-helens", runnerUpId: "wigan", winnerName: "St Helens", runnerUpName: "Wigan Warriors", score: "14-6" },
  { year: 2015, winnerId: "leeds", runnerUpId: "wigan", winnerName: "Leeds Rhinos", runnerUpName: "Wigan Warriors", score: "22-20" },
  { year: 2016, winnerId: "wigan", runnerUpId: "warrington", winnerName: "Wigan Warriors", runnerUpName: "Warrington Wolves", score: "12-6" },
  { year: 2017, winnerId: "leeds", runnerUpId: "castleford", winnerName: "Leeds Rhinos", runnerUpName: "Castleford Tigers", score: "24-6" },
  { year: 2018, winnerId: "wigan", runnerUpId: "warrington", winnerName: "Wigan Warriors", runnerUpName: "Warrington Wolves", score: "12-4" },
  { year: 2019, winnerId: "st-helens", runnerUpId: "salford", winnerName: "St Helens", runnerUpName: "Salford Red Devils", score: "23-6" },
  { year: 2020, winnerId: "st-helens", runnerUpId: "wigan", winnerName: "St Helens", runnerUpName: "Wigan Warriors", score: "8-4", venue: "KCOM Stadium" },
  { year: 2021, winnerId: "st-helens", runnerUpId: "catalans", winnerName: "St Helens", runnerUpName: "Catalans Dragons", score: "12-10" },
  { year: 2022, winnerId: "st-helens", runnerUpId: "leeds", winnerName: "St Helens", runnerUpName: "Leeds Rhinos", score: "24-12" },
  { year: 2023, winnerId: "wigan", runnerUpId: "catalans", winnerName: "Wigan Warriors", runnerUpName: "Catalans Dragons", score: "10-2" },
  { year: 2024, winnerId: "wigan", runnerUpId: "hull-kr", winnerName: "Wigan Warriors", runnerUpName: "Hull KR", score: "9-2" },
  { year: 2025, winnerId: "hull-kr", runnerUpId: "wigan", winnerName: "Hull KR", runnerUpName: "Wigan Warriors", score: "24-6" },
  // 3 October 2026: https://skysports.com/rugby-league/warrington-vs-wakefield/report/63349 and
  // https://www.yorkshireeveningpost.co.uk/sport/rugby-league/wakefield-trinity-full-results-from-super-league-winning-2026-season-5419487
  { year: 2026, winnerId: "wakefield", runnerUpId: "warrington", winnerName: "Wakefield Trinity", runnerUpName: "Warrington Wolves", score: "23-10" },
];

/** Challenge Cup finals in the Super League era with a clear winner. */
export const CHALLENGE_CUPS: FinalRecord[] = [
  // Scores and non-Wembley venues: https://en.wikipedia.org/wiki/List_of_Challenge_Cup_finals
  // (2004/2005 Millennium Stadium: https://en.wikipedia.org/wiki/2004_Challenge_Cup, /2005_Challenge_Cup)
  { year: 1996, winnerId: "st-helens", runnerUpId: "bradford", winnerName: "St Helens", runnerUpName: "Bradford Bulls", score: "40-32" },
  { year: 1997, winnerId: "st-helens", runnerUpId: "bradford", winnerName: "St Helens", runnerUpName: "Bradford Bulls", score: "32-22" },
  { year: 1998, winnerId: "sheffield", runnerUpId: "wigan", winnerName: "Sheffield Eagles", runnerUpName: "Wigan Warriors", score: "17-8" },
  { year: 1999, winnerId: "leeds", runnerUpId: "london", winnerName: "Leeds Rhinos", runnerUpName: "London Broncos", score: "52-16" },
  { year: 2000, winnerId: "bradford", runnerUpId: "leeds", winnerName: "Bradford Bulls", runnerUpName: "Leeds Rhinos", score: "24-18", venue: "Murrayfield" },
  { year: 2001, winnerId: "st-helens", runnerUpId: "bradford", winnerName: "St Helens", runnerUpName: "Bradford Bulls", score: "13-6", venue: "Twickenham" },
  { year: 2002, winnerId: "wigan", runnerUpId: "st-helens", winnerName: "Wigan Warriors", runnerUpName: "St Helens", score: "21-12", venue: "Murrayfield" },
  { year: 2003, winnerId: "bradford", runnerUpId: "leeds", winnerName: "Bradford Bulls", runnerUpName: "Leeds Rhinos", score: "22-20", venue: "Millennium Stadium" },
  { year: 2004, winnerId: "st-helens", runnerUpId: "wigan", winnerName: "St Helens", runnerUpName: "Wigan Warriors", score: "32-16", venue: "Millennium Stadium" },
  { year: 2005, winnerId: "hull-fc", runnerUpId: "leeds", winnerName: "Hull FC", runnerUpName: "Leeds Rhinos", score: "25-24", venue: "Millennium Stadium" },
  { year: 2006, winnerId: "st-helens", runnerUpId: "huddersfield", winnerName: "St Helens", runnerUpName: "Huddersfield Giants", score: "42-12", venue: "Twickenham" },
  { year: 2007, winnerId: "st-helens", runnerUpId: "catalans", winnerName: "St Helens", runnerUpName: "Catalans Dragons", score: "30-8" },
  { year: 2008, winnerId: "st-helens", runnerUpId: "hull-fc", winnerName: "St Helens", runnerUpName: "Hull FC", score: "28-16" },
  { year: 2009, winnerId: "warrington", runnerUpId: "huddersfield", winnerName: "Warrington Wolves", runnerUpName: "Huddersfield Giants", score: "25-16" },
  { year: 2010, winnerId: "warrington", runnerUpId: "leeds", winnerName: "Warrington Wolves", runnerUpName: "Leeds Rhinos", score: "30-6" },
  { year: 2011, winnerId: "wigan", runnerUpId: "leeds", winnerName: "Wigan Warriors", runnerUpName: "Leeds Rhinos", score: "28-18" },
  { year: 2012, winnerId: "warrington", runnerUpId: "leeds", winnerName: "Warrington Wolves", runnerUpName: "Leeds Rhinos", score: "35-18" },
  { year: 2013, winnerId: "wigan", runnerUpId: "hull-fc", winnerName: "Wigan Warriors", runnerUpName: "Hull FC", score: "16-0" },
  { year: 2014, winnerId: "leeds", runnerUpId: "castleford", winnerName: "Leeds Rhinos", runnerUpName: "Castleford Tigers", score: "23-10" },
  { year: 2015, winnerId: "leeds", runnerUpId: "hull-kr", winnerName: "Leeds Rhinos", runnerUpName: "Hull KR", score: "50-0" },
  { year: 2016, winnerId: "hull-fc", runnerUpId: "warrington", winnerName: "Hull FC", runnerUpName: "Warrington Wolves", score: "12-10" },
  { year: 2017, winnerId: "hull-fc", runnerUpId: "wigan", winnerName: "Hull FC", runnerUpName: "Wigan Warriors", score: "18-14" },
  { year: 2018, winnerId: "catalans", runnerUpId: "warrington", winnerName: "Catalans Dragons", runnerUpName: "Warrington Wolves", score: "20-14" },
  { year: 2019, winnerId: "warrington", runnerUpId: "st-helens", winnerName: "Warrington Wolves", runnerUpName: "St Helens", score: "18-4" },
  { year: 2020, winnerId: "leeds", runnerUpId: "salford", winnerName: "Leeds Rhinos", runnerUpName: "Salford Red Devils", score: "17-16" },
  { year: 2021, winnerId: "st-helens", runnerUpId: "castleford", winnerName: "St Helens", runnerUpName: "Castleford Tigers", score: "26-12" },
  { year: 2022, winnerId: "wigan", runnerUpId: "huddersfield", winnerName: "Wigan Warriors", runnerUpName: "Huddersfield Giants", score: "16-14", venue: "Tottenham Hotspur Stadium" },
  { year: 2023, winnerId: "leigh", runnerUpId: "hull-kr", winnerName: "Leigh Leopards", runnerUpName: "Hull KR", score: "17-16" },
  { year: 2024, winnerId: "wigan", runnerUpId: "warrington", winnerName: "Wigan Warriors", runnerUpName: "Warrington Wolves", score: "18-8" },
  { year: 2025, winnerId: "hull-kr", runnerUpId: "warrington", winnerName: "Hull KR", runnerUpName: "Warrington Wolves", score: "8-6" },
  { year: 2026, winnerId: "wigan", runnerUpId: "hull-kr", winnerName: "Wigan Warriors", runnerUpName: "Hull KR", score: "40-10" },
];

/** Source: https://en.wikipedia.org/wiki/League_Leaders%27_Shield (first awarded 2003). */
export const LEAGUE_LEADERS: { year: number; id: QuizTeamId; name: string }[] = [
  { year: 2003, id: "bradford", name: "Bradford Bulls" },
  { year: 2004, id: "leeds", name: "Leeds Rhinos" },
  { year: 2005, id: "st-helens", name: "St Helens" },
  { year: 2006, id: "st-helens", name: "St Helens" },
  { year: 2007, id: "st-helens", name: "St Helens" },
  { year: 2008, id: "st-helens", name: "St Helens" },
  { year: 2009, id: "leeds", name: "Leeds Rhinos" },
  { year: 2010, id: "wigan", name: "Wigan Warriors" },
  { year: 2011, id: "warrington", name: "Warrington Wolves" },
  { year: 2012, id: "wigan", name: "Wigan Warriors" },
  { year: 2013, id: "huddersfield", name: "Huddersfield Giants" },
  { year: 2014, id: "st-helens", name: "St Helens" },
  { year: 2015, id: "leeds", name: "Leeds Rhinos" },
  { year: 2016, id: "warrington", name: "Warrington Wolves" },
  { year: 2017, id: "castleford", name: "Castleford Tigers" },
  { year: 2018, id: "st-helens", name: "St Helens" },
  { year: 2019, id: "st-helens", name: "St Helens" },
  { year: 2020, id: "wigan", name: "Wigan Warriors" },
  { year: 2021, id: "catalans", name: "Catalans Dragons" },
  { year: 2022, id: "st-helens", name: "St Helens" },
  { year: 2023, id: "wigan", name: "Wigan Warriors" },
  { year: 2024, id: "wigan", name: "Wigan Warriors" },
  { year: 2025, id: "hull-kr", name: "Hull KR" },
  { year: 2026, id: "wigan", name: "Wigan Warriors" },
];

export const STADIUMS: {
  id: QuizTeamId;
  stadium: string;
  alsoKnownAs?: string[];
  city: string;
  /** Sponsored names change, so ask about this season's name explicitly. */
  asOfSeason?: number;
}[] = [
  { id: "leeds", stadium: "Headingley", city: "Leeds" },
  // Renamed in 2024: https://en.wikipedia.org/wiki/Wigan_Warriors
  { id: "wigan", stadium: "Brick Community Stadium", alsoKnownAs: ["JJB Stadium", "DW Stadium"], city: "Wigan", asOfSeason: 2026 },
  // BrewDog Stadium from October 2025: https://www.saintsrlfc.com/2025/10/20/st-helens-r-f-c-announces-landmark-partnership-with-brewdog-welcome-to-the-brewdog-stadium/
  { id: "st-helens", stadium: "BrewDog Stadium", alsoKnownAs: ["Langtree Park", "Totally Wicked Stadium"], city: "St Helens", asOfSeason: 2026 },
  { id: "warrington", stadium: "Halliwell Jones Stadium", city: "Warrington" },
  { id: "hull-fc", stadium: "MKM Stadium", alsoKnownAs: ["KC Stadium"], city: "Hull" },
  { id: "hull-kr", stadium: "Craven Park", alsoKnownAs: ["Sewell Group Craven Park"], city: "Hull" },
  { id: "castleford", stadium: "The Jungle", alsoKnownAs: ["Wheldon Road"], city: "Castleford" },
  { id: "wakefield", stadium: "Belle Vue", city: "Wakefield" },
  // Accu Stadium since 2025; the Giants plan to move after 2026: https://en.wikipedia.org/wiki/Kirklees_Stadium
  { id: "huddersfield", stadium: "Accu Stadium", alsoKnownAs: ["Kirklees Stadium", "John Smith's Stadium"], city: "Huddersfield", asOfSeason: 2026 },
  { id: "catalans", stadium: "Stade Gilbert Brutus", city: "Perpignan" },
  { id: "leigh", stadium: "Leigh Sports Village", city: "Leigh" },
  { id: "salford", stadium: "Salford Community Stadium", alsoKnownAs: ["AJ Bell Stadium"], city: "Salford" },
  { id: "bradford", stadium: "Odsal", city: "Bradford" },
  { id: "london", stadium: "The Stoop", city: "London" },
  { id: "toulouse", stadium: "Stade Ernest-Wallon", city: "Toulouse" },
  { id: "york", stadium: "York Community Stadium", alsoKnownAs: ["LNER Community Stadium"], city: "York" },
  { id: "widnes", stadium: "Halton Stadium", city: "Widnes" },
];

export interface ClubHistoryFact {
  id: QuizTeamId;
  name: string;
  foundedQuestion: string;
  founded: string;
  foundedDistractors: [string, string, string];
  formerName?: string;
  formerNameQuestion?: string;
  formerNameDistractors?: [string, string, string];
  milestoneQuestion: string;
  milestone: string;
  milestoneDistractors: [string, string, string];
  milestoneDifficulty?: "easy" | "medium" | "hard" | "very-hard" | "expert";
  milestoneCategory?: "history" | "clubs" | "seasons" | "records" | "coaches";
}

/** Verified club-history facts for foundation, former names, and milestones. */
export const CLUB_HISTORY: ClubHistoryFact[] = [
  {
    id: "bradford",
    name: "Bradford Bulls",
    foundedQuestion: "In which year was Bradford Northern (now Bradford Bulls) founded?",
    founded: "1907",
    foundedDistractors: ["1863", "1895", "1921"],
    formerName: "Bradford Northern",
    formerNameQuestion:
      "Under which name did Bradford Bulls play for most of the 20th century?",
    formerNameDistractors: ["Bradford City", "Bradford Park Avenue", "Odsal Bulls"],
    milestoneQuestion:
      "Which decade saw Bradford Bulls win three Super League Grand Finals?",
    milestone: "2000s",
    milestoneDistractors: ["1990s", "2010s", "2020s"],
    milestoneDifficulty: "medium",
    milestoneCategory: "history",
  },
  {
    id: "castleford",
    name: "Castleford Tigers",
    foundedQuestion: "In which year was Castleford (now Castleford Tigers) founded?",
    founded: "1926",
    foundedDistractors: ["1873", "1899", "1946"],
    formerName: "The Jungle",
    formerNameQuestion: "What is Castleford Tigers' Wheldon Road ground commonly called?",
    formerNameDistractors: ["The Den", "The Valley", "The Dell"],
    milestoneQuestion:
      "In which year did Castleford Tigers reach their first Super League Grand Final?",
    milestone: "2017",
    milestoneDistractors: ["2013", "2015", "2019"],
    milestoneDifficulty: "medium",
    milestoneCategory: "seasons",
  },
  {
    id: "catalans",
    name: "Catalans Dragons",
    foundedQuestion: "In which year were Catalans Dragons founded?",
    founded: "2000",
    foundedDistractors: ["1996", "2006", "2012"],
    milestoneQuestion:
      "Which Catalan club became Super League's first French Challenge Cup winners?",
    milestone: "Catalans Dragons",
    milestoneDistractors: ["Toulouse Olympique", "Paris Saint-Germain", "Hull FC"],
    milestoneDifficulty: "easy",
    milestoneCategory: "history",
  },
  {
    id: "huddersfield",
    name: "Huddersfield Giants",
    foundedQuestion: "In which year was Huddersfield (now Huddersfield Giants) founded?",
    founded: "1864",
    foundedDistractors: ["1873", "1880", "1895"],
    formerName: "Fartown",
    formerNameQuestion:
      "Which historic Huddersfield ground name is still used as a club nickname?",
    formerNameDistractors: ["Belle Vue", "Knowsley Road", "Central Park"],
    milestoneQuestion:
      "In which year did Huddersfield Giants win the League Leaders' Shield?",
    milestone: "2013",
    milestoneDistractors: ["2006", "2009", "2017"],
    milestoneDifficulty: "hard",
    milestoneCategory: "records",
  },
  {
    id: "hull-fc",
    name: "Hull FC",
    foundedQuestion: "In which year was Hull FC founded?",
    founded: "1865",
    foundedDistractors: ["1873", "1882", "1895"],
    formerName: "The Boulevard",
    formerNameQuestion: "What was Hull FC's historic Super League-era home before the MKM Stadium?",
    formerNameDistractors: ["Craven Park", "Odsal", "Wilderspool"],
    milestoneQuestion: "Which Hull club reached the 2006 Super League Grand Final?",
    milestone: "Hull FC",
    milestoneDistractors: ["Hull KR", "Leeds Rhinos", "Bradford Bulls"],
    milestoneDifficulty: "medium",
    milestoneCategory: "history",
  },
  {
    id: "hull-kr",
    name: "Hull KR",
    foundedQuestion: "In which year was Hull Kingston Rovers founded?",
    founded: "1882",
    foundedDistractors: ["1865", "1873", "1907"],
    milestoneQuestion: "Which Hull club reached the 2024 Super League Grand Final?",
    milestone: "Hull KR",
    milestoneDistractors: ["Hull FC", "Leigh Leopards", "Catalans Dragons"],
    milestoneDifficulty: "easy",
    milestoneCategory: "seasons",
  },
  {
    id: "leeds",
    name: "Leeds Rhinos",
    foundedQuestion: "In which year was Leeds Rugby League Club (now Leeds Rhinos) founded?",
    founded: "1870",
    foundedDistractors: ["1864", "1873", "1895"],
    milestoneQuestion: "Which Leeds Rhinos captain lifted multiple Super League titles in the 2000s and 2010s?",
    milestone: "Kevin Sinfield",
    milestoneDistractors: ["Rob Burrow", "Jamie Peacock", "Danny McGuire"],
    milestoneDifficulty: "easy",
    milestoneCategory: "captains" as ClubHistoryFact["milestoneCategory"],
  },
  {
    id: "leigh",
    name: "Leigh Leopards",
    foundedQuestion: "In which year was Leigh (now Leigh Leopards) founded?",
    founded: "1878",
    foundedDistractors: ["1873", "1885", "1926"],
    formerName: "Leigh Centurions",
    formerNameQuestion: "What was Leigh Leopards' Super League name before the 2023 rebrand?",
    formerNameDistractors: ["Leigh Miners", "Leigh Lions", "Leigh Town"],
    milestoneQuestion: "Which year saw Leigh rebrand as the Leopards for Super League?",
    milestone: "2023",
    milestoneDistractors: ["2021", "2022", "2024"],
    milestoneDifficulty: "easy",
    milestoneCategory: "history",
  },
  {
    id: "london",
    name: "London Broncos",
    foundedQuestion:
      "In which year were London Broncos originally founded as Fulham RLFC?",
    founded: "1980",
    foundedDistractors: ["1968", "1996", "2006"],
    formerName: "Fulham",
    formerNameQuestion: "Under which name did London Broncos begin life in 1980?",
    formerNameDistractors: ["London Crusaders", "Harlequins RL", "London Skolars"],
    milestoneQuestion:
      "Which London club reached the 1999 Challenge Cup final against Leeds?",
    milestone: "London Broncos",
    milestoneDistractors: ["London Skolars", "Catalans Dragons", "Widnes Vikings"],
    milestoneDifficulty: "hard",
    milestoneCategory: "history",
  },
  {
    id: "salford",
    name: "Salford Red Devils",
    foundedQuestion: "In which year was Salford (now Salford Red Devils) founded?",
    founded: "1873",
    foundedDistractors: ["1865", "1880", "1907"],
    formerName: "Salford City Reds",
    formerNameQuestion:
      "What name did Salford Red Devils previously use in Super League?",
    formerNameDistractors: ["Salford Quins", "Salford Lions", "Salford Northern"],
    milestoneQuestion:
      "In which year did Salford Red Devils reach their first Super League Grand Final?",
    milestone: "2019",
    milestoneDistractors: ["2014", "2017", "2021"],
    milestoneDifficulty: "medium",
    milestoneCategory: "seasons",
  },
  {
    id: "st-helens",
    name: "St Helens",
    foundedQuestion: "In which year was St Helens founded?",
    founded: "1873",
    foundedDistractors: ["1864", "1879", "1895"],
    formerName: "Knowsley Road",
    formerNameQuestion:
      "What was St Helens' long-time home ground before Totally Wicked Stadium?",
    formerNameDistractors: ["Central Park", "Wilderspool", "Headingley"],
    milestoneQuestion: "Which club were Super League champions in the first season, 1996?",
    milestone: "St Helens",
    milestoneDistractors: ["Wigan Warriors", "Bradford Bulls", "Leeds Rhinos"],
    milestoneDifficulty: "medium",
    milestoneCategory: "history",
  },
  {
    id: "toulouse",
    name: "Toulouse Olympique",
    foundedQuestion: "In which year was Toulouse Olympique founded?",
    founded: "1937",
    foundedDistractors: ["1900", "1956", "2000"],
    milestoneQuestion: "Which French club's home ground is Stade Ernest-Wallon?",
    milestone: "Toulouse Olympique",
    milestoneDistractors: ["Catalans Dragons", "Paris Saint-Germain", "Hull FC"],
    milestoneDifficulty: "medium",
    milestoneCategory: "clubs",
  },
  {
    id: "wakefield",
    name: "Wakefield Trinity",
    foundedQuestion: "In which year was Wakefield Trinity founded?",
    founded: "1873",
    foundedDistractors: ["1865", "1882", "1907"],
    milestoneQuestion: "What is Wakefield Trinity's traditional home ground?",
    milestone: "Belle Vue",
    milestoneDistractors: ["Odsal", "The Jungle", "Craven Park"],
    milestoneDifficulty: "easy",
    milestoneCategory: "clubs",
  },
  {
    id: "warrington",
    name: "Warrington Wolves",
    foundedQuestion: "In which year was the Warrington club now known as the Wolves founded?",
    founded: "1876",
    foundedDistractors: ["1873", "1879", "1895"],
    formerName: "The Wire",
    formerNameQuestion: "What is Warrington Wolves' traditional nickname?",
    formerNameDistractors: ["The Chemics", "The Bulls", "The Tigers"],
    milestoneQuestion: "Which coach led Warrington Wolves to Challenge Cup wins in 2009, 2010 and 2012?",
    milestone: "Tony Smith",
    milestoneDistractors: ["Lee Briers", "Steve Price", "Daryl Powell"],
    milestoneDifficulty: "medium",
    milestoneCategory: "coaches",
  },
  {
    id: "widnes",
    name: "Widnes Vikings",
    foundedQuestion: "In which year was Widnes (now Widnes Vikings) founded?",
    founded: "1875",
    foundedDistractors: ["1865", "1879", "1895"],
    formerName: "Chemics",
    formerNameQuestion: "What historic nickname is associated with Widnes Vikings?",
    formerNameDistractors: ["The Wire", "The Bulls", "The Quins"],
    milestoneQuestion:
      "Which decade saw Widnes Vikings return to Super League for several seasons?",
    milestone: "2010s",
    milestoneDistractors: ["1990s", "2000s", "2020s"],
    milestoneDifficulty: "hard",
    milestoneCategory: "history",
  },
  {
    id: "wigan",
    name: "Wigan Warriors",
    foundedQuestion: "In which year was Wigan (now Wigan Warriors) founded?",
    founded: "1872",
    foundedDistractors: ["1864", "1879", "1895"],
    formerName: "Central Park",
    formerNameQuestion:
      "What was Wigan's historic home ground before the DW Stadium?",
    formerNameDistractors: ["Knowsley Road", "Headingley", "Odsal"],
    milestoneQuestion:
      "Who captained Wigan Warriors through their 2010s Super League title years?",
    milestone: "Sean O'Loughlin",
    milestoneDistractors: ["Andy Farrell", "Pat Richards", "Thomas Leuluai"],
    milestoneDifficulty: "easy",
    milestoneCategory: "captains" as ClubHistoryFact["milestoneCategory"],
  },
  {
    id: "york",
    name: "York Knights",
    foundedQuestion: "In which year was the current York Knights club founded as York City Knights?",
    founded: "2002",
    foundedDistractors: ["1868", "1996", "2006"],
    milestoneQuestion: "What is York Knights' current home stadium commonly called?",
    milestone: "York Community Stadium",
    milestoneDistractors: ["Headingley", "Belle Vue", "Odsal"],
    milestoneDifficulty: "easy",
    milestoneCategory: "clubs",
  },
];

/** Challenge Cup final Lance Todd Trophy winners. */
export const LANCE_TODD_WINNERS: {
  year: number;
  winnerName: string;
  /** Second winner when the award was shared. */
  sharedWinnerName?: string;
}[] = [
  { year: 1946, winnerName: "Billy Stott" },
  { year: 1947, winnerName: "Willie Davies" },
  { year: 1948, winnerName: "Frank Whitcombe" },
  { year: 1949, winnerName: "Ernest Ward" },
  { year: 1950, winnerName: "Gerry Helme" },
  { year: 1951, winnerName: "Cec Mountford" },
  { year: 1952, winnerName: "Billy Ivison" },
  { year: 1953, winnerName: "Peter Ramsden" },
  { year: 1954, winnerName: "Gerry Helme" },
  { year: 1955, winnerName: "Jack Grundy" },
  { year: 1956, winnerName: "Alan Prescott" },
  { year: 1957, winnerName: "Jeff Stevenson" },
  { year: 1958, winnerName: "Rees Thomas" },
  { year: 1959, winnerName: "Brian McTigue" },
  { year: 1960, winnerName: "Tommy Harris" },
  { year: 1961, winnerName: "Dick Huddart" },
  { year: 1962, winnerName: "Neil Fox" },
  { year: 1963, winnerName: "Harold Poynton" },
  { year: 1964, winnerName: "Frank Collier" },
  { year: 1965, winnerName: "Ray Ashby", sharedWinnerName: "Brian Gabbitas" },
  { year: 1966, winnerName: "Len Killeen" },
  { year: 1967, winnerName: "Carl Dooler" },
  { year: 1968, winnerName: "Don Fox" },
  { year: 1969, winnerName: "Malcolm Reilly" },
  { year: 1970, winnerName: "Bill Kirkbride" },
  { year: 1971, winnerName: "Alex Murphy" },
  { year: 1972, winnerName: "Kel Coslett" },
  { year: 1973, winnerName: "Steve Nash" },
  { year: 1974, winnerName: "Derek Whitehead" },
  { year: 1975, winnerName: "Ray Dutton" },
  { year: 1976, winnerName: "Geoff Pimblett" },
  { year: 1977, winnerName: "Steve Pitchford" },
  { year: 1978, winnerName: "George Nicholls" },
  { year: 1979, winnerName: "David Topliss" },
  { year: 1980, winnerName: "Brian Lockwood" },
  { year: 1981, winnerName: "Mick Burke" },
  { year: 1982, winnerName: "Eddie Cunningham" },
  { year: 1983, winnerName: "David Hobbs" },
  { year: 1984, winnerName: "Joe Lydon" },
  { year: 1985, winnerName: "Brett Kenny" },
  { year: 1986, winnerName: "Bob Beardmore" },
  { year: 1987, winnerName: "Graham Eadie" },
  { year: 1988, winnerName: "Andy Gregory" },
  { year: 1989, winnerName: "Ellery Hanley" },
  { year: 1990, winnerName: "Andy Gregory" },
  { year: 1991, winnerName: "Denis Betts" },
  { year: 1992, winnerName: "Martin Offiah" },
  { year: 1993, winnerName: "Dean Bell" },
  { year: 1994, winnerName: "Martin Offiah" },
  { year: 1995, winnerName: "Jason Robinson" },
  { year: 1996, winnerName: "Robbie Hunter-Paul" },
  { year: 1997, winnerName: "Tommy Martyn" },
  { year: 1998, winnerName: "Mark Aston" },
  { year: 1999, winnerName: "Leroy Rivett" },
  { year: 2000, winnerName: "Henry Paul" },
  { year: 2001, winnerName: "Sean Long" },
  { year: 2002, winnerName: "Kris Radlinski" },
  { year: 2003, winnerName: "Garry Connolly" },
  { year: 2004, winnerName: "Sean Long" },
  { year: 2005, winnerName: "Kevin Sinfield" },
  { year: 2006, winnerName: "Sean Long" },
  { year: 2007, winnerName: "Paul Wellens", sharedWinnerName: "Leon Pryce" },
  { year: 2008, winnerName: "Paul Wellens" },
  { year: 2009, winnerName: "Michael Monaghan" },
  { year: 2010, winnerName: "Lee Briers" },
  { year: 2011, winnerName: "Jeff Lima" },
  { year: 2012, winnerName: "Brett Hodgson" },
  { year: 2013, winnerName: "Matty Smith" },
  { year: 2014, winnerName: "Ryan Hall" },
  { year: 2015, winnerName: "Tom Briscoe" },
  { year: 2016, winnerName: "Marc Sneyd" },
  { year: 2017, winnerName: "Marc Sneyd" },
  { year: 2018, winnerName: "Tony Gigot" },
  { year: 2019, winnerName: "Daryl Clark" },
  { year: 2020, winnerName: "Richie Myler" },
  { year: 2021, winnerName: "Niall Evalds" },
  { year: 2022, winnerName: "Chris McQueen" },
  { year: 2023, winnerName: "Lachlan Lam" },
  { year: 2024, winnerName: "Bevan French" },
  { year: 2025, winnerName: "Marc Sneyd" },
  { year: 2026, winnerName: "Jack Farrimond" },
];

/** Club names as they were at the time, mapped to a quiz club where one exists. */
export const HISTORIC_CLUB_IDS: Record<string, QuizTeamId> = {
  "Wakefield Trinity": "wakefield",
  "Bradford Northern": "bradford",
  Leeds: "leeds",
  Wigan: "wigan",
  Warrington: "warrington",
  Widnes: "widnes",
  Huddersfield: "huddersfield",
  "St Helens": "st-helens",
  "Hull FC": "hull-fc",
  "Hull Kingston Rovers": "hull-kr",
  Castleford: "castleford",
  Salford: "salford",
  Leigh: "leigh",
};

export interface HistoricFinal {
  year: number;
  winner: string;
  runnerUp: string;
  score: string;
  /** The first match was drawn; `score` is the replay result. */
  replay?: { drawnScore: string; venue: string };
}

/**
 * Challenge Cup finals 1946–1995 (the year the final was played).
 * Source: https://en.wikipedia.org/wiki/List_of_Challenge_Cup_finals
 */
export const HISTORIC_CHALLENGE_CUP_FINALS: HistoricFinal[] = [
  { year: 1946, winner: "Wakefield Trinity", runnerUp: "Wigan", score: "13-12" },
  { year: 1947, winner: "Bradford Northern", runnerUp: "Leeds", score: "8-4" },
  { year: 1948, winner: "Wigan", runnerUp: "Bradford Northern", score: "8-3" },
  { year: 1949, winner: "Bradford Northern", runnerUp: "Halifax", score: "12-0" },
  { year: 1950, winner: "Warrington", runnerUp: "Widnes", score: "19-0" },
  { year: 1951, winner: "Wigan", runnerUp: "Barrow", score: "10-0" },
  { year: 1952, winner: "Workington Town", runnerUp: "Featherstone Rovers", score: "18-10" },
  { year: 1953, winner: "Huddersfield", runnerUp: "St Helens", score: "15-10" },
  { year: 1954, winner: "Warrington", runnerUp: "Halifax", score: "8-4", replay: { drawnScore: "4-4", venue: "Odsal" } },
  { year: 1955, winner: "Barrow", runnerUp: "Workington Town", score: "21-12" },
  { year: 1956, winner: "St Helens", runnerUp: "Halifax", score: "13-2" },
  { year: 1957, winner: "Leeds", runnerUp: "Barrow", score: "9-7" },
  { year: 1958, winner: "Wigan", runnerUp: "Workington Town", score: "13-9" },
  { year: 1959, winner: "Wigan", runnerUp: "Hull FC", score: "30-13" },
  { year: 1960, winner: "Wakefield Trinity", runnerUp: "Hull FC", score: "38-5" },
  { year: 1961, winner: "St Helens", runnerUp: "Wigan", score: "12-6" },
  { year: 1962, winner: "Wakefield Trinity", runnerUp: "Huddersfield", score: "12-6" },
  { year: 1963, winner: "Wakefield Trinity", runnerUp: "Wigan", score: "25-10" },
  { year: 1964, winner: "Widnes", runnerUp: "Hull Kingston Rovers", score: "13-5" },
  { year: 1965, winner: "Wigan", runnerUp: "Hunslet", score: "20-16" },
  { year: 1966, winner: "St Helens", runnerUp: "Wigan", score: "21-2" },
  { year: 1967, winner: "Featherstone Rovers", runnerUp: "Barrow", score: "17-12" },
  { year: 1968, winner: "Leeds", runnerUp: "Wakefield Trinity", score: "11-10" },
  { year: 1969, winner: "Castleford", runnerUp: "Salford", score: "11-6" },
  { year: 1970, winner: "Castleford", runnerUp: "Wigan", score: "7-2" },
  { year: 1971, winner: "Leigh", runnerUp: "Leeds", score: "24-7" },
  { year: 1972, winner: "St Helens", runnerUp: "Leeds", score: "16-13" },
  { year: 1973, winner: "Featherstone Rovers", runnerUp: "Bradford Northern", score: "33-14" },
  { year: 1974, winner: "Warrington", runnerUp: "Featherstone Rovers", score: "24-9" },
  { year: 1975, winner: "Widnes", runnerUp: "Warrington", score: "14-7" },
  { year: 1976, winner: "St Helens", runnerUp: "Widnes", score: "20-5" },
  { year: 1977, winner: "Leeds", runnerUp: "Widnes", score: "16-7" },
  { year: 1978, winner: "Leeds", runnerUp: "St Helens", score: "14-12" },
  { year: 1979, winner: "Widnes", runnerUp: "Wakefield Trinity", score: "12-3" },
  { year: 1980, winner: "Hull Kingston Rovers", runnerUp: "Hull FC", score: "10-5" },
  { year: 1981, winner: "Widnes", runnerUp: "Hull Kingston Rovers", score: "18-9" },
  { year: 1982, winner: "Hull FC", runnerUp: "Widnes", score: "18-9", replay: { drawnScore: "14-14", venue: "Elland Road" } },
  { year: 1983, winner: "Featherstone Rovers", runnerUp: "Hull FC", score: "14-12" },
  { year: 1984, winner: "Widnes", runnerUp: "Wigan", score: "19-6" },
  { year: 1985, winner: "Wigan", runnerUp: "Hull FC", score: "28-24" },
  { year: 1986, winner: "Castleford", runnerUp: "Hull Kingston Rovers", score: "15-14" },
  { year: 1987, winner: "Halifax", runnerUp: "St Helens", score: "19-18" },
  { year: 1988, winner: "Wigan", runnerUp: "Halifax", score: "32-12" },
  { year: 1989, winner: "Wigan", runnerUp: "St Helens", score: "27-0" },
  { year: 1990, winner: "Wigan", runnerUp: "Warrington", score: "36-14" },
  { year: 1991, winner: "Wigan", runnerUp: "St Helens", score: "13-8" },
  { year: 1992, winner: "Wigan", runnerUp: "Castleford", score: "28-12" },
  { year: 1993, winner: "Wigan", runnerUp: "Widnes", score: "20-14" },
  { year: 1994, winner: "Wigan", runnerUp: "Leeds", score: "26-16" },
  { year: 1995, winner: "Wigan", runnerUp: "Leeds", score: "30-10" },
];

/**
 * Super League Grand Final man of the match. Harry Sunderland Trophy to 2023
 * (https://en.wikipedia.org/wiki/Harry_Sunderland_Trophy); the Rob Burrow Award from 2024
 * (2024: https://en.wikipedia.org/wiki/2024_Super_League_Grand_Final;
 * 2025: https://www.loverugbyleague.com/post/rob-burrow-award-voting-breakdown-in-full-as-eight-hull-kr-stars-earn-nominations-but-one-man-dominates).
 */
export const GRAND_FINAL_MAN_OF_MATCH: {
  year: number;
  player: string;
  clubId: QuizTeamId;
  /** Won the award while on the losing side. */
  losingSide?: boolean;
}[] = [
  { year: 1998, player: "Jason Robinson", clubId: "wigan" },
  { year: 1999, player: "Henry Paul", clubId: "bradford", losingSide: true },
  { year: 2000, player: "Chris Joynt", clubId: "st-helens" },
  { year: 2001, player: "Michael Withers", clubId: "bradford" },
  { year: 2002, player: "Paul Deacon", clubId: "bradford", losingSide: true },
  { year: 2003, player: "Stuart Reardon", clubId: "bradford" },
  { year: 2004, player: "Matt Diskin", clubId: "leeds" },
  { year: 2005, player: "Leon Pryce", clubId: "bradford" },
  { year: 2006, player: "Paul Wellens", clubId: "st-helens" },
  { year: 2007, player: "Rob Burrow", clubId: "leeds" },
  { year: 2008, player: "Lee Smith", clubId: "leeds" },
  { year: 2009, player: "Kevin Sinfield", clubId: "leeds" },
  { year: 2010, player: "Thomas Leuluai", clubId: "wigan" },
  { year: 2011, player: "Rob Burrow", clubId: "leeds" },
  { year: 2012, player: "Kevin Sinfield", clubId: "leeds" },
  { year: 2013, player: "Blake Green", clubId: "wigan" },
  { year: 2014, player: "James Roby", clubId: "st-helens" },
  { year: 2015, player: "Danny McGuire", clubId: "leeds" },
  { year: 2016, player: "Liam Farrell", clubId: "wigan" },
  { year: 2017, player: "Danny McGuire", clubId: "leeds" },
  { year: 2018, player: "Stefan Ratchford", clubId: "warrington", losingSide: true },
  { year: 2019, player: "Luke Thompson", clubId: "st-helens" },
  { year: 2020, player: "James Roby", clubId: "st-helens" },
  { year: 2021, player: "Kevin Naiqama", clubId: "st-helens" },
  { year: 2022, player: "Jonny Lomax", clubId: "st-helens" },
  { year: 2023, player: "Jake Wardle", clubId: "wigan" },
  { year: 2024, player: "Bevan French", clubId: "wigan" },
  { year: 2025, player: "Mikey Lewis", clubId: "hull-kr" },
  // https://skysports.com/rugby-league/warrington-vs-wakefield/report/63349
  { year: 2026, player: "Tom Johnstone", clubId: "wakefield" },
];

/**
 * World Club Challenge results (cancelled editions and the 1997 World Club Championship omitted).
 * Source: https://en.wikipedia.org/wiki/World_Club_Challenge
 */
export const WORLD_CLUB_CHALLENGES: {
  year: number;
  winner: string;
  loser: string;
  score: string;
  /** The British side in the match. */
  britishClub: string;
  britishId: QuizTeamId;
}[] = [
  { year: 1976, winner: "Eastern Suburbs", loser: "St Helens", score: "25-2", britishClub: "St Helens", britishId: "st-helens" },
  { year: 1987, winner: "Wigan", loser: "Manly Sea Eagles", score: "8-2", britishClub: "Wigan", britishId: "wigan" },
  { year: 1989, winner: "Widnes", loser: "Canberra Raiders", score: "30-18", britishClub: "Widnes", britishId: "widnes" },
  { year: 1991, winner: "Wigan", loser: "Penrith Panthers", score: "21-4", britishClub: "Wigan", britishId: "wigan" },
  { year: 1992, winner: "Brisbane Broncos", loser: "Wigan", score: "22-8", britishClub: "Wigan", britishId: "wigan" },
  { year: 1994, winner: "Wigan", loser: "Brisbane Broncos", score: "20-14", britishClub: "Wigan", britishId: "wigan" },
  { year: 2000, winner: "Melbourne Storm", loser: "St Helens", score: "44-6", britishClub: "St Helens", britishId: "st-helens" },
  { year: 2001, winner: "St Helens", loser: "Brisbane Broncos", score: "20-18", britishClub: "St Helens", britishId: "st-helens" },
  { year: 2002, winner: "Bradford Bulls", loser: "Newcastle Knights", score: "41-26", britishClub: "Bradford Bulls", britishId: "bradford" },
  { year: 2003, winner: "Sydney Roosters", loser: "St Helens", score: "38-0", britishClub: "St Helens", britishId: "st-helens" },
  { year: 2004, winner: "Bradford Bulls", loser: "Penrith Panthers", score: "22-4", britishClub: "Bradford Bulls", britishId: "bradford" },
  { year: 2005, winner: "Leeds Rhinos", loser: "Canterbury Bulldogs", score: "39-32", britishClub: "Leeds Rhinos", britishId: "leeds" },
  { year: 2006, winner: "Bradford Bulls", loser: "Wests Tigers", score: "30-10", britishClub: "Bradford Bulls", britishId: "bradford" },
  { year: 2007, winner: "St Helens", loser: "Brisbane Broncos", score: "18-14", britishClub: "St Helens", britishId: "st-helens" },
  { year: 2008, winner: "Leeds Rhinos", loser: "Melbourne Storm", score: "11-4", britishClub: "Leeds Rhinos", britishId: "leeds" },
  { year: 2009, winner: "Manly Sea Eagles", loser: "Leeds Rhinos", score: "28-20", britishClub: "Leeds Rhinos", britishId: "leeds" },
  { year: 2010, winner: "Melbourne Storm", loser: "Leeds Rhinos", score: "18-10", britishClub: "Leeds Rhinos", britishId: "leeds" },
  { year: 2011, winner: "St George Illawarra Dragons", loser: "Wigan Warriors", score: "21-15", britishClub: "Wigan Warriors", britishId: "wigan" },
  { year: 2012, winner: "Leeds Rhinos", loser: "Manly Sea Eagles", score: "26-12", britishClub: "Leeds Rhinos", britishId: "leeds" },
  { year: 2013, winner: "Melbourne Storm", loser: "Leeds Rhinos", score: "18-14", britishClub: "Leeds Rhinos", britishId: "leeds" },
  { year: 2014, winner: "Sydney Roosters", loser: "Wigan Warriors", score: "36-14", britishClub: "Wigan Warriors", britishId: "wigan" },
  { year: 2015, winner: "South Sydney Rabbitohs", loser: "St Helens", score: "39-0", britishClub: "St Helens", britishId: "st-helens" },
  { year: 2016, winner: "North Queensland Cowboys", loser: "Leeds Rhinos", score: "38-4", britishClub: "Leeds Rhinos", britishId: "leeds" },
  { year: 2017, winner: "Wigan Warriors", loser: "Cronulla Sharks", score: "22-6", britishClub: "Wigan Warriors", britishId: "wigan" },
  { year: 2018, winner: "Melbourne Storm", loser: "Leeds Rhinos", score: "38-4", britishClub: "Leeds Rhinos", britishId: "leeds" },
  { year: 2019, winner: "Sydney Roosters", loser: "Wigan Warriors", score: "20-8", britishClub: "Wigan Warriors", britishId: "wigan" },
  { year: 2020, winner: "Sydney Roosters", loser: "St Helens", score: "20-12", britishClub: "St Helens", britishId: "st-helens" },
  { year: 2023, winner: "St Helens", loser: "Penrith Panthers", score: "13-12", britishClub: "St Helens", britishId: "st-helens" },
  { year: 2024, winner: "Wigan Warriors", loser: "Penrith Panthers", score: "16-12", britishClub: "Wigan Warriors", britishId: "wigan" },
  { year: 2026, winner: "Hull KR", loser: "Brisbane Broncos", score: "30-24", britishClub: "Hull KR", britishId: "hull-kr" },
];

/**
 * Rugby League World Golden Boot (men's). 1985–1987 omitted because the sources disagree.
 * Sources: https://www.intrl.sport/golden-boot-awards/ and
 * https://www.loverugbyleague.com/post/ranking-international-golden-boot-winners-by-nation
 */
export const GOLDEN_BOOT_WINNERS: {
  year: number;
  player: string;
  nation: string;
  teams?: QuizTeamId[];
}[] = [
  { year: 1984, player: "Wally Lewis", nation: "Australia" },
  { year: 1988, player: "Ellery Hanley", nation: "Great Britain", teams: ["wigan"] },
  { year: 1989, player: "Mal Meninga", nation: "Australia" },
  { year: 1990, player: "Garry Schofield", nation: "Great Britain", teams: ["leeds"] },
  { year: 1999, player: "Andrew Johns", nation: "Australia" },
  { year: 2000, player: "Brad Fittler", nation: "Australia" },
  { year: 2001, player: "Andrew Johns", nation: "Australia" },
  { year: 2002, player: "Stacey Jones", nation: "New Zealand" },
  { year: 2003, player: "Darren Lockyer", nation: "Australia" },
  { year: 2004, player: "Andy Farrell", nation: "Great Britain", teams: ["wigan"] },
  { year: 2005, player: "Anthony Minichiello", nation: "Australia" },
  { year: 2006, player: "Darren Lockyer", nation: "Australia" },
  { year: 2007, player: "Cameron Smith", nation: "Australia" },
  { year: 2008, player: "Billy Slater", nation: "Australia" },
  { year: 2009, player: "Greg Inglis", nation: "Australia" },
  { year: 2010, player: "Benji Marshall", nation: "New Zealand" },
  { year: 2011, player: "Johnathan Thurston", nation: "Australia" },
  { year: 2012, player: "Kevin Sinfield", nation: "England", teams: ["leeds"] },
  { year: 2013, player: "Johnathan Thurston", nation: "Australia" },
  { year: 2014, player: "Shaun Johnson", nation: "New Zealand" },
  { year: 2015, player: "Johnathan Thurston", nation: "Australia" },
  { year: 2016, player: "Cooper Cronk", nation: "Australia" },
  { year: 2017, player: "Cameron Smith", nation: "Australia" },
  { year: 2018, player: "Tommy Makinson", nation: "England", teams: ["st-helens"] },
  { year: 2019, player: "Roger Tuivasa-Sheck", nation: "New Zealand" },
  { year: 2022, player: "Joseph Manu", nation: "New Zealand" },
  { year: 2023, player: "James Fisher-Harris", nation: "New Zealand" },
];

/**
 * Men's Rugby League World Cup winners.
 * Source: https://en.wikipedia.org/wiki/Rugby_League_World_Cup
 */
export const WORLD_CUPS: {
  year: string;
  winner: string;
  runnerUp: string;
  finalScore?: string;
  finalVenue?: string;
}[] = [
  { year: "1954", winner: "Great Britain", runnerUp: "France", finalScore: "16-12" },
  { year: "1957", winner: "Australia", runnerUp: "Great Britain" },
  { year: "1960", winner: "Great Britain", runnerUp: "Australia" },
  { year: "1968", winner: "Australia", runnerUp: "France", finalScore: "20-2", finalVenue: "Sydney Cricket Ground" },
  { year: "1970", winner: "Australia", runnerUp: "Great Britain", finalScore: "12-7", finalVenue: "Headingley" },
  { year: "1972", winner: "Great Britain", runnerUp: "Australia", finalScore: "10-10", finalVenue: "Stade de Gerland" },
  { year: "1977", winner: "Australia", runnerUp: "Great Britain", finalScore: "13-12" },
  { year: "1995", winner: "Australia", runnerUp: "England", finalScore: "16-8", finalVenue: "Wembley Stadium" },
  { year: "2000", winner: "Australia", runnerUp: "New Zealand", finalScore: "40-12", finalVenue: "Old Trafford" },
  { year: "2008", winner: "New Zealand", runnerUp: "Australia", finalScore: "34-20", finalVenue: "Lang Park" },
  { year: "2013", winner: "Australia", runnerUp: "New Zealand", finalScore: "34-2", finalVenue: "Old Trafford" },
  { year: "2017", winner: "Australia", runnerUp: "England", finalScore: "6-0", finalVenue: "Lang Park" },
  { year: "2021", winner: "Australia", runnerUp: "Samoa", finalScore: "30-10", finalVenue: "Old Trafford" },
];
