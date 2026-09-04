#!/usr/bin/env npx tsx
/**
 * Audit rebuilt Manager Mode tutorial (minimal guide).
 * Run: npm run audit:manager-tutorial
 */
import {
  MANAGER_TUTORIAL_STEPS,
  resolveStepTargetId,
  stepExpectationMet,
  tutorialNavLockForStep,
  type ManagerTutorialStep,
} from "../src/lib/manager/managerTutorial";
import { isManagerMobileMoreNavView } from "../src/lib/manager/manager-nav-config";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

type Finding = { severity: "error" | "warn"; message: string };
const findings: Finding[] = [];
function err(m: string) {
  findings.push({ severity: "error", message: m });
}
function warn(m: string) {
  findings.push({ severity: "warn", message: m });
}

// Deleted legacy files must stay gone.
for (const rel of [
  "src/lib/manager/tutorialGeometry.ts",
  "src/lib/manager/tutorialTargetLayout.ts",
  "src/components/manager/ManagerOnboardingModal.tsx",
  "src/components/manager/ManagerOnboardingStrip.tsx",
]) {
  if (existsSync(join(process.cwd(), rel))) {
    err(`legacy file still exists: ${rel}`);
  }
}

const overlay = readFileSync(
  join(process.cwd(), "src/components/manager/ManagerTutorialOverlay.tsx"),
  "utf8"
);
if (overlay.includes("tutorialGeometry")) {
  err("overlay still imports tutorialGeometry");
}
if (overlay.includes("scrollIntoView")) {
  err("overlay must not use scrollIntoView");
}
if (overlay.includes("ResizeObserver") || overlay.includes("MutationObserver")) {
  err("overlay must not use continuous observers");
}
if (overlay.includes("acquireScrollLock")) {
  err("overlay must not body-scroll-lock (choice modal may)");
}
if (overlay.includes("onNavigate")) {
  err("overlay must not drive Manager Mode navigation");
}

for (const step of MANAGER_TUTORIAL_STEPS) {
  if (step.action === "click") {
    if (!step.targetId) err(`${step.id}: click needs targetId`);
    if (!step.expected?.tab) err(`${step.id}: click needs expected.tab`);
    if (!step.description.toLowerCase().includes("open")) {
      warn(`${step.id}: click copy should say Open …`);
    }
  }
  if (step.action === "open-menu") {
    if (step.targetId !== "manager-more") {
      err(`${step.id}: open-menu must target manager-more`);
    }
    if (!step.mobileOnly) err(`${step.id}: open-menu must be mobileOnly`);
    if (step.expected?.moreOpen !== true) {
      err(`${step.id}: open-menu must expect moreOpen`);
    }
  }
  if (step.action === "inspect" && step.targetId) {
    // ok
  }
}

// Mobile More gating for fixtures/stats/club
for (const id of ["fixtures", "stats", "club"] as const) {
  const step = MANAGER_TUTORIAL_STEPS.find((s) => s.id === id)!;
  if (!step.expected?.tab || !isManagerMobileMoreNavView(step.expected.tab)) {
    err(`${id}: should live under mobile More`);
  }
  const closed = resolveStepTargetId(step, {
    compact: true,
    moreOpen: false,
    currentView: "hub",
  });
  if (closed !== "manager-more") {
    err(`${id}: when More closed, target must be manager-more (got ${closed})`);
  }
  const open = resolveStepTargetId(step, {
    compact: true,
    moreOpen: true,
    currentView: "hub",
  });
  if (open !== step.targetId) {
    err(`${id}: when More open, target must be ${step.targetId} (got ${open})`);
  }
  const lockClosed = tutorialNavLockForStep(step, {
    compact: true,
    moreOpen: false,
    currentView: "hub",
  });
  if (lockClosed !== "more") {
    err(`${id}: lock when More closed should be more`);
  }
  const lockOpen = tutorialNavLockForStep(step, {
    compact: true,
    moreOpen: true,
    currentView: "hub",
  });
  if (lockOpen !== step.expected.tab) {
    err(`${id}: lock when More open should be ${step.expected.tab}`);
  }
  if (
    !stepExpectationMet(step, {
      moreOpen: true,
      currentView: step.expected.tab,
    })
  ) {
    err(`${id}: expectation should be met on its tab`);
  }
}

