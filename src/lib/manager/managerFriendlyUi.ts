import type { CSSProperties } from "react";
import { getClubColors } from "../clubs";

/** User club on the left, opponent on the right — primary + secondary kit colours. */
export function getFriendlyDualBorderStyle(
  userClub: string,
  opponentClub: string
): CSSProperties {
  const user = getClubColors(userClub);
  const opponent = getClubColors(opponentClub);

  return {
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderLeftColor: user.primary,
    borderRightColor: opponent.primary,
    borderTopColor: user.secondary,
    borderBottomColor: opponent.secondary,
    backgroundImage: `linear-gradient(135deg, ${user.primary}16 0%, transparent 46%, transparent 54%, ${opponent.primary}16 100%)`,
  };
}
