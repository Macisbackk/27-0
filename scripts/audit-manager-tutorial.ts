#!/usr/bin/env npx tsx
/**
 * Regression audit for Manager Mode tutorial interaction architecture.
 * Validates step definitions, phase machine, and mobile More navigation rules
 * without a browser. Run: npx tsx scripts/audit-manager-tutorial.ts
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

for (const step of MANAGER_TUTORIAL_STEPS) {
  if (step.requireAction && !step.action) {
    err(`${step.id}: requireAction without action`);
  }
  if (step.action === "nav" && !step.navView) {
    err(`${step.id}: nav action missing navView`);
  }
  if (step.requireAction && step.action === "nav" && !step.targets?.length) {
    err(`${step.id}: interactive nav step needs targets`);
  }
  if (step.action === "open-more" && !step.mobileOnly) {
    err(`${step.id}: open-more must be mobileOnly`);
  }
  if (step.action === "open-more" && !step.targets?.includes("manager-nav-more")) {
    err(`${step.id}: open-more must target manager-nav-more`);
  }

  // Interactive steps must not soft-navigate away from the player's tap.
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
      const openTargets = resolveTutorialPhaseTargets(step, "open-more");
      if (!openTargets?.includes("manager-nav-more")) {
        err(`${step.id}: open-more phase must spotlight More`);
      }
    }
    assertPhase(
      step,
      { compact: false, moreOpen: false, currentView: "hub" },
      "action"
    );
    assertPhase(
      step,
      {
        compact: true,
        moreOpen: inMore,
        currentView: step.navView,
      },
      step.contentTargets?.length ? "content" : "next"
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

// Contracts/Transfers live in the primary bottom bar — never require More first.
for (const id of ["contracts", "transfers"] as const) {
  const step = MANAGER_TUTORIAL_STEPS.find((s) => s.id === id);
  if (!step?.navView) continue;
  if (isManagerMobileMoreNavView(step.navView)) {
    err(`${id}: should not be a More-sheet destination on mobile`);
  }
}

// Fixtures/Stats are More destinations on mobile.
for (const id of ["fixtures", "stats"] as const) {
  const step = MANAGER_TUTORIAL_STEPS.find((s) => s.id === id);
  if (!step?.navView) continue;
  if (!isManagerMobileMoreNavView(step.navView)) {
    err(`${id}: should be a More-sheet destination on mobile`);
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
  console.log("PASS: manager tutorial architecture audit clean.");
  process.exit(0);
}
console.error(`FAIL: ${errors.length} error(s), ${warns.length} warning(s).`);
process.exit(1);
