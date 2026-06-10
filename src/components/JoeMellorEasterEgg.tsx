"use client";

import { useEffect, useState } from "react";
import { getModeDifficulty } from "@/lib/storage/preferences";
import { HiddenModeLink } from "./HiddenModeLink";

export function JoeMellorEasterEgg() {
  const [jmHref, setJmHref] = useState("/play?joeMellor=1");
  const [sshHref, setSshHref] = useState("/play?superSamHallas=1");

  useEffect(() => {
    const difficulty = getModeDifficulty("normal");
    const hardSuffix = difficulty === "HARD" ? "&difficulty=hard" : "";
    setJmHref(`/play?joeMellor=1${hardSuffix}`);
    setSshHref(`/play?superSamHallas=1${hardSuffix}`);
  }, []);

  return (
    <div className="group flex flex-row flex-wrap items-center justify-center gap-2 sm:gap-3">
      <HiddenModeLink href={jmHref} label="JM" ariaLabel="Special Mode" />
      <HiddenModeLink href={sshHref} label="SH" ariaLabel="Super Mode" />
    </div>
  );
}
