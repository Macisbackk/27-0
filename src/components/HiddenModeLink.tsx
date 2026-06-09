"use client";

import Link from "next/link";

interface HiddenModeLinkProps {
  href: string;
  label: string;
  ariaLabel: string;
}

export function HiddenModeLink({ href, label, ariaLabel }: HiddenModeLinkProps) {
  return (
    <Link
      href={href}
      className="flex h-5 w-5 items-center justify-center rounded-full opacity-0 transition-all duration-300 hover:!opacity-70 focus:opacity-50 focus:outline-none group-hover:opacity-30"
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <span className="text-[9px] font-black tracking-tighter text-gray-600 group-hover:text-accent-gold">
        {label}
      </span>
    </Link>
  );
}
