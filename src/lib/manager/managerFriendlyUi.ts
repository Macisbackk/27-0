import type { CSSProperties } from "react";
import { getClubColors } from "../clubs";

/** Opponent kit colours only — top strip, no left colour bars. */
export function getFriendlyOpponentBorderStyle(
  opponentClub: string
): CSSProperties {
  const opponent = getClubColors(opponentClub);

  return {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderTopWidth: 3,
    borderLeftColor: "rgba(255,255,255,0.08)",
    borderRightColor: "rgba(255,255,255,0.08)",
    borderBottomColor: "rgba(255,255,255,0.08)",
    borderTopColor: opponent.primary,
    backgroundImage: `linear-gradient(135deg, ${opponent.primary}14 0%, transparent 100%)`,
  };
}

/** Dual club identity via top strip only — no side bars. */
export function getFriendlyDualBorderStyle(
  userClub: string,
  opponentClub: string
): CSSProperties {
  const user = getClubColors(userClub);
  const opponent = getClubColors(opponentClub);

  return {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderTopWidth: 3,
    borderLeftColor: "rgba(255,255,255,0.08)",
    borderRightColor: "rgba(255,255,255,0.08)",
    borderBottomColor: "rgba(255,255,255,0.08)",
    borderTopColor: user.primary,
    backgroundImage: [
      `linear-gradient(to right, ${user.primary} 0 50%, ${opponent.primary} 50% 100%)`,
      `linear-gradient(135deg, ${user.primary}12 0%, transparent 46%, transparent 54%, ${opponent.primary}12 100%)`,
    ].join(", "),
    backgroundSize: "100% 3px, auto",
    backgroundPosition: "top, center",
    backgroundRepeat: "no-repeat, no-repeat",
  };
}
