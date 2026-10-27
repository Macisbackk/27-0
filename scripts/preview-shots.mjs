/**
 * Quick preview screenshots of the main screens (phone + one desktop), for showing a branch
 * without deploying it. Each shot is independent: one failure doesn't stop the rest.
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "preview-shots";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const desktop = await browser.newContext({ viewport: { width: 1366, height: 900 } });

async function shot(ctx, name, path, act, fullPage = false) {
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(900);
    if (act) await act(page);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
    console.log("shot", name);
  } catch (e) {
    console.log("skip", name, String(e).slice(0, 160));
  } finally {
    await page.close();
  }
}

const tap = (re) => async (page) => {
  await page.getByRole("button", { name: re }).first().click({ timeout: 5000 });
  await page.waitForTimeout(700);
};

await shot(phone, "01-home", "/");
await shot(phone, "02-home-full", "/", null, true);
await shot(phone, "03-menu", "/", tap(/open menu/i));
await shot(phone, "04-classic-how-to", "/play");
await shot(phone, "05-classic-pitch", "/play", tap(/let.?s play/i));
await shot(phone, "06-manager", "/manager");
await shot(phone, "07-store", "/store");
await shot(phone, "08-leaderboard", "/leaderboard");
await shot(phone, "09-puzzles", "/mini-games");
await shot(phone, "10-profile", "/profile");
await shot(desktop, "11-desktop-home", "/");
await shot(desktop, "12-desktop-leaderboard", "/leaderboard");
await shot(desktop, "13-desktop-store", "/store");
await shot(desktop, "14-desktop-puzzles", "/mini-games");
await shot(desktop, "15-desktop-profile", "/profile");
await shot(phone, "20-showcase", "/showcase");
await shot(phone, "21-showcase-historic", "/showcase", async (page) => {
  await page.getByRole("button", { name: "Historic", exact: true }).click({ timeout: 5000 });
  await page.waitForTimeout(500);
});
await shot(phone, "22-showcase-filters", "/showcase", async (page) => {
  await page.getByRole("button", { name: /^Filters/ }).click({ timeout: 5000 });
  await page.waitForTimeout(500);
});
await shot(phone, "23-showcase-player", "/showcase", async (page) => {
  await page.getByRole("button", { name: "Historic", exact: true }).click({ timeout: 5000 });
  await page.locator(".showcase-row__button").first().click({ timeout: 5000 });
  await page.waitForTimeout(700);
});
await shot(desktop, "24-desktop-showcase", "/showcase");
// The logo follows the Store theme: fake a blue theme accent and look at the header.
await shot(phone, "25-logo-blue-theme", "/", async (page) => {
  await page.evaluate(() => document.documentElement.style.setProperty("--ui-accent", "#38bdf8"));
  await page.waitForTimeout(300);
});
await shot(phone, "16-store-frames", "/store", async (page) => {
  await page.getByRole("tab", { name: "Frames" }).click({ timeout: 5000 });
  await page.waitForTimeout(600);
});
await shot(phone, "17-manager-preseason", "/manager", async (page) => {
  await page.getByRole("list", { name: "Clubs" }).getByRole("button").first().click({ timeout: 5000 });
  await page.getByRole("button", { name: /Take charge of/ }).click({ timeout: 5000 });
  await page.getByRole("dialog", { name: "Manager Mode walkthrough" }).getByRole("button", { name: "Skip" }).click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);
});
await shot(desktop, "18-desktop-manager", "/manager");
// Home once a Manager career exists on this device (the phone context just started one).
await shot(phone, "19-home-with-career", "/");
// v1.18 shell: bottom nav (Home · Classic · Manager · Puzzles · Profile) stays up on Manager and
// the puzzles; the Store opens on "For you"; login leads with the form.
await shot(phone, "26-home-first-run", "/");
await shot(phone, "27-manager-with-nav", "/manager");
await shot(phone, "28-wordle-with-nav", "/mini-games/wordle");
await shot(phone, "29-store-for-you", "/store");
await shot(phone, "30-login", "/login");
await shot(phone, "31-menu-full", "/", tap(/open menu/i), true);

// Returning player: a finished Classic season on this device (best record, no first-run hero).
{
  const back = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await back.addInitScript(() => {
    if (localStorage.getItem("27-0-stats")) return;
    localStorage.setItem("27-0-stats-schema-version", "3");
    localStorage.setItem(
      "27-0-stats",
      JSON.stringify({ normal: { totalRuns: 4, totalSeasonsSimulated: 3, bestRecordWins: 24, bestRecordLosses: 3 } }),
    );
  });
  await shot(back, "32-home-returning", "/", null, true);
  await shot(back, "33-home-missions-open", "/", async (page) => {
    await page.getByRole("button", { name: /Today's missions/ }).click({ timeout: 5000 });
    await page.waitForTimeout(400);
  }, true);
  await shot(back, "34-home-era", "/", async (page) => {
    await page.getByRole("button", { name: /Every era/ }).click({ timeout: 5000 });
    await page.waitForTimeout(400);
  });
  await back.close();
}

// More hub pages.
await shot(phone, "40-records", "/records");
await shot(phone, "41-squad-book", "/squad-book");
await shot(phone, "42-modes", "/modes");
await shot(phone, "43-settings", "/settings");
await shot(phone, "44-quiz", "/quiz");
await shot(phone, "45-how-to-play", "/", async (page) => {
  await page.locator("summary", { hasText: "How to play" }).first().click({ timeout: 5000 });
  await page.waitForTimeout(500);
  await page.locator("#how-to-play").scrollIntoViewIfNeeded();
}, true);

// Narrowest phones (320px): text wrapping and clipping.
{
  const narrow = await browser.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await shot(narrow, "46-320-home", "/", null, true);
  await shot(narrow, "47-320-store", "/store");
  await shot(narrow, "48-320-manager", "/manager");
  await shot(narrow, "49-320-settings", "/settings", null, true);
  await narrow.close();
}

// Classic: the draft screen, then a full auto-filled run to the season review (test build: ?e2e=1).
async function tapFirst(page, patterns) {
  for (const re of patterns) {
    const btn = page.getByRole("button", { name: re }).first();
    if ((await btn.isVisible().catch(() => false)) && (await btn.isEnabled().catch(() => false))) {
      await btn.click({ timeout: 5000 }).catch(() => {});
      return true;
    }
  }
  return false;
}
await shot(phone, "35-classic-draft", "/play?e2e=1", async (page) => {
  await tapFirst(page, [/Skip boost|Continue without boost/i]);
  await page.waitForTimeout(800);
});
{
  const page = await phone.newPage();
  try {
    await page.goto(BASE + "/play?e2e=1", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1200);
    let reviewed = false;
    for (let i = 0; i < 70; i++) {
      const text = await page.locator("main").innerText().catch(() => "");
      if (/ Grade/.test(text) && /Regular Season Record/i.test(text) && !/Kick off the season|Simulate season/i.test(text)) {
        reviewed = true;
        break;
      }
      const tapped = await tapFirst(page, [
        /Skip boost|Continue without boost/i, /Auto.?fill squad/i, /Kick off the season|Simulate season/i,
        /Push for the top two/i, /Rest the stars/i, /Chase the points difference/i,
        /Skip/i, /Sim(ulate)? (to )?(end|all|rest)/i,
        /^Continue$/i, /Next/i, /View (season )?review/i, /See (your )?review/i, /Season review/i, /Finish/i,
      ]);
      await page.waitForTimeout(tapped ? 900 : 1500);
    }
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${OUT}/36-classic-review.png` });
    await page.screenshot({ path: `${OUT}/37-classic-review-full.png`, fullPage: true });
    console.log("shot 36-classic-review", reviewed ? "" : "(review not reached)");
    // On to the play-offs and the end-of-run review (share → challenge → rewards → Play again).
    await page.waitForTimeout(1500);
    await tapFirst(page, [/^Continue$/i]);
    await page.waitForTimeout(500);
    if (await tapFirst(page, [/^Play-offs$/i, /Continue to play-offs/i])) {
      for (let i = 0; i < 30; i++) {
        const text = await page.locator("main").innerText().catch(() => "");
        if (/Play-off Review/i.test(text)) break;
        const tapped = await tapFirst(page, [/Play (the )?(next )?match/i, /Simulate/i, /Sim /i, /Skip/i, /^Continue$/i, /Next/i, /View (play-?off )?review/i, /Finish/i]);
        await page.waitForTimeout(tapped ? 900 : 1500);
      }
      await page.waitForTimeout(2500);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `${OUT}/38-classic-playoff-review.png` });
      await tapFirst(page, [/^Continue$/i]);
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${OUT}/39-classic-playoff-review-full.png`, fullPage: true });
      console.log("shot 38-classic-playoff-review");
    }
  } catch (e) {
    console.log("skip 36-classic-review", String(e).slice(0, 160));
  } finally {
    await page.close();
  }
}

// Store themes: the pitch surfaces and buttons follow the selected theme (dark primaries get light text).
for (const id of ["cherry", "chalk", "neon"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript((themeId) => {
    localStorage.setItem(
      "27-0-ui-theme-store",
      JSON.stringify({ selectedThemeId: themeId, unlockedThemeIds: ["default", themeId], purchaseIds: [] }),
    );
  }, id);
  await shot(ctx, `50-theme-${id}-home`, "/");
  if (id === "cherry") {
    await shot(ctx, "51-theme-cherry-store", "/store");
    await shot(ctx, "52-theme-cherry-leaderboard", "/leaderboard");
    await shot(ctx, "53-theme-cherry-draft", "/play?e2e=1", async (page) => {
      await tapFirst(page, [/Skip boost|Continue without boost/i]);
      await page.waitForTimeout(800);
    });
  }
  await ctx.close();
}

// Settings → Dark mode (v1.24): black page, one coloured pitch surface per screen. The preference
// is a localStorage key read by the <head> bootstrap script, so set it, then reload.
async function darkContext(themeId) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript((id) => {
    localStorage.setItem("27-0-dark-mode", JSON.stringify({ on: true, updatedAt: 1 }));
    if (id) {
      localStorage.setItem(
        "27-0-ui-theme-store",
        JSON.stringify({ selectedThemeId: id, unlockedThemeIds: ["default", id], purchaseIds: [] }),
      );
    }
  }, themeId ?? null);
  return ctx;
}
{
  const ctx = await darkContext();
  await shot(ctx, "60-dark-home", "/");
  await shot(ctx, "61-dark-home-full", "/", null, true);
  await shot(ctx, "62-dark-store", "/store");
  await shot(ctx, "63-dark-draft", "/play?e2e=1", async (page) => {
    await tapFirst(page, [/Skip boost|Continue without boost/i]);
    await page.waitForTimeout(800);
  });
  await shot(ctx, "64-dark-manager", "/manager");
  await shot(ctx, "65-dark-leaderboard", "/leaderboard");
  await shot(ctx, "66-dark-settings", "/settings", async (page) => {
    await page.getByRole("switch", { name: "Dark mode" }).scrollIntoViewIfNeeded({ timeout: 5000 });
    await page.waitForTimeout(300);
  });
  await shot(ctx, "67-dark-puzzles", "/mini-games");
  await shot(ctx, "68-dark-profile", "/profile");
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem("27-0-dark-mode", JSON.stringify({ on: true, updatedAt: 1 })));
  await shot(ctx, "69-dark-desktop-home", "/");
  await ctx.close();
}
{
  const ctx = await darkContext("cherry");
  await shot(ctx, "70-dark-cherry-home", "/");
  await shot(ctx, "71-dark-cherry-store", "/store");
  await ctx.close();
}
// The toggle itself: light page, flip it on in Settings (the page turns dark straight away).
await shot(phone, "72-settings-toggle-on", "/settings", async (page) => {
  const sw = page.getByRole("switch", { name: "Dark mode" });
  await sw.scrollIntoViewIfNeeded({ timeout: 5000 });
  await sw.click({ timeout: 5000 });
  await page.waitForTimeout(500);
});

// Lime: Dark mode off (the whole-page pitch alternative), plus a returning player with a
// half-built Classic run (home offers "Resume run").
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => {
    localStorage.setItem("27-0-dark-mode", JSON.stringify({ on: false, updatedAt: 1 }));
  });
  await shot(ctx, "80-lime-home", "/");
  await shot(ctx, "81-lime-home-full", "/", null, true);
  await shot(ctx, "82-lime-draft", "/play?e2e=1", async (page) => {
    await tapFirst(page, [/Skip boost|Continue without boost/i]);
    await page.waitForTimeout(800);
  });
  await shot(ctx, "83-lime-menu", "/", tap(/open menu/i));
  await shot(ctx, "84-lime-leaderboard", "/leaderboard");
  await shot(ctx, "85-lime-settings", "/settings");
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => {
    if (localStorage.getItem("27-0-run-resume-classic")) return;
    localStorage.setItem("27-0-stats-schema-version", "3");
    localStorage.setItem(
      "27-0-stats",
      JSON.stringify({ normal: { totalRuns: 4, totalSeasonsSimulated: 3, bestRecordWins: 24, bestRecordLosses: 3 } }),
    );
    const squad = Array.from({ length: 13 }, (_, i) => ({
      slotIndex: i,
      label: `Slot ${i + 1}`,
      player: i < 5 ? { id: `p${i}`, name: `Player ${i}` } : null,
    }));
    const now = new Date().toISOString();
    localStorage.setItem(
      "27-0-run-resume-classic",
      JSON.stringify({ v: 1, modeKey: "classic", seed: "shot", runId: "shot", startedAt: now, squad, spinPickIndex: 5, respinsRemaining: 3, usedTeamYearKeys: [], legendSpinSlotIndex: null, legendSpinUsed: false, pendingSpin: null, savedAt: now }),
    );
  });
  await shot(ctx, "86-home-resume-375", "/");
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await shot(ctx, "87-home-first-run-375", "/");
  await ctx.close();
}

await browser.close();
