"use client";

import { useEffect, useState } from "react";
import { StatsPanel } from "@/components/StatsPanel";
import { getUsername } from "@/lib/storage/user";

export default function StatsPage() {
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    setUsername(getUsername());
  }, []);

  const title = username ? `${username}'s Stats` : "Your Stats";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">{title}</h1>
      <p className="mb-6 text-sm text-gray-500">
        Your career statistics across all runs on this device.
      </p>
      <StatsPanel />
    </div>
  );
}
