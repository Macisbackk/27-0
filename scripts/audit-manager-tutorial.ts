#!/usr/bin/env npx tsx
/**
 * Regression audit for rebuilt Manager Mode tutorial.
 * Run: npx tsx scripts/audit-manager-tutorial.ts
 */

import {
  MANAGER_TUTORIAL_STEPS,
  resolveTutorialInteractionPhase,
  resolveTutorialPhaseTargets,
  tutorialLockTargetForPhase,
  tutorialPhaseNeedsTap,
  type ManagerTutorialStepDef,
} from "../src/lib/manager/managerTutorial";
import { isManagerMobileMoreNavView } from "../src/lib/manager/manager-nav-config";
import type { ManagerView } from "../src/lib/manager/types";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

type Finding = { severity: "error" | "warn"; message: string };
const findings: Finding[] = [];

function err(message: string) {
  findings.push({ severity: "error", message });
}
function warn(message: string) {
  findings.push({ severity: "warn", message });
}

function assertPhase(
  step: ManagerTutorialStepDef,
  opts: {
    compact: boolean;
    moreOpen: boolean;
    currentView: ManagerView | null;
  },
  expected: string
) {
  const phase = resolveTutorialInteractionPhase(step, opts);
  if (phase !== expected) {
    err(
      `${step.id}: expected phase "${expected}" with ${JSON.stringify(opts)}, got "${phase}"`
    );
  }
}

// Old measurement/elevate system must be gone.
const legacyLayout = join(
  process.cwd(),
  "src/lib/manager/tutorialTargetLayout.ts"
);
if (existsSync(legacyLayout)) {
  err("legacy tutorialTargetLayout.ts still exists — delete it");
}

