"use client";

import type { ReactNode } from "react";
import { MobileBottomSheet, MobileModal } from "@/components/ui/MobileOverlay";

/**
 * Every Manager Mode pop-up uses this (v1.57): one compact dark card with a small eyebrow, the
 * title, a short body and its buttons in the footer. Centred on phones; `list` sheets (pickers,
 * the Legend Vault, records, a club's team sheet) dock to the bottom instead. Both size to their
 * content and scroll inside once they reach ~80% of the screen. Escape and the backdrop call
 * `onClose`, so a pop-up's default answer still works from the keyboard.
 */
export function ManagerSheet({
  open,
  onClose,
  eyebrow,
  title,
  headerExtra,
  footer,
  list = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow?: ReactNode;
  title: string;
  headerExtra?: ReactNode;
  footer?: ReactNode;
  list?: boolean;
  children: ReactNode;
}) {
  const Shell = list ? MobileBottomSheet : MobileModal;
  return (
    <Shell open={open} onClose={onClose} title={title} eyebrow={eyebrow} headerExtra={headerExtra} footer={footer} variant="card">
      {children}
    </Shell>
  );
}

/** Footer buttons: side by side on wider screens; stacked on phones with the main action on top. */
export function SheetButtons({ children }: { children: ReactNode }) {
  return <div className="flex flex-col-reverse gap-2 sm:grid sm:auto-cols-fr sm:grid-flow-col">{children}</div>;
}
