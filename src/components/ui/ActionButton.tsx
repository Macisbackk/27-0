"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import {
  getGameButtonClass,
  type GameButtonSize,
  type GameButtonVariant,
} from "@/lib/ui/game-button-variants";

export type ActionButtonVariant = GameButtonVariant | "primary";

type ResolvedVariant = GameButtonVariant;

function resolveVariant(variant: ActionButtonVariant): ResolvedVariant {
  return variant === "primary" ? "theme" : variant;
}

type SharedProps = {
  variant?: ActionButtonVariant;
  hardMode?: boolean;
  size?: GameButtonSize;
  className?: string;
  children: ReactNode;
  fullWidth?: boolean;
};

type ButtonProps = SharedProps &
  ComponentPropsWithoutRef<"button"> & { href?: undefined };

type LinkProps = SharedProps &
  Omit<ComponentPropsWithoutRef<typeof Link>, "href"> & { href: string };

export function ActionButton({
  variant = "secondary",
  hardMode = false,
  size = "md",
  className = "",
  children,
  fullWidth = true,
  ...rest
}: ButtonProps | LinkProps) {
  const resolved = resolveVariant(variant);
  const classes = `${getGameButtonClass(resolved, { hardMode, size })} ${
    fullWidth ? "w-full" : ""
  } ${className}`.trim();

  if ("href" in rest && rest.href) {
    const { href, ...linkRest } = rest;
    return (
      <Link
        href={href}
        className={classes}
        data-game-button-variant={resolved}
        {...linkRest}
      >
        {children}
      </Link>
    );
  }

  const { type = "button", ...buttonRest } = rest as ButtonProps;
  return (
    <button
      type={type}
      className={classes}
      data-game-button-variant={resolved}
      {...buttonRest}
    >
      {children}
    </button>
  );
}
