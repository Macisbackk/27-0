/**
 * Build the Capacitor Android debug APK using a supported JDK (17/21).
 * Prefer Temurin/Microsoft JDK over Android Studio JBR (often OpenJDK 25).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const androidDir = path.join(root, "android");
const gradlew = path.join(androidDir, "gradlew.bat");

function expandJdkGlob(parentDir, prefix) {
  if (!parentDir || !fs.existsSync(parentDir)) return [];
  try {
    return fs
      .readdirSync(parentDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.startsWith(prefix))
      .map((d) => path.join(parentDir, d.name))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

function parseJavaMajorVersion(javaHome) {
  const javaExe = path.join(javaHome, "bin", "java.exe");
  if (!fs.existsSync(javaExe)) return null;
  const r = spawnSync(javaExe, ["-version"], {
    encoding: "utf8",
    shell: false,
  });
  const out = `${r.stderr || ""}\n${r.stdout || ""}`;
  // Examples: 'openjdk version "21.0.12"' / 'java version "1.8.0_xxx"'
  const m =
    out.match(/version\s+"(\d+)(?:\.\d+)?/) ||
    out.match(/version\s+"1\.(\d+)/);
  if (!m) return null;
  const major = Number(m[1]);
  return Number.isFinite(major) ? major : null;
}

function isSupportedJdk(javaHome) {
  const major = parseJavaMajorVersion(javaHome);
  if (major == null) return false;
  // Android Gradle Plugin / Gradle need 17-21 (reject 25+ and below 17)
  return major >= 17 && major < 25;
}

const localPrograms = path.join(process.env.LOCALAPPDATA || "", "Programs");

const adoptiumJdks = [
  ...expandJdkGlob("C:\\Program Files\\Eclipse Adoptium", "jdk-21"),
  ...expandJdkGlob(path.join(localPrograms, "Eclipse Adoptium"), "jdk-21"),
];
const microsoftJdks = [
  ...expandJdkGlob("C:\\Program Files\\Microsoft", "jdk-21"),
  ...expandJdkGlob(path.join(localPrograms, "Microsoft"), "jdk-21"),
];
const adoptium17 = [
  ...expandJdkGlob("C:\\Program Files\\Eclipse Adoptium", "jdk-17"),
  ...expandJdkGlob(path.join(localPrograms, "Eclipse Adoptium"), "jdk-17"),
];
const microsoft17 = [
  ...expandJdkGlob("C:\\Program Files\\Microsoft", "jdk-17"),
  ...expandJdkGlob(path.join(localPrograms, "Microsoft"), "jdk-17"),
];

const jbrCandidates = [
  process.env.JAVA_HOME,
  ...adoptiumJdks,
  ...microsoftJdks,
  ...adoptium17,
  ...microsoft17,
  process.env.ANDROID_STUDIO_JBR,
  "C:\\Program Files\\Android\\Android Studio\\jbr",
  path.join(
    process.env.LOCALAPPDATA || "",
    "Programs",
    "Android",
    "Android Studio",
    "jbr"
  ),
].filter(Boolean);

function resolveJavaHome() {
  for (const candidate of jbrCandidates) {
    const javaExe = path.join(candidate, "bin", "java.exe");
    if (!fs.existsSync(javaExe)) continue;
    if (!isSupportedJdk(candidate)) {
      const major = parseJavaMajorVersion(candidate);
      console.warn(
        `Skipping unsupported JDK at ${candidate} (major=${major ?? "?"}; need 17-24)`
      );
      continue;
    }
    return candidate;
  }
  return null;
}

if (!fs.existsSync(gradlew)) {
  console.error("Missing android/gradlew.bat — run npx cap add android first.");
  process.exit(1);
}

const javaHome = resolveJavaHome();
if (!javaHome) {
  console.error(
    "No suitable JDK found. Install JDK 17 or 21 (Temurin/Microsoft) and retry."
  );
  process.exit(1);
}

const sdkDir =
  process.env.ANDROID_SDK_ROOT ||
  process.env.ANDROID_HOME ||
  path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk");

const localProperties = path.join(androidDir, "local.properties");
if (!fs.existsSync(localProperties) && fs.existsSync(sdkDir)) {
  const escaped = sdkDir.replace(/\\/g, "\\\\");
  fs.writeFileSync(localProperties, `sdk.dir=${escaped}\n`, "utf8");
  console.log(`Wrote ${localProperties}`);
}

console.log(`Using JAVA_HOME=${javaHome}`);
const result = spawnSync(gradlew, ["assembleDebug", "--no-daemon"], {
  cwd: androidDir,
  env: {
    ...process.env,
    JAVA_HOME: javaHome,
    ANDROID_HOME: process.env.ANDROID_HOME || sdkDir,
    ANDROID_SDK_ROOT: process.env.ANDROID_SDK_ROOT || sdkDir,
  },
  stdio: "inherit",
  shell: true,
});

const apk = path.join(
  androidDir,
  "app",
  "build",
  "outputs",
  "apk",
  "debug",
  "app-debug.apk"
);
if (result.status === 0 && fs.existsSync(apk)) {
  console.log(`APK ready: ${apk}`);
} else if (result.status === 0) {
  console.error("Gradle reported success but APK was not found at", apk);
  process.exit(1);
}

process.exit(result.status ?? 1);