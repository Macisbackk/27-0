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
  "src/components/ui/GameSegmentedControl.tsx",
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
  {
    id: "random-max-width",
    severity: "warn",
    regex: /\bmax-w-(?:4xl|5xl|6xl|7xl)\b/g,
    skipIf: (file) =>
      file.includes("design-system") ||
      file.includes("PageShell") ||
      file.includes("ManagerNav") ||
      file.includes("ManagerMobileBottomNav"),
  },
  {
    id: "left-accent-strip",
    severity: "error",
    regex: /\b(?:border-l-4|border-l-\[3px\]|!border-l-|inset-y-0 left-0 w-1)\b/g,
    skipIf: (file) =>
      file.includes("design-system.css") || file.includes("globals.css"),
  },
  {
    id: "manager-missing-shared-container",
    severity: "error",
    regex: /export function Manager(?:Hub|Inbox|Reserves|Contracts|Transfers|Fixtures|StatsView|Table|FriendlySelect)\b/,
    skipIf: () => true, // structural check handled in main()
  },
];

const MANAGER_TAB_FILES: Record<string, { requireSection?: boolean; allowWide?: boolean }> = {
  "src/components/manager/ManagerHub.tsx": { requireSection: true },
  "src/components/manager/ManagerInbox.tsx": { requireSection: true },
  "src/components/manager/ManagerReserves.tsx": { requireSection: true },
  "src/components/manager/ManagerContracts.tsx": { requireSection: true },
  "src/components/manager/ManagerTransfers.tsx": { requireSection: true },
  "src/components/manager/ManagerFixtures.tsx": { requireSection: true },
  "src/components/manager/ManagerStatsView.tsx": { requireSection: true },
  "src/components/manager/ManagerTable.tsx": { requireSection: true },
  "src/components/manager/ManagerTactics.tsx": { requireSection: true },
  "src/components/manager/ManagerClub.tsx": { requireSection: true },
  "src/components/manager/ManagerAcrossLeague.tsx": { requireSection: true },
  "src/components/manager/ManagerFriendlySelect.tsx": { requireSection: true },
  "src/components/manager/ManagerSquad.tsx": { requireSection: true },
  "src/components/manager/ManagerMatchReview.tsx": { requireSection: true },
};

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

function auditManagerContainers(findings: Finding[]) {
  const transfersPath = join(SRC, "components/manager/ManagerTransfers.tsx");
  const fixturesPath = join(SRC, "components/manager/ManagerFixtures.tsx");
  const reservesPath = join(SRC, "components/manager/ManagerReserves.tsx");
  const transfers = readFileSync(transfersPath, "utf8");
  const fixtures = readFileSync(fixturesPath, "utf8");
  const reserves = readFileSync(reservesPath, "utf8");

  const transfersUsesSection = /<ManagerSection[\s>]/.test(transfers);
  const fixturesUsesSection = /<ManagerSection[\s>]/.test(fixtures);
  const reservesUsesSection = /<ManagerSection[\s>]/.test(reserves);

  if (transfersUsesSection && !fixturesUsesSection) {
    findings.push({
      file: "src/components/manager/ManagerFixtures.tsx",
      line: 1,
      id: "fixtures-width-vs-transfers",
      severity: "error",
      snippet: "Fixtures must use ManagerSection like Transfers",
    });
  }
  if (transfersUsesSection && !reservesUsesSection) {
    findings.push({
      file: "src/components/manager/ManagerReserves.tsx",
      line: 1,
      id: "reserves-width-vs-transfers",
      severity: "error",
      snippet: "Reserves must use ManagerSection like Transfers",
    });
  }

  if (/ManagerSection\s+width=["']wide["']/.test(fixtures)) {
    findings.push({
      file: "src/components/manager/ManagerFixtures.tsx",
      line: 1,
      id: "fixtures-stretched-wide",
      severity: "error",
      snippet: "Fixtures should not use manager-section--wide",
    });
  }

  for (const [rel, opts] of Object.entries(MANAGER_TAB_FILES)) {
    const full = join(ROOT, rel);
    const text = readFileSync(full, "utf8");
    if (opts.requireSection && !/<Manager(?:Page|Section)[\s>]/.test(text)) {
      findings.push({
        file: rel,
        line: 1,
        id: "manager-missing-shared-container",
        severity: "error",
        snippet: "Manager tab missing ManagerPage/ManagerSection",
      });
    }
    if (
      !opts.allowWide &&
      (/ManagerSection\s+width=["']wide["']/.test(text) ||
        /ManagerPage\s+wide\b/.test(text) ||
        /manager-section--wide/.test(text)) &&
      !rel.includes("Squad")
    ) {
      findings.push({
        file: rel,
        line: 1,
        id: "manager-unnecessary-wide",
        severity: "warn",
        snippet: "Prefer default manager-section (980px) like Transfers",
      });
    }
    // Squad must still use the default 980px column (no page/section wide).
    if (
      rel.includes("ManagerSquad") &&
      (/ManagerPage\s+wide\b/.test(text) ||
        /ManagerSection\s+width=["']wide["']/.test(text))
    ) {
      findings.push({
        file: rel,
        line: 1,
        id: "squad-stretched-wide",
        severity: "error",
        snippet: "Squad must use default ManagerSection width like Transfers",
      });
    }
  }
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
      if (check.id === "manager-missing-shared-container") continue;
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

  auditManagerContainers(findings);

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
