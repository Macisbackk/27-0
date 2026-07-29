#!/usr/bin/env npx tsx
/**
 * Audits player/team card colour separation from Store UI theme.
 * Flags: Showcase/player cards using theme-primary borders; missing club helpers.
 * Run: npm run audit:team-colours
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const SRC = join(ROOT, "src");

type Finding = {
  file: string;
  line: number;
  id: string;
  severity: "error" | "warn";
  snippet: string;
};

/** Player/team identity surfaces — must not use Store theme for borders. */
const PLAYER_CARD_FILES = [
  "ShowcasePlayerCard.tsx",
  "PlayerCard.tsx",
  "PitchSlotCard.tsx",
  "SlotRecruitPlayerCard.tsx",
  "RugbyLeaguePlayerCard.tsx",
];

const ALLOWLIST = new Set([
  "src/lib/clubs.ts",
  "src/lib/ui/theme-css-vars.ts",
  "src/lib/ui/apply-ui-theme.ts",
  "src/lib/ui-themes.ts",
  "src/styles/design-system.css",
  "src/app/globals.css",
]);

const CHECKS: {
  id: string;
  severity: "error" | "warn";
  regex: RegExp;
  onlyPlayerCards?: boolean;
  skipIf?: (file: string, line: string) => boolean;
}[] = [
  {
    id: "player-card-theme-border",
    severity: "error",
    onlyPlayerCards: true,
    regex: /\bborder-theme-primary\b/g,
  },
  {
    id: "player-card-theme-wash",
    severity: "error",
    onlyPlayerCards: true,
    regex: /\bbg-theme-primary\//g,
  },
  {
    id: "player-card-accent-green",
    severity: "error",
    onlyPlayerCards: true,
    regex: /\b(text|bg|border)-accent-green\b/g,
  },
  {
    id: "hardcoded-showcase-green",
    severity: "error",
    regex: /#22c55e|#16a34a|#15803d/g,
    skipIf: (file) =>
      file.includes("theme-css-vars") ||
      file.includes("grades") ||
      file.includes("dream-team") ||
      file.includes("layout.tsx") ||
      file.includes("Confetti") ||
      file.includes("RLAwardCard"),
  },
  {
    id: "showcase-missing-club-helper",
    severity: "warn",
    regex: /ShowcasePlayerCard|function ShowcasePlayerCard/g,
    skipIf: (file, line) => {
      if (!file.includes("ShowcasePlayerCard")) return true;
      // Handled in post-pass
      return true;
    },
  },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(full);
  }
  return out;
}

function isPlayerCardFile(rel: string): boolean {
  return PLAYER_CARD_FILES.some((f) => rel.endsWith(f));
}

function main() {
  const files = walk(SRC);
  const findings: Finding[] = [];

  for (const file of files) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    if (ALLOWLIST.has(rel)) continue;

    const text = readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    const playerCard = isPlayerCardFile(rel);

    for (const check of CHECKS) {
      if (check.onlyPlayerCards && !playerCard) continue;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        check.regex.lastIndex = 0;
        if (!check.regex.test(line)) continue;
        check.regex.lastIndex = 0;
        if (check.skipIf?.(rel, line)) continue;
        findings.push({
          file: rel,
          line: i + 1,
          id: check.id,
          severity: check.severity,
          snippet: line.trim().slice(0, 120),
        });
      }
    }

    // Showcase must call getPlayerCardColours
    if (rel.endsWith("ShowcasePlayerCard.tsx")) {
      if (!text.includes("getPlayerCardColours")) {
        findings.push({
          file: rel,
          line: 1,
          id: "showcase-missing-getPlayerCardColours",
          severity: "error",
          snippet: "ShowcasePlayerCard must use getPlayerCardColours for club borders",
        });
      }
      if (
        text.includes("CARD.base") &&
        !text.includes("game-panel--flush") &&
        !text.includes("CARD.player")
      ) {
        findings.push({
          file: rel,
          line: 1,
          id: "showcase-store-theme-strip",
          severity: "error",
          snippet: "Showcase cards must flush Store theme accent strip (use CARD.player)",
        });
      }
    }
  }

  // Black primary audit on theme JSON if present
  try {
    const themesPath = join(SRC, "lib", "ui-themes.ts");
    const themesText = readFileSync(themesPath, "utf8");
    const blackPrimary = /primary:\s*["']#0{3,6}["']/gi;
    let m: RegExpExecArray | null;
    blackPrimary.lastIndex = 0;
    const themeLines = themesText.split(/\r?\n/);
    for (let i = 0; i < themeLines.length; i++) {
      if (/primary:\s*["']#(000|000000)["']/i.test(themeLines[i]!)) {
        findings.push({
          file: "src/lib/ui-themes.ts",
          line: i + 1,
          id: "black-primary-theme",
          severity: "error",
          snippet: themeLines[i]!.trim().slice(0, 120),
        });
      }
    }
    void m;
  } catch {
    // ignore
  }

  const errors = findings.filter((f) => f.severity === "error");
  const warns = findings.filter((f) => f.severity === "warn");

  console.log(`Team colours audit: ${errors.length} errors, ${warns.length} warnings`);
  for (const f of [...errors, ...warns].slice(0, 80)) {
    console.log(`[${f.severity}] ${f.id} ${f.file}:${f.line} — ${f.snippet}`);
  }
  if (findings.length > 80) {
    console.log(`…and ${findings.length - 80} more`);
  }

  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

main();
