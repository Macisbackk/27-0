/**
 * Install app-debug.apk onto LDPlayer via ADB — only when the target is unambiguous.
 *
 * Safety:
 * - Uses ANDROID_SERIAL / LDPLAYER_SERIAL if set
 * - Otherwise requires exactly one connected device after optional LDPlayer port probe
 * - Refuses to install when multiple devices are present
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apk = path.join(
  root,
  "android",
  "app",
  "build",
  "outputs",
  "apk",
  "debug",
  "app-debug.apk"
);

const sdkAdb = path.join(
  process.env.LOCALAPPDATA || "",
  "Android",
  "Sdk",
  "platform-tools",
  "adb.exe"
);

function resolveAdb() {
  if (process.env.ADB && fs.existsSync(process.env.ADB)) return process.env.ADB;
  if (fs.existsSync(sdkAdb)) return sdkAdb;
  const which = spawnSync("where", ["adb"], { encoding: "utf8", shell: true });
  const first = which.stdout?.split(/\r?\n/).map((s) => s.trim()).find(Boolean);
  return first || null;
}

function runAdb(adb, args) {
  return spawnSync(adb, args, { encoding: "utf8", shell: false });
}

function listDevices(adb) {
  const result = runAdb(adb, ["devices"]);
  const lines = (result.stdout || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(1);
  return lines
    .map((line) => {
      const [serial, state] = line.split(/\s+/);
      return { serial, state };
    })
    .filter((d) => d.serial && d.state === "device");
}

/** Common LDPlayer ADB ports on Windows (127.0.0.1). */
const LDPLAYER_PORTS = [5555, 5557, 5559, 62001, 7555];

function tryConnectLdPlayer(adb) {
  for (const port of LDPLAYER_PORTS) {
    const target = `127.0.0.1:${port}`;
    console.log(`Trying LDPlayer ADB at ${target}…`);
    runAdb(adb, ["connect", target]);
  }
}

if (!fs.existsSync(apk)) {
  console.error(`APK not found: ${apk}`);
  console.error("Run npm run android:apk first.");
  process.exit(1);
}

const adb = resolveAdb();
if (!adb) {
  console.error("adb not found. Install Android SDK platform-tools.");
  process.exit(1);
}

console.log(`Using adb: ${adb}`);
let devices = listDevices(adb);

if (devices.length === 0) {
  tryConnectLdPlayer(adb);
  devices = listDevices(adb);
}

const preferred =
  process.env.LDPLAYER_SERIAL ||
  process.env.ANDROID_SERIAL ||
  process.env.ADB_SERIAL ||
  null;

let serial = preferred;
if (serial) {
  const match = devices.find((d) => d.serial === serial);
  if (!match) {
    console.error(
      `Requested device ${serial} is not connected. Connected: ${
        devices.map((d) => d.serial).join(", ") || "(none)"
      }`
    );
    process.exit(1);
  }
} else if (devices.length === 1) {
  serial = devices[0].serial;
} else if (devices.length === 0) {
  console.error(
    [
      "No ADB device found.",
      "In LDPlayer 14: open settings → enable ADB / local connection,",
      "then either leave only that emulator running and retry, or set",
      "LDPLAYER_SERIAL to the serial from `adb devices` (e.g. 127.0.0.1:5555).",
      "",
      `Manual install: drag this APK into LDPlayer:`,
      apk,
    ].join("\n")
  );
  process.exit(1);
} else {
  console.error(
    [
      "Multiple Android devices are connected — refusing to guess.",
      "Connected:",
      ...devices.map((d) => `  - ${d.serial}`),
      "",
      "Re-run with one device only, or set LDPLAYER_SERIAL to the LDPlayer serial.",
      "",
      `Manual install: drag this APK into LDPlayer:`,
      apk,
    ].join("\n")
  );
  process.exit(1);
}

console.log(`Installing onto ${serial}…`);
const install = spawnSync(
  adb,
  ["-s", serial, "install", "-r", apk],
  { encoding: "utf8", shell: false, stdio: "inherit" }
);
process.exit(install.status ?? 1);