const overlayPath = join(
  process.cwd(),
  "src/components/manager/ManagerTutorialOverlay.tsx"
);
const overlaySrc = readFileSync(overlayPath, "utf8");
if (overlaySrc.includes("elevateTutorialTarget")) {
  err("overlay still elevates DOM targets — hole blockers only");
}
if (overlaySrc.includes("ResizeObserver")) {
  err("overlay must not use ResizeObserver (measurement loops)");
}
if (overlaySrc.includes("visualViewport") && overlaySrc.includes('"scroll"')) {
  // soft check — scroll listener on visualViewport is a known flicker source
  if (/visualViewport[\s\S]{0,200}addEventListener\(\s*["']scroll["']/.test(overlaySrc)) {
    err("overlay must not listen to visualViewport scroll");
  }
}

for (const step of MANAGER_TUTORIAL_STEPS) {
  if (step.requireAction && !step.action) {
    err(`${step.id}: requireAction without action`);
  }
  if (step.action === "nav" && !step.navView) {
    err(`${step.id}: nav action missing navView`);
  }
  if (step.requireAction && step.action === "nav" && !step.targets) {
    err(`${step.id}: interactive nav step needs targets`);
  }
  if (step.targets) {
    if (!step.targets.desktop?.length || !step.targets.mobile?.length) {
      err(`${step.id}: targets must define desktop and mobile lists`);
    }
  }
  if (step.action === "open-more" && !step.mobileOnly) {
    err(`${step.id}: open-more must be mobileOnly`);
  }
  if (
    step.action === "open-more" &&
    !step.targets?.mobile.includes("manager-nav-more")
  ) {
    err(`${step.id}: open-more must target manager-nav-more`);
  }

  if (step.requireAction && step.action === "nav" && step.view) {
    warn(
      `${step.id}: interactive nav step also sets view="${step.view}" (soft-nav risk)`
    );
  }

  if (step.action === "nav" && step.navView) {
    const inMore = isManagerMobileMoreNavView(step.navView);

    assertPhase(
      step,
      { compact: true, moreOpen: false, currentView: "hub" },
      inMore ? "open-more" : "action"
    );
    if (inMore) {
      assertPhase(
        step,
        { compact: true, moreOpen: true, currentView: "hub" },
        "action"
      );
      const openTargets = resolveTutorialPhaseTargets(step, "open-more", true);
      if (!openTargets?.includes("manager-nav-more")) {
        err(`${step.id}: open-more phase must spotlight More`);
      }
      const actionTargets = resolveTutorialPhaseTargets(step, "action", true);
      if (actionTargets?.some((t) => t.includes("-desktop"))) {
        err(`${step.id}: mobile action must not use desktop targets`);
      }
    }
    assertPhase(
      step,
      { compact: false, moreOpen: false, currentView: "hub" },
      "action"
    );

    const deskTargets = resolveTutorialPhaseTargets(step, "action", false);
    if (deskTargets?.some((t) => t.endsWith("-mobile") || t.endsWith("-more"))) {
      err(`${step.id}: desktop action must not use mobile/more targets`);
    }

    assertPhase(
      step,
      {
        compact: true,
        moreOpen: inMore,
        currentView: step.navView,
      },
      step.contentTargets ? "content" : "next"
    );

    const actionPhase = resolveTutorialInteractionPhase(step, {
      compact: true,
      moreOpen: inMore,
      currentView: "hub",
    });
    if (tutorialPhaseNeedsTap(actionPhase)) {
      const lock = tutorialLockTargetForPhase(step, actionPhase);
      if (actionPhase === "open-more" && lock !== "more") {
        err(`${step.id}: open-more phase lock should be "more"`);
      }
      if (actionPhase === "action" && lock !== step.navView) {
        err(
          `${step.id}: action phase lock should be "${step.navView}", got "${lock}"`
        );
      }
    }
  }

  if (step.action === "advance-week") {
    assertPhase(
      step,
      { compact: true, moreOpen: false, currentView: "hub" },
      "action"
    );
    const lock = tutorialLockTargetForPhase(step, "action");
    if (lock !== "advance-week") {
      err(`${step.id}: advance-week lock should be "advance-week"`);
    }
    const mobile = resolveTutorialPhaseTargets(step, "action", true) ?? [];
    const desktop = resolveTutorialPhaseTargets(step, "action", false) ?? [];
    if (!mobile.includes("manager-hub-advance-week-mobile")) {
      err(`${step.id}: mobile must prefer advance-week-mobile`);
    }
    if (!desktop.includes("manager-hub-advance-week-desktop")) {
      err(`${step.id}: desktop must use advance-week-desktop`);
    }
    if (desktop.includes("manager-hub-advance-week-mobile")) {
      err(`${step.id}: desktop must not list sticky mobile target`);
    }
  }

  if (step.action === "open-more") {
    assertPhase(
      step,
      { compact: true, moreOpen: false, currentView: "hub" },
      "action"
    );
    assertPhase(
      step,
      { compact: true, moreOpen: true, currentView: "hub" },
      "next"
    );
  }
}

for (const id of ["contracts", "transfers"] as const) {
  const step = MANAGER_TUTORIAL_STEPS.find((s) => s.id === id);
  if (!step?.navView) continue;
  if (isManagerMobileMoreNavView(step.navView)) {
    err(`${id}: should not be a More-sheet destination on mobile`);
  }
}

for (const id of ["fixtures", "stats"] as const) {
  const step = MANAGER_TUTORIAL_STEPS.find((s) => s.id === id);
  if (!step?.navView) continue;
  if (!isManagerMobileMoreNavView(step.navView)) {
    err(`${id}: should be a More-sheet destination on mobile`);
  }
}

// Source scan: no shared data-tutorial-id left.
const srcRoots = [
  "src/components/manager/ManagerHub.tsx",
  "src/components/manager/ManagerHubStickyActions.tsx",
  "src/components/manager/ManagerNav.tsx",
  "src/components/manager/ManagerMobileBottomNav.tsx",
  "src/app/manager/[[...section]]/ManagerSectionClient.tsx",
  "src/components/manager/ManagerFixtures.tsx",
];
for (const rel of srcRoots) {
  const full = join(process.cwd(), rel);
  if (!existsSync(full)) {
    err(`missing file ${rel}`);
    continue;
  }
  const text = readFileSync(full, "utf8");
  if (text.includes("data-tutorial-id")) {
    err(`${rel}: still uses data-tutorial-id — migrate to data-tutorial-target`);
  }
  if (text.includes("data-tutorial-surface")) {
    err(`${rel}: still uses data-tutorial-surface — removed in rebuild`);
  }
}

const interactive = MANAGER_TUTORIAL_STEPS.filter((s) => s.requireAction);
console.log(
  `Tutorial steps: ${MANAGER_TUTORIAL_STEPS.length} (${interactive.length} interactive)`
);

const errors = findings.filter((f) => f.severity === "error");
const warns = findings.filter((f) => f.severity === "warn");
for (const f of findings) {
  console.log(`${f.severity.toUpperCase()}: ${f.message}`);
}

if (errors.length === 0) {
  console.log("PASS: manager tutorial rebuild audit clean.");
  process.exit(0);
}
console.error(`FAIL: ${errors.length} error(s), ${warns.length} warning(s).`);
process.exit(1);
