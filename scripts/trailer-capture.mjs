/**
 * TikTok trailer capture: records short 9:16 clips of real gameplay plus title/caption cards
 * rendered with the site's own fonts. Output: preview-shots/trailer/*.webm + *.png
 * Run against `next start` on :3000 (built with NEXT_PUBLIC_E2E=1 so ?e2e=1 Auto-fill works).
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = "preview-shots/trailer";
fs.mkdirSync(OUT, { recursive: true });
const VIEW = { width: 432, height: 768 };
const VIDEO = { width: 1080, height: 1920 };
const log = (m) => console.log(m);
const browser = await chromium.launch();

async function clip(name, fn, { init } = {}) {
  const dir = `${OUT}/raw-${name}`;
  fs.mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({
    viewport: VIEW,
    deviceScaleFactor: 2.5,
    isMobile: true,
    hasTouch: true,
    recordVideo: { dir, size: VIDEO },
  });
  if (init) await context.addInitScript(init.fn, init.arg);
  const page = await context.newPage();
  const t0 = Date.now();
  try {
    await fn(page);
    log(`clip ${name}: ok (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  } catch (e) {
    log(`clip ${name}: stopped early: ${String(e).split("\n")[0]}`);
  }
  await page.waitForTimeout(600);
  const video = page.video();
  await context.close();
  if (video) fs.renameSync(await video.path(), `${OUT}/${name}.webm`);
  fs.rmSync(dir, { recursive: true, force: true });
}

const pause = (page, ms) => page.waitForTimeout(ms);
const go = (page, path) => page.goto(BASE + path, { waitUntil: "networkidle" });
async function smoothScroll(page, px, ms) {
  const steps = Math.max(1, Math.round(ms / 16));
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, px / steps);
    await page.waitForTimeout(16);
  }
}
// Fresh devices see a how-to popup on Classic; dismiss anything modal-ish.
async function clearIntro(page) {
  for (const re of [/let.?s play/i, /Skip boost|Continue without boost/i, /^Got it$/i, /^Close$/i]) {
    await page.getByRole("button", { name: re }).first().click({ timeout: 1200 }).catch(() => {});
  }
}

/* 1. Home */
await clip("01-home", async (page) => {
  await go(page, "/");
  await pause(page, 1600);
  await smoothScroll(page, 700, 2200);
  await pause(page, 600);
});

/* 2. Classic: spin, pick, sign (twice), then fill and simulate */
await clip("02-classic-spin", async (page) => {
  await go(page, "/play?e2e=1");
  await pause(page, 800);
  await clearIntro(page);
  await pause(page, 700);
  for (let round = 0; round < 2; round++) {
    await page.getByRole("button", { name: /: empty — tap to spin$/ }).first().click({ timeout: 8000 });
    // Let the reel play out: that's the hook.
    await page.getByRole("button", { name: /^Sign / }).first().waitFor({ timeout: 15000 });
    await pause(page, 1300);
    await page.getByRole("button", { name: /^Sign / }).first().click();
    await page.getByRole("button", { name: /Confirm Placement/i }).first().click({ timeout: 2000 }).catch(() => {});
    await pause(page, 1100);
  }
});

await clip("03-classic-season", async (page) => {
  await go(page, "/play?e2e=1");
  await pause(page, 600);
  await clearIntro(page);
  await page.getByRole("button", { name: /Auto.?fill squad/i }).click({ timeout: 8000 });
  await pause(page, 1800);
  await page.getByRole("button", { name: /Simulate season/i }).click({ timeout: 8000 });
  await pause(page, 7000);
  for (const re of [/^Skip$/i, /Sim(ulate)? (to )?(end|all|rest)/i, /^Continue$/i, /View (season )?review|See (your )?review|Finish/i]) {
    await page.getByRole("button", { name: re }).first().click({ timeout: 1500 }).catch(() => {});
    await pause(page, 900);
  }
  await pause(page, 1500);
  await smoothScroll(page, 500, 1500);
});

/* 3. Manager Mode: pick a club, start, play a live match */
let managerSave = null;
await clip("04-manager-match", async (page) => {
  await go(page, "/manager");
  await pause(page, 900);
  await page.getByRole("list", { name: "Clubs" }).getByRole("button").nth(0).click();
  await pause(page, 600);
  await page.getByPlaceholder("Your name").fill("Gaffer").catch(() => {});
  await page.getByRole("button", { name: /Take charge of/ }).click();
  await page.getByRole("dialog", { name: "Manager Mode walkthrough" }).getByRole("button", { name: "Skip" }).click({ timeout: 8000 }).catch(() => {});
  await pause(page, 800);
  await page.getByRole("button", { name: "Skip pre-season" }).click({ timeout: 8000 });
  await pause(page, 1200);
  await page.getByRole("button", { name: "Play match" }).click({ timeout: 8000 });
  await page.getByRole("button", { name: /Speed: normal/ }).click({ timeout: 4000 }).catch(() => {});
  await pause(page, 7500);
});

