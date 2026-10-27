/**
 * Dark mode preference: parsing, local storage and the local/cloud merge.
 * Run: bun scripts/test-dark-mode.ts
 */
class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
}
Object.assign(globalThis, { window: new EventTarget(), localStorage: new MemoryStorage() });

const {
  parseDarkModePref,
  isDarkModeOn,
  mergeDarkModePref,
  readLocalDarkModePref,
  writeLocalDarkModePref,
  DARK_MODE_BOOTSTRAP_SCRIPT,
} = await import("../src/lib/ui/dark-mode");
const { STORAGE_KEYS } = await import("../src/lib/storage/keys");

let failures = 0;
function check(name: string, ok: boolean): void {
  if (!ok) {
    failures++;
    console.error("FAIL", name);
  }
}
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// Parsing
check("parse object", eq(parseDarkModePref({ on: true, updatedAt: 5 }), { on: true, updatedAt: 5 }));
check("parse string", eq(parseDarkModePref('{"on":false,"updatedAt":7}'), { on: false, updatedAt: 7 }));
check("parse missing updatedAt", eq(parseDarkModePref({ on: true }), { on: true, updatedAt: 0 }));
check("parse junk", parseDarkModePref("not json") === null);
check("parse null", parseDarkModePref(null) === null);
check("parse wrong type", parseDarkModePref({ on: "yes" }) === null);

// Nothing stored → dark mode ON (v1.25 default)
check("nothing stored", readLocalDarkModePref() === null);
check("default on", isDarkModeOn(null) === true);
check("explicit off kept", isDarkModeOn({ on: false, updatedAt: 1 }) === false);
writeLocalDarkModePref({ on: true, updatedAt: 100 });
check("roundtrip", eq(readLocalDarkModePref(), { on: true, updatedAt: 100 }));
check("stored under key", localStorage.getItem(STORAGE_KEYS.darkMode) !== null);

// Merge: last write wins, tie keeps local, a missing side never wipes the other.
const local = { on: true, updatedAt: 100 };
check("cloud missing keeps local", mergeDarkModePref(local, null) === local);
check("local missing takes cloud", eq(mergeDarkModePref(null, { on: true, updatedAt: 1 }), { on: true, updatedAt: 1 }));
check("both missing", mergeDarkModePref(null, null) === null);
check("newer cloud wins", eq(mergeDarkModePref(local, { on: false, updatedAt: 200 }), { on: false, updatedAt: 200 }));
check("older cloud loses", mergeDarkModePref(local, { on: false, updatedAt: 50 }) === local);
check("tie keeps local", mergeDarkModePref(local, { on: false, updatedAt: 100 }) === local);

// Bootstrap script: sets the attribute only for on === true, and never throws.
function runBootstrap(stored: string | null): string | null {
  const attrs = new Map<string, string>();
  const doc = { documentElement: { setAttribute: (k: string, v: string) => attrs.set(k, v) } };
  const store = { getItem: () => stored };
  new Function("document", "localStorage", DARK_MODE_BOOTSTRAP_SCRIPT)(doc, store);
  return attrs.get("data-mode") ?? null;
}
check("bootstrap on", runBootstrap('{"on":true,"updatedAt":1}') === "dark");
check("bootstrap off", runBootstrap('{"on":false,"updatedAt":1}') === null);
check("bootstrap unset → dark (default)", runBootstrap(null) === "dark");
// Junk JSON throws, so the attribute is left as the server rendered it (data-mode="dark").
check("bootstrap junk leaves it alone", runBootstrap("{{") === null);

if (failures) {
  console.error(`dark mode: ${failures} failure(s)`);
  process.exit(1);
}
console.log("dark mode: all checks passed");
