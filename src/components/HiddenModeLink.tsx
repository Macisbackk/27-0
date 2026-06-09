"use client";

import Link from "next/link";

interface HiddenModeLinkProps {
  href: string;
}

/** Unlabeled subtle hit target — no public mode name. */
export function HiddenModeLink({ href }: HiddenModeLinkProps) {
  return (
    <Link
      href={href}
      className="flex h-4 w-4 items-center justify-center rounded-full opacity-0 transition-all duration-300 hover:!opacity-40 focus:opacity-30 focus:outline-none group-hover:opacity-20"
      aria-hidden
      tabIndex={-1}
    >
      <span className="h-1 w-1 rounded-full bg-gray-600 group-hover:bg-accent-gold/60" />
    </Link>
  );
}
