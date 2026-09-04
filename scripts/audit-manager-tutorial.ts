#!/usr/bin/env npx tsx
/**
 * Regression audit for Manager Mode tutorial step → target → action → state.
 * Run: npx tsx scripts/audit-manager-tutorial.ts
 */

import {
  MANAGER_TUTORIAL_STEPS,
  getTutorialStepCopy,
  resolveTutorialInteractionPhase,
  resolveTutorialPhaseTargetId,
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
  err("overlay still elevates DOM targets — hole blockers / chrome elevate only");
}
if (overlaySrc.includes("ResizeObserver")) {
  err("overlay must not use ResizeObserver (measurement loops)");
}
if (/visualViewport[\s\S]{0,200}addEventListener\(\s*["']scroll["']/.test(overlaySrc)) {
  err("overlay must not listen to visualViewport scroll");
}
if (!overlaySrc.includes("isTutorialChromeTarget")) {
  err("overlay must distinguish chrome vs in-page targets for click architecture");
}
if (!overlaySrc.includes("getTutorialStepCopy")) {
  err("overlay must use phase-aware copy from the step definition");
}
if (!overlaySrc.includes("waitForTutorialTarget")) {
  err("overlay must wait for real targets");
}
// Must unwrap resolve result (not treat object as HTMLElement).
if (
  /const el = await waitForTutorialTarget/.test(overlaySrc) &&
  !/result\.(el|ambiguous)/.test(overlaySrc)
) {
  err("overlay must use waitForTutorialTarget().el — not the result object as element");
}

for (const step of MANAGER_TUTORIAL_STEPS) {
  if (step.requireAction && !step.action) {
    err(`${step.id}: requireAction without action`);
  }
  if (step.action === "nav" && !step.navView) {
    err(`${step.id}: nav action missing navView`);
  }
  if (step.requireAction && (step.action === "nav" || step.action === "advance-week" || step.action === "open-more")) {
    if (!step.target?.desktop || !step.target?.mobile) {
      err(`${step.id}: interactive step needs target.desktop and target.mobile`);
    }
  }
  if (step.target) {
    if (!step.target.desktop || !step.target.mobile) {
      err(`${step.id}: target must define desktop and mobile ids`);
    }
  }
  if ((step as { targets?: unknown }).targets) {
    err(`${step.id}: legacy targets[] lists — use single target.{desktop,mobile}`);
  }
  if ((step as { contentTargets?: unknown }).contentTargets) {
    err(`${step.id}: legacy contentTargets — use contentTarget`);
  }
  if (step.action === "nav" && step.contentTarget) {
    if (!step.contentTarget.desktop || !step.contentTarget.mobile) {
      err(`${step.id}: contentTarget must define desktop and mobile`);
    }
  }
  if (step.action === "nav" && !step.expectedState?.view) {
    err(`${step.id}: nav step must declare expectedState.view`);
  }
  if (step.action === "open-more" && step.expectedState?.moreOpen !== true) {
    err(`${step.id}: open-more must expect moreOpen: true`);
  }
  if (step.action === "open-more" && !step.mobileOnly) {
    err(`${step.id}: open-more must be mobileOnly`);
  }
  if (
    step.action === "open-more" &&
    step.target?.mobile !== "manager-nav-more"
  ) {
    err(`${step.id}: open-more must target manager-nav-more`);
  }

  if (step.requireAction && step.action === "nav" && step.view) {
    warn(
      `${step.id}: interactive nav step also sets view="${step.view}" (soft-nav risk)`
    );
  }

  // Copy must name the control for action phases.
  if (step.requireAction && step.action === "nav") {
    const actionCopy = getTutorialStepCopy(step, "action", false);
    if (!actionCopy.hint) {
      err(`${step.id}: nav action needs hint naming the control`);
    }
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
      const openId = resolveTutorialPhaseTargetId(step, "open-more", true);
      if (openId !== "manager-nav-more") {
        err(`${step.id}: open-more phase must spotlight manager-nav-more`);
      }
      const actionId = resolveTutorialPhaseTargetId(step, "action", true);
      if (actionId?.includes("-desktop")) {
        err(`${step.id}: mobile action must not use desktop target`);
      }
      if (!actionId?.endsWith("-more")) {
        err(`${step.id}: mobile More-path action should use *-more target`);
      }
      const moreCopy = getTutorialStepCopy(step, "action", true);
      if (!moreCopy.hint) {
        err(`${step.id}: More-path action needs moreHint/hint`);
      }
    }
    assertPhase(
      step,
      { compact: false, moreOpen: false, currentView: "hub" },
      "action"
    );

    const deskId = resolveTutorialPhaseTargetId(step, "action", false);
    if (deskId?.endsWith("-mobile") || deskId?.endsWith("-more")) {
      err(`${step.id}: desktop action must not use mobile/more target`);
    }

    assertPhase(
      step,
      {
        compact: true,
        moreOpen: inMore,
        currentView: step.navView,
      },
      step.contentTarget ? "content" : "next"
    );

    if (step.expectedState?.view !== step.navView) {
      err(
        `${step.id}: expectedState.view (${step.expectedState?.view}) must match navView (${step.navView})`
      );
    }

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
    const mobile = resolveTutorialPhaseTargetId(step, "action", true);
    const desktop = resolveTutorialPhaseTargetId(step, "action", false);
    if (mobile !== "manager-hub-advance-week-mobile") {
      err(`${step.id}: mobile must use advance-week-mobile`);
    }
    if (desktop !== "manager-hub-advance-week-desktop") {
      err(`${step.id}: desktop must use advance-week-desktop`);
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

// Collect every target id referenced by steps and ensure it appears in sources.
const allTargetIds = new Set<string>();
for (const step of MANAGER_TUTORIAL_STEPS) {
  if (step.target) {
    allTargetIds.add(step.target.desktop);
    allTargetIds.add(step.target.mobile);
  }
  if (step.contentTarget) {
    allTargetIds.add(step.contentTarget.desktop);
    allTargetIds.add(step.contentTarget.mobile);
  }
}
allTargetIds.add("manager-nav-more");

const scanned = srcRoots
  .map((rel) => {
    const full = join(process.cwd(), rel);
    return existsSync(full) ? readFileSync(full, "utf8") : "";
  })
  .join("\n");

for (const id of allTargetIds) {
  // Dynamic attrs like manager-nav-${tab.id}-desktop won't appear literally.
  if (
    id.startsWith("manager-nav-") &&
    (id.endsWith("-desktop") || id.endsWith("-mobile") || id.endsWith("-more"))
  ) {
    const stem = id
      .replace(/^manager-nav-/, "")
      .replace(/-desktop$/, "")
      .replace(/-mobile$/, "")
      .replace(/-more$/, "");
    if (stem === "more") {
      if (!scanned.includes('data-tutorial-target="manager-nav-more"')) {
        err(`DOM missing data-tutorial-target="manager-nav-more"`);
      }
      continue;
    }
    // Pattern constructed in JSX templates.
    if (
      !scanned.includes("manager-nav-${") &&
      !scanned.includes(`data-tutorial-target="${id}"`)
    ) {
      warn(`${id}: no literal or template nav target pattern found`);
    }
    continue;
  }
  const literal = `data-tutorial-target="${id}"`;
  const jsxProp = `"data-tutorial-target": "${id}"`;
  if (!scanned.includes(literal) && !scanned.includes(jsxProp)) {
    err(`DOM missing data-tutorial-target="${id}"`);
  }
}

const interactive = MANAGER_TUTORIAL_STEPS.filter((s) => s.requireAction);
console.log(
  `Tutorial steps: ${MANAGER_TUTORIAL_STEPS.length} (${interactive.length} interactive)`
);
console.log("\nStep | Text action | Desktop target | Mobile target | Expected state");
console.log("-".repeat(90));
for (const step of MANAGER_TUTORIAL_STEPS) {
  const textAction =
    step.action === "nav"
      ? step.hint ?? `open ${step.navView}`
      : step.action === "open-more"
        ? step.hint ?? "open More"
        : step.action === "advance-week"
          ? step.hint ?? "Advance Week"
          : "observe / Next";
  const desk = step.target?.desktop ?? "—";
  const mob = step.target?.mobile ?? "—";
  const expected = step.expectedState
    ? JSON.stringify(step.expectedState)
    : "—";
  console.log(
    `${step.id} | ${textAction} | ${desk} | ${mob} | ${expected}`
  );
}

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
