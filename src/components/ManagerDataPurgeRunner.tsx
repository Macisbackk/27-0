"use client";

import { useEffect } from "react";
import { purgeManagerModeLocalData } from "@/lib/storage/purge-manager-data";

/** Clears leftover Manager Mode saves on launch so they cannot affect remaining modes. */
export function ManagerDataPurgeRunner() {
  useEffect(() => {
    purgeManagerModeLocalData();
  }, []);

  return null;
}
