import type { QuizTeamId } from "@/lib/quiz/types";

export interface FinalRecord {
  year: number;
  winnerId: QuizTeamId | "sheffield";
  runnerUpId: QuizTeamId | "sheffield";
  winnerName: string;
  runnerUpName: string;
  score?: string;
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
  { year: 2020, winnerId: "st-helens", runnerUpId: "wigan", winnerName: "St Helens", runnerUpName: "Wigan Warriors", score: "8-4" },
  { year: 2021, winnerId: "st-helens", runnerUpId: "catalans", winnerName: "St Helens", runnerUpName: "Catalans Dragons", score: "12-10" },
  { year: 2022, winnerId: "st-helens", runnerUpId: "leeds", winnerName: "St Helens", runnerUpName: "Leeds Rhinos", score: "24-12" },
  { year: 2023, winnerId: "wigan", runnerUpId: "catalans", winnerName: "Wigan Warriors", runnerUpName: "Catalans Dragons", score: "10-2" },
  { year: 2024, winnerId: "wigan", runnerUpId: "hull-kr", winnerName: "Wigan Warriors", runnerUpName: "Hull KR", score: "9-2" },
  { year: 2025, winnerId: "hull-kr", runnerUpId: "wigan", winnerName: "Hull KR", runnerUpName: "Wigan Warriors", score: "24-6" },
];

/** Challenge Cup finals in the Super League era with a clear winner. */
export const CHALLENGE_CUPS: FinalRecord[] = [
  { year: 1996, winnerId: "st-helens", runnerUpId: "bradford", winnerName: "St Helens", runnerUpName: "Bradford Bulls" },
  { year: 1997, winnerId: "st-helens", runnerUpId: "bradford", winnerName: "St Helens", runnerUpName: "Bradford Bulls" },
  { year: 1998, winnerId: "sheffield", runnerUpId: "wigan", winnerName: "Sheffield Eagles", runnerUpName: "Wigan Warriors" },
  { year: 1999, winnerId: "leeds", runnerUpId: "london", winnerName: "Leeds Rhinos", runnerUpName: "London Broncos" },
  { year: 2000, winnerId: "bradford", runnerUpId: "leeds", winnerName: "Bradford Bulls", runnerUpName: "Leeds Rhinos" },
  { year: 2001, winnerId: "st-helens", runnerUpId: "bradford", winnerName: "St Helens", runnerUpName: "Bradford Bulls" },
  { year: 2002, winnerId: "wigan", runnerUpId: "st-helens", winnerName: "Wigan Warriors", runnerUpName: "St Helens" },
  { year: 2003, winnerId: "bradford", runnerUpId: "leeds", winnerName: "Bradford Bulls", runnerUpName: "Leeds Rhinos" },
  { year: 2004, winnerId: "st-helens", runnerUpId: "wigan", winnerName: "St Helens", runnerUpName: "Wigan Warriors" },
  { year: 2005, winnerId: "hull-fc", runnerUpId: "leeds", winnerName: "Hull FC", runnerUpName: "Leeds Rhinos" },
  { year: 2006, winnerId: "st-helens", runnerUpId: "huddersfield", winnerName: "St Helens", runnerUpName: "Huddersfield Giants" },
  { year: 2007, winnerId: "st-helens", runnerUpId: "catalans", winnerName: "St Helens", runnerUpName: "Catalans Dragons" },
  { year: 2008, winnerId: "st-helens", runnerUpId: "hull-fc", winnerName: "St Helens", runnerUpName: "Hull FC" },
  { year: 2009, winnerId: "warrington", runnerUpId: "huddersfield", winnerName: "Warrington Wolves", runnerUpName: "Huddersfield Giants" },
  { year: 2010, winnerId: "warrington", runnerUpId: "leeds", winnerName: "Warrington Wolves", runnerUpName: "Leeds Rhinos" },
  { year: 2011, winnerId: "wigan", runnerUpId: "leeds", winnerName: "Wigan Warriors", runnerUpName: "Leeds Rhinos" },
  { year: 2012, winnerId: "warrington", runnerUpId: "leeds", winnerName: "Warrington Wolves", runnerUpName: "Leeds Rhinos" },
  { year: 2013, winnerId: "wigan", runnerUpId: "hull-fc", winnerName: "Wigan Warriors", runnerUpName: "Hull FC" },
  { year: 2014, winnerId: "leeds", runnerUpId: "castleford", winnerName: "Leeds Rhinos", runnerUpName: "Castleford Tigers" },
  { year: 2015, winnerId: "leeds", runnerUpId: "hull-kr", winnerName: "Leeds Rhinos", runnerUpName: "Hull KR" },
  { year: 2016, winnerId: "hull-fc", runnerUpId: "warrington", winnerName: "Hull FC", runnerUpName: "Warrington Wolves" },
  { year: 2017, winnerId: "hull-fc", runnerUpId: "wigan", winnerName: "Hull FC", runnerUpName: "Wigan Warriors" },
  { year: 2018, winnerId: "catalans", runnerUpId: "warrington", winnerName: "Catalans Dragons", runnerUpName: "Warrington Wolves" },
  { year: 2019, winnerId: "warrington", runnerUpId: "st-helens", winnerName: "Warrington Wolves", runnerUpName: "St Helens" },
  { year: 2020, winnerId: "leeds", runnerUpId: "salford", winnerName: "Leeds Rhinos", runnerUpName: "Salford Red Devils" },
  { year: 2021, winnerId: "st-helens", runnerUpId: "castleford", winnerName: "St Helens", runnerUpName: "Castleford Tigers" },
  { year: 2022, winnerId: "wigan", runnerUpId: "huddersfield", winnerName: "Wigan Warriors", runnerUpName: "Huddersfield Giants" },
  { year: 2023, winnerId: "leigh", runnerUpId: "hull-kr", winnerName: "Leigh Leopards", runnerUpName: "Hull KR" },
  { year: 2024, winnerId: "wigan", runnerUpId: "warrington", winnerName: "Wigan Warriors", runnerUpName: "Warrington Wolves" },
  { year: 2025, winnerId: "hull-kr", runnerUpId: "warrington", winnerName: "Hull KR", runnerUpName: "Warrington Wolves", score: "8-6" },
];