{
  const step = MANAGER_TUTORIAL_STEPS.find((s) => s.id === "settings")!;
  if (!step || step.targetId !== "manager-club-settings") {
    err("settings: must target manager-club-settings");
  }
  const onClub = resolveStepTargetId(step, {
    compact: false,
    moreOpen: false,
    currentView: "club",
    clubOfficeTab: "finances",
  });
  if (onClub !== "manager-club-settings") {
    err(`settings: on club finances should highlight settings tab (got ${onClub})`);
  }
  if (
    !stepExpectationMet(step, {
      moreOpen: false,
      currentView: "club",
      clubOfficeTab: "settings",
    })
  ) {
    err("settings: expectation unmet when clubTab=settings");
  }
  const offClub = resolveStepTargetId(step, {
    compact: true,
    moreOpen: false,
    currentView: "hub",
    clubOfficeTab: null,
  });
  if (offClub !== "manager-more") {
    err(`settings: off club on mobile should gate via More (got ${offClub})`);
  }
}

for (const id of ["squad", "reserves", "contracts", "transfers"] as const) {
  const step = MANAGER_TUTORIAL_STEPS.find((s) => s.id === id)!;
  if (isManagerMobileMoreNavView(step.expected!.tab!)) {
    err(`${id}: should NOT be under mobile More`);
  }
  const t = resolveStepTargetId(step, {
    compact: true,
    moreOpen: false,
    currentView: "hub",
  });
  if (t !== step.targetId) {
    err(`${id}: mobile bottom target should be ${step.targetId}`);
  }
}

// DOM presence
const srcFiles = [
  "src/components/manager/ManagerHub.tsx",
  "src/components/manager/ManagerNav.tsx",
  "src/components/manager/ManagerMobileBottomNav.tsx",
];
const scanned = srcFiles
  .map((rel) => {
    const p = join(process.cwd(), rel);
    return existsSync(p) ? readFileSync(p, "utf8") : "";
  })
  .join("\n");

if (!scanned.includes('data-tutorial-target="manager-hub"')) {
  err("missing manager-hub target");
}
if (!scanned.includes('data-tutorial-target="manager-season-progress"')) {
  err("missing manager-season-progress target");
}
if (!scanned.includes('data-tutorial-target="manager-more"')) {
  err("missing manager-more target");
}
if (!scanned.includes("manager-nav-${")) {
  err("nav templates missing manager-nav-${…}");
}

const clubSrc = readFileSync(
  join(process.cwd(), "src/components/manager/ManagerClub.tsx"),
  "utf8"
);
if (!clubSrc.includes('tutorialTarget: "manager-club-settings"')) {
  err("Club Settings tab missing manager-club-settings tutorialTarget");
}

const hubSrc = readFileSync(
  join(process.cwd(), "src/components/manager/ManagerHub.tsx"),
  "utf8"
);
if (/manager-season-progress[\s\S]{0,80}hidden sm:block/.test(hubSrc)) {
  err("season progress must stay visible on mobile (do not hide whole card)");
}
if (!hubSrc.includes('data-tutorial-target="manager-season-progress"')) {
  err("missing manager-season-progress on Hub");
}

// No legacy suffix ids left in DOM
if (scanned.includes("-desktop") && scanned.includes("data-tutorial-target")) {
  if (/data-tutorial-target=\{`manager-nav-\$\{[^}]+\}-desktop`\}/.test(scanned)) {
    err("legacy -desktop nav targets still present");
  }
}
if (/data-tutorial-target=\{`manager-nav-\$\{[^}]+\}-mobile`\}/.test(scanned)) {
  err("legacy -mobile nav targets still present");
}
if (/data-tutorial-target=\{`manager-nav-\$\{[^}]+\}-more`\}/.test(scanned)) {
  err("legacy -more nav targets still present");
}

console.log("Step | Text | Target | Action | Expected");
console.log("-".repeat(88));
for (const step of MANAGER_TUTORIAL_STEPS) {
  console.log(
    `${step.id} | ${step.description.slice(0, 42)}… | ${step.targetId ?? "—"} | ${step.action} | ${
      step.expected ? JSON.stringify(step.expected) : "—"
    }`
  );
}

const errors = findings.filter((f) => f.severity === "error");
const warns = findings.filter((f) => f.severity === "warn");
for (const f of findings) {
  console.log(`${f.severity.toUpperCase()}: ${f.message}`);
}
if (errors.length === 0) {
  console.log(`PASS: ${MANAGER_TUTORIAL_STEPS.length} steps, ${warns.length} warning(s).`);
  process.exit(0);
}
console.error(`FAIL: ${errors.length} error(s).`);
process.exit(1);
