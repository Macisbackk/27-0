#!/usr/bin/env npx tsx
/**
 * Audits UI consistency for the 27-0 design system.
 * Flags: raw CTA buttons, old card-glass/matchday-panel hotspots, hardcoded Current green in generic UI.
 * Run: npm run audit:ui-consistency
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

const ALLOWLIST = new Set([
  "src/app/globals.css",
  "src/styles/design-system.css",
  "src/lib/ui/theme-css-vars.ts",
  "src/lib/ui/apply-ui-theme.ts",
  "src/lib/ui-themes.ts",
  "src/lib/ui/game-button-variants.ts",
  "src/lib/ui/design-system.ts",
  "src/components/ui/ActionButton.tsx",
  "src/components/ui/GameButton.tsx",
  "src/components/ui/buttons.tsx",
  "src/components/ModeStartLink.tsx",
  "src/components/ChallengeCupVariantToggle.tsx",
]);

const ALLOW_CARD_GLASS = new Set([
  // Temporary: CSS aliases still cover these; prefer migrating gradually
]);

const CHECKS: {
  id: string;
  severity: "error" | "warn";
  regex: RegExp;
  skipIf?: (file: string, line: string) => boolean;
}[] = [
  {
    id: "raw-button-cta",
    severity: "warn",
    regex: /<button\b[^>]*(?:onClick|type=["']submit["'])[^>]*>/g,
    skipIf: (file, line) =>
      line.includes("GameButton") ||
      line.includes("game-button") ||
      line.includes("aria-label") ||
      file.includes("SidebarNav") ||
      file.includes("Header") ||
      file.includes("ManagerNav") ||
      file.includes("ManagerMobileBottomNav") ||
      file.includes("ManagerSubTabBar") ||
      file.includes("GameTabs") ||
      file.includes("PitchSlot") ||
      file.includes("modal") ||
      file.toLowerCase().includes("dialog"),
  },
  {
    id: "card-glass-hotspot",
    severity: "warn",
    regex: /\bcard-glass\b/g,
    skipIf: (file) =>
      file.includes("design-system") || file.includes("globals.css"),
  },
  {
    id: "matchday-panel-hotspot",
    severity: "warn",
    regex: /\bmatchday-panel\b/g,
    skipIf: (file) =>
      file.includes("design-system") || file.includes("globals.css"),
  },
  {
    id: "hardcoded-current-green-class",
    severity: "warn",
    regex: /\b(text|bg|border)-accent-green\b/g,
    skipIf: (file) =>
      file.includes("ModeStart") ||
      file.includes("ChallengeCup") ||
      file.includes("globals.css") ||
      file.includes("design-system.css"),
  },
  {
    id: "btn-primary-legacy",
    severity: "warn",
    regex: /\bbtn-primary\b/g,
    skipIf: (file) => file.includes("globals.css"),
  },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(tsx|ts|css)$/.test(name)) out.push(full);
  }
  return out;
}

function main() {
  const files = walk(SRC);
  const findings: Finding[] = [];

  for (const file of files) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    if (ALLOWLIST.has(rel)) continue;
    if (ALLOW_CARD_GLASS.has(rel) && false) continue;

    const text = readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);

    for (const check of CHECKS) {
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
  }

  const errors = findings.filter((f) => f.severity === "error");
  const warns = findings.filter((f) => f.severity === "warn");

  console.log(`UI consistency audit: ${errors.length} errors, ${warns.length} warnings`);
  for (const f of [...errors, ...warns].slice(0, 80)) {
    console.log(
      `[${f.severity}] ${f.id} ${f.file}:${f.line} — ${f.snippet}`
    );
  }
  if (findings.length > 80) {
    console.log(`…and ${findings.length - 80} more`);
  }

  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

main();
