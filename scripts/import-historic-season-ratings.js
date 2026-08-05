#!/usr/bin/env node
/**
 * Node entrypoint for historic season ratings import.
 * Delegates to the TypeScript implementation via tsx.
 */
const { spawnSync } = require("child_process");
const path = require("path");

const script = path.join(__dirname, "import-historic-season-ratings.ts");
const args = ["tsx", script, ...process.argv.slice(2)];
const result = spawnSync("npx", args, {
  stdio: "inherit",
  shell: true,
  cwd: path.join(__dirname, ".."),
});
process.exit(result.status ?? 1);
