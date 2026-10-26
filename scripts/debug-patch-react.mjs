// TEMPORARY: inject a hook into React's prod throwOnHydrationMismatch so the browser can see the fiber.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
const dir = ".next/static/chunks";
let patched = 0;
for (const f of readdirSync(dir)) {
  if (!f.endsWith(".js")) continue;
  const p = `${dir}/${f}`;
  const s = readFileSync(p, "utf8");
  if (!s.includes("418,")) continue;
  const re = /function (\w+)\((\w+)\)\{(var|let|const) (\w+)=Error\((\w+)\(418,/g;
  if (!re.test(s)) continue;
  const out = s.replace(re, (m, fn, arg, kw, v, fmt) => `function ${fn}(${arg}){try{window.__hydMis&&window.__hydMis(${arg})}catch(_){}${kw} ${v}=Error(${fmt}(418,`);
  writeFileSync(p, out);
  patched++;
  console.log(`patched ${p}`);
}
if (!patched) {
  for (const f of readdirSync(dir)) {
    const s = readFileSync(`${dir}/${f}`, "utf8");
    const i = s.indexOf("(418,");
    if (i > 0) console.log(`no regex match; context in ${f}: ${s.slice(i - 200, i + 120)}`);
  }
  process.exit(1);
}
