import type { LeaderboardPeriod } from "./types";

import { getMonthlyKey, getWeeklyKey } from "./game/generator";



export function getPeriodKey(period: LeaderboardPeriod, date?: Date): string {

  switch (period) {

    case "WEEKLY":

      return getWeeklyKey(date);

    case "MONTHLY":

      return getMonthlyKey(date);

    case "ALL_TIME":

      return "all";

  }

}



export function formatPeriodLabel(period: LeaderboardPeriod): string {

  switch (period) {

    case "WEEKLY":

      return "This Week";

    case "MONTHLY":

      return "This Month";

    case "ALL_TIME":

      return "All Time";

  }

}


