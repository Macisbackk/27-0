import type { CSSProperties, ReactNode } from "react";

export type GameTableRowVariant =
  | "fixture"
  | "ledger"
  | "slip"
  | "transfer"
  | "default";

interface GameTableRowProps {
  children: ReactNode;
  variant?: GameTableRowVariant;
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
  as?: "div" | "li" | "button" | "article";
}

const VARIANT_CLASS: Record<GameTableRowVariant, string> = {
  default: "",
  fixture: "game-table-row--fixture",
  ledger: "game-table-row--ledger",
  slip: "game-table-row--slip",
  transfer: "game-table-row--transfer",
};

/** Fixture-board / ledger / inbox-slip / transfer row. */
export function GameTableRow({
  children,
  variant = "default",
  interactive = false,
  onClick,
  className = "",
  style,
  as,
}: GameTableRowProps) {
  const Tag = as ?? (onClick || interactive ? "button" : "div");
  const interactiveClass =
    interactive || onClick ? "game-table-row--interactive" : "";

  return (
    <Tag
      className={`game-table-row ${VARIANT_CLASS[variant]} ${interactiveClass} ${className}`.trim()}
      style={style}
      onClick={onClick}
      type={Tag === "button" ? "button" : undefined}
    >
      {children}
    </Tag>
  );
}
