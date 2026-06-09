import { getPeriodKey } from "../leaderboard";

import type {

  GameDifficulty,

  GameMode,

  LeaderboardPeriod,

  LeaderboardRow,

} from "../types";

import { STORAGE_KEYS } from "./keys";

import { getUsername } from "./user";



export interface StoredLeaderboardEntry {

  id: string;

  username: string;

  squadValue: number;

  achievedAt: string;

  period: LeaderboardPeriod;

  periodKey: string;

  mode: GameMode;

  difficulty: GameDifficulty;

  /** @deprecated Legacy field — ignored on read */

  bestPlayerName?: string;

  /** @deprecated Legacy field — ignored on read */

  bestPlayerValue?: number;

}



function loadEntries(): StoredLeaderboardEntry[] {

  if (typeof window === "undefined") return [];

  try {

    const raw = localStorage.getItem(STORAGE_KEYS.leaderboard);

    if (!raw) return [];

    return JSON.parse(raw) as StoredLeaderboardEntry[];

  } catch {

    return [];

  }

}



function saveEntries(entries: StoredLeaderboardEntry[]): void {

  localStorage.setItem(STORAGE_KEYS.leaderboard, JSON.stringify(entries));

}



export function addLeaderboardEntry(

  squadValue: number,

  mode: GameMode,

  difficulty: GameDifficulty = "NORMAL",

  achievedAt = new Date()

): void {

  const username = getUsername();

  const date = achievedAt;

  const periods: LeaderboardPeriod[] = ["WEEKLY", "MONTHLY", "ALL_TIME"];



  const entries = loadEntries();



  for (const period of periods) {

    entries.push({

      id: `${Date.now()}-${period}-${Math.random().toString(36).slice(2, 8)}`,

      username,

      squadValue,

      achievedAt: date.toISOString(),

      period,

      periodKey: getPeriodKey(period, date),

      mode,

      difficulty,

    });

  }



  saveEntries(entries);

}



export function getLeaderboard(

  period: LeaderboardPeriod,

  difficulty: GameDifficulty = "NORMAL",

  limit = 50

): LeaderboardRow[] {

  const periodKey = getPeriodKey(period);

  const currentUser = getUsername();



  const filtered = loadEntries().filter(

    (e) =>

      e.period === period &&

      e.periodKey === periodKey &&

      (e.difficulty ?? "NORMAL") === difficulty &&

      (e.mode ?? "CLASSIC") === "CLASSIC"

  );



  filtered.sort((a, b) => b.squadValue - a.squadValue);



  const seen = new Set<string>();

  const deduped: StoredLeaderboardEntry[] = [];



  for (const entry of filtered) {

    if (seen.has(entry.username)) continue;

    seen.add(entry.username);

    deduped.push(entry);

    if (deduped.length >= limit) break;

  }



  return deduped.map((entry, index) => ({

    rank: index + 1,

    username: entry.username,

    squadValue: entry.squadValue,

    achievedAt: entry.achievedAt,

    difficulty: entry.difficulty ?? "NORMAL",

    isCurrentUser: entry.username === currentUser,

  }));

}

