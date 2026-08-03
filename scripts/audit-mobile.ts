#!/usr/bin/env npx tsx
/**
 * Static mobile usability checks for 27-0.
 * Detects: 100vw in padded containers, nested overflow-y-auto patterns,
 * oversized title classes, missing shared mobile tokens usage gaps.
 *
 * Run: npm run audit:mobile
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
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

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(p, out);
    } else if (/\.(tsx|ts|css)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

const CHECKS: {
  id: string;
  severity: "error" | "warn";
  regex: RegExp;
  skipIf?: (file: string, line: string) => boolean;
}[] = [
  {
    id: "raw-100vw",
    severity: "warn",
    regex: /\b100vw\b/g,
    skipIf: (file) =>
      file.includes("design-system") ||
      file.includes("globals.css") ||
      file.includes("SidebarNav") ||
      file.includes("MobileLayout"),
  },
  {
    id: "oversized-title-mobile",
    severity: "warn",
    regex: /\btext-(?:4xl|5xl|6xl)\b(?!.*sm:)/g,
    skipIf: (file, line) =>
      file.includes("LogoMark") ||
      file.includes("GradeBadge") ||
      file.includes("rl-card") ||
      file.includes("Modal") ||
      line.includes("aria-hidden") ||
      line.includes("sm:text-"),
  },
  {
    id: "nested-max-height-scroll",
    severity: "warn",
    regex: /max-h-\[[^\]]+\].*overflow-y-auto|overflow-y-auto.*max-h-\[/g,
    skipIf: (file) =>
      file.includes("Modal") ||
      file.includes("Dialog") ||
      file.includes("Sheet") ||
      file.includes("design-system") ||
      file.includes("MODAL") ||
      file.includes("MobileLayout"),
  },
  {
    id: "hardcoded-pb-28-action-pad",
    severity: "warn",
    regex: /\bpb-28\b/g,
    skipIf: (file) => file.includes("design-system"),
  },
  {
    id: "missing-min-w-0",
    severity: "warn",
    regex: /className=\{?[`"'][^`"']*\bflex\b[^`"']*\btruncate\b/g,
    skipIf: (_f, line) => line.includes("min-w-0"),
  },
];

function main() {
  const files = walk(SRC);
  const findings: Finding[] = [];

  // Token presence check
  const cssPath = join(SRC, "styles", "design-system.css");
  const css = readFileSync(cssPath, "utf8");
  const requiredTokens = [
    "--mobile-page-padding",
    "--mobile-section-gap",
    "--mobile-body-font-size",
    "--mobile-title-font-size",
    "--mobile-tap-target",
    "--app-content-max-width",
    "--text-section-header",
  ];
  for (const token of requiredTokens) {
    if (!css.includes(token)) {
      findings.push({
        file: relative(ROOT, cssPath).replace(/\\/g, "/"),
        line: 1,
        id: "missing-mobile-token",
        severity: "error",
        snippet: token,
      });
    }
  }

  // Shared component presence
  const mobileLayout = join(SRC, "components", "ui", "MobileLayout.tsx");
  const layoutSrc = readFileSync(mobileLayout, "utf8");
  for (const exportName of [
    "StickyActionBar",
    "CollapsibleDetails",
    "CompactInfoCard",
    "ContentBreakout",
    "MobileDataRow",
    "MobilePrimaryAction",
  ]) {
    if (!layoutSrc.includes(`export function ${exportName}`)) {
      findings.push({
        file: "src/components/ui/MobileLayout.tsx",
        line: 1,
        id: "missing-mobile-component",
        severity: "error",
        snippet: exportName,
      });
    }
  }

  for (const file of files) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    const text = readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      for (const check of CHECKS) {
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

  console.log(`Mobile audit: ${errors.length} errors, ${warns.length} warnings`);
  for (const f of [...errors, ...warns].slice(0, 80)) {
    console.log(`[${f.severity}] ${f.id} ${f.file}:${f.line}  ${f.snippet}`);
  }
  if (findings.length > 80) {
    console.log(`… ${findings.length - 80} more`);
  }

  if (errors.length > 0) process.exit(1);
}

main();