export const LEAGUE_LEADERS: { year: number; id: QuizTeamId; name: string }[] = [
  { year: 2006, id: "st-helens", name: "St Helens" },
  { year: 2007, id: "st-helens", name: "St Helens" },
  { year: 2008, id: "st-helens", name: "St Helens" },
  { year: 2014, id: "st-helens", name: "St Helens" },
  { year: 2017, id: "castleford", name: "Castleford Tigers" },
  { year: 2019, id: "st-helens", name: "St Helens" },
  { year: 2021, id: "catalans", name: "Catalans Dragons" },
  { year: 2022, id: "st-helens", name: "St Helens" },
  { year: 2023, id: "wigan", name: "Wigan Warriors" },
  { year: 2024, id: "wigan", name: "Wigan Warriors" },
  { year: 2025, id: "hull-kr", name: "Hull KR" },
];

export const STADIUMS: {
  id: QuizTeamId;
  stadium: string;
  alsoKnownAs?: string[];
  city: string;
}[] = [
  { id: "leeds", stadium: "Headingley", city: "Leeds" },
  { id: "wigan", stadium: "DW Stadium", alsoKnownAs: ["JJB Stadium", "Brick Community Stadium"], city: "Wigan" },
  { id: "st-helens", stadium: "Totally Wicked Stadium", alsoKnownAs: ["Langtree Park"], city: "St Helens" },
  { id: "warrington", stadium: "Halliwell Jones Stadium", city: "Warrington" },
  { id: "hull-fc", stadium: "MKM Stadium", alsoKnownAs: ["KC Stadium"], city: "Hull" },
  { id: "hull-kr", stadium: "Craven Park", alsoKnownAs: ["Sewell Group Craven Park"], city: "Hull" },
  { id: "castleford", stadium: "The Jungle", alsoKnownAs: ["Wheldon Road"], city: "Castleford" },
  { id: "wakefield", stadium: "Belle Vue", city: "Wakefield" },
  { id: "huddersfield", stadium: "John Smith's Stadium", alsoKnownAs: ["Kirklees Stadium"], city: "Huddersfield" },
  { id: "catalans", stadium: "Stade Gilbert Brutus", city: "Perpignan" },
  { id: "leigh", stadium: "Leigh Sports Village", city: "Leigh" },
  { id: "salford", stadium: "Salford Community Stadium", alsoKnownAs: ["AJ Bell Stadium"], city: "Salford" },
  { id: "bradford", stadium: "Odsal", city: "Bradford" },
  { id: "london", stadium: "The Stoop", city: "London" },
  { id: "toulouse", stadium: "Stade Ernest-Wallon", city: "Toulouse" },
  { id: "york", stadium: "York Community Stadium", alsoKnownAs: ["LNER Community Stadium"], city: "York" },
  { id: "widnes", stadium: "Halton Stadium", city: "Widnes" },
];
