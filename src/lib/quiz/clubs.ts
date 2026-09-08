import { getClubByName, getClubColors, type Club } from "@/lib/clubs";
import type { QuizTeamId } from "./types";

export interface QuizClubInfo {
  id: QuizTeamId;
  name: string;
  blurb: string;
}

export const QUIZ_CLUBS: readonly QuizClubInfo[] = [
  {
    id: "bradford",
    name: "Bradford Bulls",
    blurb:
      "Odsal club and early Super League power. Three Grand Final wins in 2001, 2003 and 2005.",
  },
  {
    id: "castleford",
    name: "Castleford Tigers",
    blurb:
      "The Jungle club. Reached the 2017 Super League Grand Final after topping the regular season.",
  },
  {
    id: "catalans",
    name: "Catalans Dragons",
    blurb:
      "Perpignan side, Super League from 2006. First French Challenge Cup winners in 2018.",
  },
  {
    id: "huddersfield",
    name: "Huddersfield Giants",
    blurb:
      "John Smith's Stadium club. Super League regulars with Challenge Cup final appearances in the 2000s and 2020s.",
  },
  {
    id: "hull-fc",
    name: "Hull FC",
    blurb:
      "Black and white west Hull club. Super League Grand Finalists in 2006 and Challenge Cup winners in 2016 and 2017.",
  },
  {
    id: "hull-kr",
    name: "Hull KR",
    blurb:
      "Craven Park club. Grand Finalists in 2024 and Super League champions in 2025.",
  },
  {
    id: "leeds",
    name: "Leeds Rhinos",
    blurb:
      "Headingley club. Eight Super League Grand Final wins between 2004 and 2017.",
  },
  {
    id: "leigh",
    name: "Leigh Leopards",
    blurb:
      "Leigh Sports Village club. Won the 2023 Challenge Cup after returning to Super League.",
  },
  {
    id: "london",
    name: "London Broncos",
    blurb:
      "Capital Super League club across several home grounds, including The Stoop and Trailfinders.",
  },
  {
    id: "salford",
    name: "Salford Red Devils",
    blurb:
      "Salford Community Stadium club. Reached the 2019 Super League Grand Final.",
  },
  {
    id: "st-helens",
    name: "St Helens",
    blurb:
      "Knowsley Road then Totally Wicked Stadium. Four Super League titles in a row from 2019 to 2022.",
  },
  {
    id: "toulouse",
    name: "Toulouse Olympique",
    blurb:
      "Stade Ernest-Wallon club. First Super League season was 2022.",
  },
  {
    id: "wakefield",
    name: "Wakefield Trinity",
    blurb:
      "Belle Vue club. Super League members for most of the competition's history.",
  },
  {
    id: "warrington",
    name: "Warrington Wolves",
    blurb:
      "Halliwell Jones Stadium club. Multiple Super League Grand Finals and several Challenge Cup wins.",
  },
  {
    id: "widnes",
    name: "Widnes Vikings",
    blurb:
      "Halton Stadium club. Super League members in the 2010s before dropping out of the top flight.",
  },
  {
    id: "wigan",
    name: "Wigan Warriors",
    blurb:
      "Cherry and whites. First Super League Grand Final winners in 1998, with further titles in the 2010s and 2020s.",
  },
  {
    id: "york",
    name: "York Knights",
    blurb:
      "York Community Stadium club. Newly promoted Super League side for the 2026 season.",
  },
] as const;

const CLUB_BY_ID = new Map(QUIZ_CLUBS.map((club) => [club.id, club]));
const ID_BY_NAME = new Map(QUIZ_CLUBS.map((club) => [club.name, club.id]));

export function getQuizClub(id: QuizTeamId): QuizClubInfo {
  const club = CLUB_BY_ID.get(id);
  if (!club) {
    throw new Error(`Unknown quiz club: ${id}`);
  }
  return club;
}

export function getQuizClubIdByName(name: string): QuizTeamId | null {
  return ID_BY_NAME.get(name) ?? null;
}

export function getQuizClubRecord(id: QuizTeamId): Club | null {
  return getClubByName(getQuizClub(id).name) ?? null;
}

export function getQuizClubColors(id: QuizTeamId): {
  primary: string;
  secondary: string;
} {
  const name = getQuizClub(id).name;
  return getClubColors(name);
}
