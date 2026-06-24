#!/usr/bin/env npx tsx
/**
 * Audits button colour usage — warns when generic UI may leak Current green.
 * Run: npm run audit:button-colours
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const SRC = join(ROOT, "src");

const GREEN_PATTERNS: { id: string; regex: RegExp; severity: "error" | "warn" }[] = [
  { id: "hex-green", regex: /#22c55e|#16a34a|#15803d/gi, severity: "warn" },
  { id: "tailwind-green", regex: /\b(bg|text|border|ring|from|to|shadow)-green-/g, severity: "error" },
  { id: "tailwind-emerald", regex: /\b(bg|text|border|from|to)-emerald-/g, severity: "warn" },
  { id: "mode-start-on-generic", regex: /variant=["']primary["'][^>]*hardMode|primaryLg(?!Hard)/g, severity: "warn" },
  {
    id: "generic-current-variant",
    regex: /variant=["']current["']/g,
    severity: "warn",
  },
  {
    id: "btn-primary-class",
    regex: /\bbtn-primary\b/g,
    severity: "warn",
  },
  {
    id: "mode-start-without-current",
    regex: /mode-start-btn(?!-hard)/g,
    severity: "warn",
  },
];

const ALLOWLIST_FILES = new Set([
  "src/lib/ui/theme-css-vars.ts",
  "src/lib/ui/apply-ui-theme.ts",
  "src/lib/ui-themes.ts",
  "src/app/globals.css",
  "src/lib/ui/game-button-variants.ts",
  "scripts/audit-button-colours.ts",
]);

const ALLOWLIST_LINE = [
  /mode-current/,
  /mode-start-btn/,
  /game-button--current/,
  /Current Mode/,
  /semantic/,
  /rating/,
  /success/,
  /broadcast-rating/,
  /rl-status-current/,
  /pitch-line/,
  /Confetti/,
  /DEFAULT_UI_THEME/,
  /SEMANTIC/,
  /--success/,
  /--rating/,
  /--mode-current/,
  /variant=["']current["'].*Mode/,
  /ModeStart/,
  /getModeStartButtonClass/,
  /modeCurrent/,
  /MODE_CURRENT/,
  /mode-start-btn-hard/,
  /game-button--success/,
  /variant=["']success["']/,
];

type Finding = {
  file: string;
  line: number;
  id: string;
  severity: "error" | "warn";
  snippet: string;
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(path, out);
    } else if (/\.(tsx?|css)$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

function isAllowlisted(file: string, line: string): boolean {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  if (ALLOWLIST_FILES.has(rel)) return true;
  return ALLOWLIST_LINE.some((re) => re.test(line));
}

function auditFile(file: string): Finding[] {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  const content = readFileSync(file, "utf8");
  const lines = content.split("\n");
  const findings: Finding[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isAllowlisted(file, line)) continue;

    for (const pattern of GREEN_PATTERNS) {
      if (!pattern.regex.test(line)) {
        pattern.regex.lastIndex = 0;
        continue;
      }
      pattern.regex.lastIndex = 0;

      if (pattern.id === "generic-current-variant") {
        const genericHints = [
          "Play Again",
          "Return Home",
          "Continue",
          "Confirm",
          "Buy",
          "Select",
          "Simulate Selected",
          "Leaderboard",
        ];
        const isModeContext =
          /ModeStart|Start Normal|Start Era|Challenge Cup|modeVariant|modeCurrent|Current toggle/i.test(
            line
          ) || /ChallengeCupBracket|ModeStartLink/.test(rel);
        const looksGeneric = genericHints.some((h) => content.includes(h));
        if (!looksGeneric || isModeContext) continue;
      }

      if (pattern.id === "mode-start-without-current") {
        if (
          /game-button--current|currentStart|ModeStart|mode-button-variant/.test(
            line
          )
        ) {
          continue;
        }
      }

      findings.push({
        file: rel,
        line: i + 1,
        id: pattern.id,
        severity: pattern.severity,
        snippet: line.trim().slice(0, 120),
      });
    }
  }

  return findings;
}

function checkPrimaryMapping(): Finding[] {
  const file = join(SRC, "components", "ui", "ActionButton.tsx");
  const content = readFileSync(file, "utf8");
  if (/primary.*theme|resolveVariant.*theme/.test(content)) return [];
  return [
    {
      file: "src/components/ui/ActionButton.tsx",
      line: 0,
      id: "primary-not-theme",
      severity: "error",
      snippet: "primary variant must alias to theme, not green",
    },
  ];
}

const files = walk(SRC);
const findings = [...checkPrimaryMapping(), ...files.flatMap(auditFile)];

const errors = findings.filter((f) => f.severity === "error");
const warnings = findings.filter((f) => f.severity === "warn");

console.log("27-0 button colour audit\n");
console.log(`Scanned ${files.length} files`);
console.log(`Errors: ${errors.length}  Warnings: ${warnings.length}\n`);

for (const f of [...errors, ...warnings]) {
  const tag = f.severity === "error" ? "ERROR" : "WARN ";
  const loc = f.line > 0 ? `${f.file}:${f.line}` : f.file;
  console.log(`${tag} [${f.id}] ${loc}`);
  console.log(`      ${f.snippet}\n`);
}

if (errors.length > 0) {
  console.error("Audit failed — fix errors above.");
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn("Audit passed with warnings — review items above.");
} else {
  console.log("Audit passed — no button colour issues found.");
}
