#!/usr/bin/env npx tsx
/**
 * Audits UI consistency for the 27-0 design system.
 * Flags: raw CTAs, legacy panels, glass/blur, soft radii, Current green leaks,
 * plain text actions, page-specific card styles.
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
  "src/components/ui/panelSurfaces.ts",
  "src/components/ui/ProgrammePanel.tsx",
  "src/components/ui/ScoreboardPanel.tsx",
  "src/components/ui/ClipboardPanel.tsx",
  "src/components/ui/GamePanel.tsx",
  "src/components/ui/GameModal.tsx",
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
      file.includes("LeaderboardTabBar") ||
      file.includes("PitchSlot") ||
      file.includes("modal") ||
      file.toLowerCase().includes("dialog") ||
      file.includes("GameTableRow") ||
      file.includes("ShowcasePlayerCard"),
  },
  {
    id: "card-glass-hotspot",
    severity: "error",
    regex: /\bcard-glass\b/g,
    skipIf: (file) =>
      file.includes("design-system") || file.includes("globals.css"),
  },
  {
    id: "matchday-panel-hotspot",
    severity: "error",
    regex: /\bmatchday-panel\b/g,
    skipIf: (file) =>
      file.includes("design-system") || file.includes("globals.css"),
  },
  {
    id: "raw-programme-panel-string",
    severity: "warn",
    regex: /["'`][^"'`]*\bprogramme-panel\b/,
    skipIf: (file) =>
      file.includes("design-system") ||
      file.includes("panelSurfaces") ||
      file.includes("ProgrammePanel") ||
      file.includes("GamePanel"),
  },
  {
    id: "raw-scoreboard-panel-string",
    severity: "warn",
    regex: /["'`][^"'`]*\bscoreboard-panel\b/,
    skipIf: (file) =>
      file.includes("design-system") ||
      file.includes("panelSurfaces") ||
      file.includes("ScoreboardPanel") ||
      file.includes("GamePanel"),
  },
  {
    id: "backdrop-blur",
    severity: "error",
    regex: /\bbackdrop-blur(?:-sm|-md|-lg|-xl)?\b/g,
    skipIf: (file) =>
      file.includes("design-system.css") || file.includes("globals.css"),
  },
  {
    id: "rounded-2xl-hotspot",
    severity: "warn",
    regex: /\brounded-2xl\b/g,
    skipIf: (file) =>
      file.includes("design-system") ||
      file.includes("globals.css") ||
      file.includes("GradeBadge") ||
      file.includes("RecruitmentSlotReveal"),
  },
  {
    id: "rounded-3xl-hotspot",
    severity: "error",
    regex: /\brounded-3xl\b/g,
  },
  {
    id: "hardcoded-current-green-class",
    severity: "error",
    regex: /\b(text|bg|border|from|to|via)-accent-green\b/g,
    skipIf: (file) =>
      file.includes("ModeStart") ||
      file.includes("ChallengeCup") ||
      file.includes("globals.css") ||
      file.includes("design-system.css") ||
      file.includes("theme-css-vars") ||
      file.includes("ui-themes"),
  },
  {
    id: "tailwind-emerald-lime",
    severity: "error",
    regex: /\b(bg|text|border|from|to)-(emerald|lime)-/g,
  },
  {
    id: "btn-primary-legacy",
    severity: "warn",
    regex: /\bbtn-primary\b/g,
    skipIf: (file) => file.includes("globals.css"),
  },
  {
    id: "soft-rounded-xl-card",
    severity: "warn",
    regex: /\brounded-xl\b.*\b(border|bg-|shadow)/g,
    skipIf: (file) =>
      file.includes("design-system") ||
      file.includes("globals.css") ||
      file.includes("PitchSlot") ||
      file.includes("FILTER") ||
      file.includes("LeaderboardTabBar"),
  },
  {
    id: "neon-green-glow",
    severity: "warn",
    regex: /rgba\(34,\s*197,\s*94/g,
  },
  {
    id: "plain-text-action-underline",
    severity: "warn",
    regex: /<(?:button|a)\b[^>]*className=["'][^"']*\bunderline\b[^"']*["'][^>]*>/g,
    skipIf: (_file, line) =>
      line.includes("GameButton") || line.includes("LINK."),
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
  for (const f of [...errors, ...warns].slice(0, 120)) {
    console.log(
      `[${f.severity}] ${f.id} ${f.file}:${f.line} — ${f.snippet}`
    );
  }
  if (findings.length > 120) {
    console.log(`…and ${findings.length - 120} more`);
  }

  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

main();
