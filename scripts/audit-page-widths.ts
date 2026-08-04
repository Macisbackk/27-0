/**
 * Page-width regression audit — flags top-level routes that bypass
 * StandardPageShell / PageShell or nest unapproved max-width containers.
 *
 * Run: npx tsx scripts/audit-page-widths.ts
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const APP = path.join(ROOT, "src", "app");

const APPROVED_SHELLS = [
  "StandardPageShell",
  "PageShell",
  "DocumentPageShell",
  "ManagerPage",
];

const UNAPPROVED_MAX_WIDTH =
  /\bmax-w-(?:xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)\b/;

const SKIP_DIRS = new Set(["api", "auth"]);

type Finding = { file: string; issue: string };

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, out);
    } else if (entry.name === "page.tsx" || entry.name === "page.ts") {
      out.push(full);
    }
  }
  return out;
}

function auditFile(file: string): Finding[] {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  const src = fs.readFileSync(file, "utf8");
  const findings: Finding[] = [];

  // Landing page is exempt.
  if (rel === "src/app/page.tsx") return findings;

  const usesApprovedShell = APPROVED_SHELLS.some((s) => src.includes(s));
  if (!usesApprovedShell) {
    findings.push({
      file: rel,
      issue: "No StandardPageShell / PageShell / ManagerPage wrapper detected",
    });
  }

  // Flag nested max-w-* on the page itself (not inside comments).
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim().startsWith("//") || line.trim().startsWith("*")) continue;
    if (UNAPPROVED_MAX_WIDTH.test(line) && !line.includes("PAGE.content")) {
      // Subtitle max-w-md is fine; flag shell-level containers.
      if (
        line.includes("className") &&
        (line.includes("mx-auto") || line.includes("max-w-3xl") || line.includes("max-w-4xl") || line.includes("max-w-5xl") || line.includes("max-w-6xl") || line.includes("max-w-7xl"))
      ) {
        findings.push({
          file: rel,
          issue: `L${i + 1}: possible unapproved max-width override — ${line.trim().slice(0, 120)}`,
        });
      }
    }
    if (line.includes("100vw") && line.includes("className")) {
      findings.push({
        file: rel,
        issue: `L${i + 1}: 100vw inside page container`,
      });
    }
  }

  return findings;
}

const pages = walk(APP);
const all = pages.flatMap(auditFile);

console.log(`Audited ${pages.length} routes.\n`);
if (all.length === 0) {
  console.log("No width issues detected.");
  process.exit(0);
}

for (const f of all) {
  console.log(`- ${f.file}: ${f.issue}`);
}
process.exit(all.length > 0 ? 1 : 0);
