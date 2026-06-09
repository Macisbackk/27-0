"use client";

import { useEffect, useState } from "react";
import { getDifficulty } from "@/lib/storage/preferences";
import { HiddenModeLink } from "./HiddenModeLink";

export function JoeMellorEasterEgg() {
  const [href, setHref] = useState("/play?joeMellor=1");

  useEffect(() => {
    const difficulty = getDifficulty();
    setHref(
      difficulty === "HARD"
        ? "/play?joeMellor=1&difficulty=hard"
        : "/play?joeMellor=1"
    );
  }, []);

  return (
    <div className="group flex flex-row flex-wrap items-center justify-center gap-2 sm:gap-3">
      <HiddenModeLink href={href} label="JM" ariaLabel="Special Mode" />
    </div>
  );
}