/* 4. Deadline Day: sim to it off-camera, then record the clock and offers */
{
  const context = await browser.newContext({ viewport: VIEW });
  const page = await context.newPage();
  try {
    await go(page, "/manager");
    await page.getByRole("list", { name: "Clubs" }).getByRole("button").nth(0).click();
    await page.getByRole("button", { name: /Take charge of/ }).click();
    await page.getByRole("dialog", { name: "Manager Mode walkthrough" }).getByRole("button", { name: "Skip" }).click({ timeout: 8000 }).catch(() => {});
    await page.getByRole("button", { name: "Skip pre-season" }).click({ timeout: 8000 });
    for (let i = 0; i < 400; i++) {
      if (await page.getByRole("region", { name: "Deadline Day", exact: true }).isVisible().catch(() => false)) break;
      await page.getByRole("button", { name: /^(Quick sim|Continue)$/ }).first().click({ timeout: 2000 }).catch(() => {});
      await pause(page, 120);
    }
    // Pause the clock so the recorded clip starts at 12:00.
    await page.getByRole("button", { name: "Pause the clock" }).click({ timeout: 4000 }).catch(() => {});
    managerSave = await page.evaluate(() => {
      const out = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        out[k] = localStorage.getItem(k);
      }
      return out;
    });
    log("deadline save captured");
  } catch (e) {
    log(`deadline prep failed: ${e}`);
  }
  await context.close();
}
if (managerSave) {
  await clip(
    "05-deadline-day",
    async (page) => {
      await go(page, "/manager");
      await pause(page, 1200);
      await page.getByRole("button", { name: "Resume the clock" }).click({ timeout: 6000 }).catch(() => {});
      await page.getByRole("button", { name: "Skip an hour" }).click({ timeout: 3000 }).catch(() => {});
      await pause(page, 2500);
      await page.getByRole("button", { name: "Skip an hour" }).click({ timeout: 3000 }).catch(() => {});
      await pause(page, 5000);
      await smoothScroll(page, 350, 900);
      await pause(page, 2500);
    },
    {
      init: {
        fn: (save) => {
          if (sessionStorage.getItem("__seeded")) return;
          for (const [k, v] of Object.entries(save)) localStorage.setItem(k, v);
          sessionStorage.setItem("__seeded", "1");
        },
        arg: managerSave,
      },
    }
  );
}

/* 5. Showcase */
await clip("06-showcase", async (page) => {
  await go(page, "/showcase");
  await pause(page, 1200);
  await page.getByRole("button", { name: "Legends", exact: true }).click({ timeout: 4000 }).catch(() => {});
  await pause(page, 900);
  await smoothScroll(page, 600, 1800);
  await pause(page, 500);
  await page.locator(".showcase-row__button").nth(3).click({ timeout: 4000 }).catch(() => {});
  await pause(page, 2600);
});

/* 6. Store */
await clip("07-store", async (page) => {
  await go(page, "/store");
  await pause(page, 1200);
  await smoothScroll(page, 900, 2600);
  await pause(page, 500);
  await page.getByRole("tab", { name: "Frames" }).click({ timeout: 3000 }).catch(() => {});
  await pause(page, 1800);
});

/* Cards (title, captions, end) in the site's own fonts and colours, 1080×1920. */
const cards = {
  "card-title": { big: "27-0", sub: "The rugby league squad game", tag: "" },
  "card-end": { big: "27-0", sub: "Free to play", tag: "27-0.co.uk" },
};
const captions = {
  "cap-spin": "Spin real Super League squads",
  "cap-build": "Build your 13. Chase 27-0.",
  "cap-manager": "Run a club. Play it live.",
  "cap-deadline": "Survive Deadline Day",
  "cap-showcase": "3,300+ players. Every era.",
  "cap-store": "Earn Club Funds. Make it yours.",
};
{
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 2.5 });
  const page = await context.newPage();
  await go(page, "/");
  for (const [name, c] of Object.entries(cards)) {
    await page.evaluate((c) => {
      document.body.innerHTML = `
        <div style="position:fixed;inset:0;background:radial-gradient(120% 80% at 50% 30%,#1b2210 0%,#0e0f10 60%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px">
          <div class="logo-mark" style="display:inline-flex;align-items:center;gap:.16em;font-size:120px">
            <span class="logo-mark__cell">27</span><span class="logo-mark__dash"></span><span class="logo-mark__cell">0</span>
          </div>
          <div style="font-family:var(--font-cond);font-weight:800;font-size:34px;color:#fff;text-align:center;line-height:1.1;max-width:360px">${c.sub}</div>
          ${c.tag ? `<div style="margin-top:6px;padding:12px 26px;border-radius:999px;background:#b6f23d;color:#0e1400;font-family:var(--font-cond);font-weight:800;font-size:28px">${c.tag}</div>` : ""}
        </div>`;
    }, c);
    await pause(page, 400);
    await page.screenshot({ path: `${OUT}/${name}.png` });
  }
  for (const [name, text] of Object.entries(captions)) {
    await page.evaluate((text) => {
      document.documentElement.style.background = "transparent";
      document.body.style.background = "transparent";
      document.body.innerHTML = `
        <div style="position:fixed;left:0;right:0;top:92px;display:flex;justify-content:center">
          <div style="padding:14px 22px;border-radius:18px;background:rgba(14,15,16,.88);box-shadow:0 0 0 2px #b6f23d;color:#fff;font-family:var(--font-cond);font-weight:800;font-size:30px;line-height:1.1;text-align:center;max-width:380px">${text}</div>
        </div>`;
    }, text);
    await pause(page, 200);
    await page.screenshot({ path: `${OUT}/${name}.png`, omitBackground: true });
  }
  await context.close();
}

await browser.close();
log("done");
