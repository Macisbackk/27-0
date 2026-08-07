/**
 * Dev-only mount/unmount diagnostics for flicker hunting.
 * Enable: localStorage.setItem("27-0-mount-diag", "1") then reload.
 */
"use client";

import { useEffect } from "react";
import {
  getShellMountCounts,
  recordShellMount,
  resetShellMountCounts,
} from "@/lib/ui/mount-diagnostics";

export function useMountDiagnostic(componentName: string): void {
  useEffect(() => {
    recordShellMount(componentName);
    console.debug(`[mount] ${componentName}`);
    return () => {
      console.debug(`[unmount] ${componentName}`);
    };
  }, [componentName]);
}

export { getShellMountCounts, resetShellMountCounts, recordShellMount };
