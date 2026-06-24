"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { BTN } from "@/lib/ui/design-system";

export type ActionButtonVariant =
  | "primary"
  | "secondary"
  | "current"
  | "era"
  | "danger"
  | "ghost";

const VARIANT_CLASS: Record<ActionButtonVariant, string> = {
  primary: BTN.primary,
  secondary: BTN.secondary,
  current: BTN.currentStart,
  era: BTN.eraStart,
  danger: BTN.danger,
  ghost: `${BTN.secondary} border-transparent bg-transparent hover:bg-pitch-900/40`,
};

function variantClass(variant: ActionButtonVariant, hardMode = false): string {
  if (variant === "current" && hardMode) return BTN.currentStartHard;
  return VARIANT_CLASS[variant];
}

type SharedProps = {
  variant?: ActionButtonVariant;
  hardMode?: boolean;
  className?: string;
  children: ReactNode;
  fullWidth?: boolean;
};

type ButtonProps = SharedProps &
  ComponentPropsWithoutRef<"button"> & { href?: undefined };

type LinkProps = SharedProps &
  Omit<ComponentPropsWithoutRef<typeof Link>, "href"> & { href: string };

const START_VARIANTS = new Set<ActionButtonVariant>(["era", "current"]);

export function ActionButton({
  variant = "secondary",
  hardMode = false,
  className = "",
  children,
  fullWidth = true,
  ...rest
}: ButtonProps | LinkProps) {
  const startVariant = START_VARIANTS.has(variant);
  const classes = `${startVariant ? "" : `${BTN.base} `}${variantClass(variant, hardMode)} ${
    fullWidth ? "w-full" : ""
  } ${className}`;

  if ("href" in rest && rest.href) {
    const { href, ...linkRest } = rest;
    return (
      <Link href={href} className={classes} {...linkRest}>
        {children}
      </Link>
    );
  }

  const { ...buttonRest } = rest as ButtonProps;
  return (
    <button type="button" className={classes} {...buttonRest}>
      {children}
    </button>
  );
}
