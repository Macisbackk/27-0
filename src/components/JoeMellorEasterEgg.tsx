"use client";

import { useState } from "react";
import { HiddenModeLink } from "./HiddenModeLink";

export function JoeMellorEasterEgg() {
  const [jmHref] = useState("/play?joeMellor=1");
  const [sshHref] = useState("/play?superSamHallas=1");

  return (
    <div className="group flex flex-row flex-wrap items-center justify-center gap-2 sm:gap-3">
      <HiddenModeLink href={jmHref} label="JM" ariaLabel="Special Mode" />
      <HiddenModeLink href={sshHref} label="SH" ariaLabel="Super Mode" />
    </div>
  );
}
