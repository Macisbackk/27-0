"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/** Framer animations follow the device's reduced-motion setting, like the CSS ones do. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
