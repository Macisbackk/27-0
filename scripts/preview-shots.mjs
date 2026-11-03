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
// Pre-season: the summer window is still open; the market, and a free agent ("Free · £Xk/yr wages").
await shot(phone, "17b-manager-preseason-market", "/manager", async (page) => {
  await page.getByRole("region", { name: "Transfer window open" }).getByRole("button", { name: "Open market" }).click({ timeout: 5000 });
  await page.waitForTimeout(800);
});
await shot(phone, "17c-manager-free-agent", "/manager", async (page) => {
  await page.getByRole("region", { name: "Transfer window open" }).getByRole("button", { name: "Open market" }).click({ timeout: 5000 });
  await page.waitForTimeout(600);
  await page.locator('li[data-free-agent="true"]').first().scrollIntoViewIfNeeded({ timeout: 5000 });
  await page.waitForTimeout(300);
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
// More modes unlocked (v1.50: each is earned by a challenge; seeded here).
await shot(phone, "42b-modes-unlocked", "/modes", async (page) => {
  await page.evaluate(() => {
    const key = "27-0-cosmetics-store";
    let state = {};
    try {
      state = JSON.parse(localStorage.getItem(key) || "{}") || {};
    } catch {
      state = {};
    }
    const owned = Array.isArray(state.owned) ? state.owned : [];
    const ids = ["mode-one-club", "mode-gauntlet", "mode-past-dailies", "mode-ball-knower"];
    localStorage.setItem(key, JSON.stringify({ ...state, owned: [...new Set([...owned, ...ids])] }));
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(900);
});
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
  // Team tab at 320px: the XIII, then the Interchange (shirts 14–17) under it.
  await shot(narrow, "48b-320-manager-team-bench", "/manager", async (page) => {
    await page.getByRole("list", { name: "Clubs" }).getByRole("button").first().click({ timeout: 5000 });
    await page.getByRole("button", { name: /Take charge of/ }).click({ timeout: 5000 });
    await page.getByRole("dialog", { name: "Manager Mode walkthrough" }).getByRole("button", { name: "Skip" }).click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(600);
    await page.getByRole("tab", { name: "Team" }).click({ timeout: 5000 });
    await page.getByRole("region", { name: "Interchange" }).scrollIntoViewIfNeeded({ timeout: 5000 });
    await page.evaluate(() => window.scrollBy(0, 120));
    await page.waitForTimeout(400);
  });
  // The last result, big at the top of the Match tab, after a Quick sim of Round 1.
  await shot(narrow, "48d-320-manager-last-result", "/manager", async (page) => {
    await page.getByRole("tab", { name: "Match" }).click({ timeout: 5000 }).catch(() => {});
    const startSeason = page.getByRole("button", { name: /^(Skip pre-season|Start the season)/ }).first();
    if (await startSeason.isVisible().catch(() => false)) await startSeason.click().catch(() => {});
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: "Quick sim" }).click({ timeout: 8000 });
    await page.getByRole("region", { name: "Last result" }).waitFor({ timeout: 8000 });
    await page.getByRole("region", { name: "Last result" }).evaluate((el) => el.scrollIntoView({ block: "start" }));
    await page.evaluate(() => window.scrollBy(0, -70));
    await page.waitForTimeout(500);
  });
  // The last result's match ratings, opened.
  await shot(narrow, "48k-320-manager-match-ratings", "/manager", async (page) => {
    await page.getByRole("tab", { name: "Match" }).click({ timeout: 5000 }).catch(() => {});
    await page.getByTestId("match-ratings").locator("summary").click({ timeout: 5000 });
    await page.getByTestId("match-ratings").evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(400);
  });
  // Club tab: player stats, league stats and the Hall of Fame (real club records).
  for (const [name, id, view] of [["48l-320-manager-player-stats", "squad-stats", "Stats"], ["48m-320-manager-league-stats", "league-leaders", "Stats"], ["48n-320-manager-hall-of-fame", "hall-of-fame", "Records"]]) {
    await shot(narrow, name, "/manager", async (page) => {
      await page.getByRole("tab", { name: "Club" }).click({ timeout: 5000 });
      await page.getByRole("tab", { name: view, exact: true }).click({ timeout: 5000 });
      await page.getByTestId(id).first().evaluate((el) => el.scrollIntoView({ block: "start" }));
      await page.evaluate(() => window.scrollBy(0, -60));
      await page.waitForTimeout(400);
    });
  }
  await shot(narrow, "48c-320-manager-bench-picker", "/manager", async (page) => {
    await page.getByRole("tab", { name: "Team" }).click({ timeout: 5000 });
    await page.getByRole("button", { name: /^Shirt 14,/ }).click({ timeout: 5000 });
    await page.waitForTimeout(600);
  });
  // Captain row and the Academy list on the Team tab.
  await shot(narrow, "48e-320-manager-academy", "/manager", async (page) => {
    await page.getByRole("tab", { name: "Team" }).click({ timeout: 5000 });
    await page.getByRole("tab", { name: "Academy", exact: true }).click({ timeout: 5000 });
    await page.getByRole("region", { name: "Academy" }).scrollIntoViewIfNeeded({ timeout: 5000 });
    await page.waitForTimeout(400);
  });
  await shot(narrow, "48f-320-manager-captain", "/manager", async (page) => {
    await page.getByRole("tab", { name: "Team" }).click({ timeout: 5000 });
    await page.getByTestId("captain").scrollIntoViewIfNeeded({ timeout: 5000 });
    await page.evaluate(() => window.scrollBy(0, -80));
    await page.waitForTimeout(400);
  });
  // Your next games (Magic Weekend and derbies marked) under the table.
  await shot(narrow, "48g-320-manager-fixtures", "/manager", async (page) => {
    await page.getByRole("tab", { name: "Table" }).click({ timeout: 5000 });
    await page.getByRole("tab", { name: "Fixtures", exact: true }).click({ timeout: 5000 });
    await page.getByRole("list", { name: "Your next games" }).scrollIntoViewIfNeeded({ timeout: 5000 });
    await page.waitForTimeout(400);
  });
  // v1.58: Table → Results (your results, then any round's scores) and the Cup draw.
  await shot(narrow, "48g2-320-manager-results", "/manager", async (page) => {
    await page.getByRole("tab", { name: "Table" }).click({ timeout: 5000 });
    await page.getByRole("tab", { name: "Results", exact: true }).click({ timeout: 5000 });
    await page.getByTestId("round-results").waitFor({ timeout: 5000 });
    await page.waitForTimeout(400);
  }, true);
  await shot(narrow, "48g3-320-manager-cup", "/manager", async (page) => {
    await page.getByRole("tab", { name: "Table" }).click({ timeout: 5000 });
    await page.getByRole("tab", { name: "Cup", exact: true }).click({ timeout: 5000 });
    await page.getByTestId("table-cup").waitFor({ timeout: 5000 });
    await page.waitForTimeout(400);
  }, true);
  // A hub pop-up (an AI club signs a legend), injected into the save.
  await shot(narrow, "48j-320-manager-popup", "/manager", async (page) => {
    await page.evaluate((k) => {
      const s = JSON.parse(localStorage.getItem(k) || "null");
      if (!s) return;
      const clubs = Object.values(s.clubs);
      const club = clubs.find((c) => c.id !== s.userClubId && c.name === "Wigan Warriors") || clubs.find((c) => c.id !== s.userClubId);
      s.tutorialDone = true;
      s.events = [
        ...(s.events || []),
        { id: "preview-legend", kind: "legend-signing", year: s.year, clubId: club.id, name: "Sam Tomkins", rating: 91, title: `${club.name} sign Sam Tomkins!`, text: `A club legend is back at ${club.name}.`, options: [{ id: "ok", label: "Bring it on" }] },
      ];
      localStorage.setItem(k, JSON.stringify(s));
    }, "27-0-career-v2-save");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByTestId("career-event").waitFor({ timeout: 5000 });
    await page.waitForTimeout(500);
  });
  // A club record pop-up, injected into the save.
  await shot(narrow, "48o-320-manager-record-popup", "/manager", async (page) => {
    await page.evaluate((k) => {
      const s = JSON.parse(localStorage.getItem(k) || "null");
      if (!s) return;
      const p = s.players[s.lineup[1]];
      s.tutorialDone = true;
      const surname = p.name.split(" ").slice(-1)[0];
      s.events = [
        ...(s.events || []),
        { id: "preview-record", kind: "club-record", year: s.year, clubId: s.userClubId, playerId: p.id, name: p.name, rating: p.rating, title: `${surname} breaks the club try record!`, text: `He passes the old mark of 207 tries for ${s.clubs[s.userClubId].name}.`, options: [{ id: "ok", label: "Legend" }] },
      ];
      localStorage.setItem(k, JSON.stringify(s));
    }, "27-0-career-v2-save");
    await page.reload({ waitUntil: "networkidle" });
    // Clear the legend pop-up from the shot before.
    if ((await page.getByTestId("career-event").getAttribute("data-kind").catch(() => null)) !== "club-record") {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(600);
    }
    await page.getByTestId("career-event").waitFor({ timeout: 5000 });
    await page.waitForTimeout(500);
  });
  // Quick-sim to the season review: the awards card.
  await shot(narrow, "48h-320-manager-awards", "/manager", async (page) => {
    await page.getByRole("tab", { name: "Match" }).click({ timeout: 5000 }).catch(() => {});
    let sawMagic = false;
    let sawPlayoffs = false;
    for (let i = 0; i < 90; i++) {
      if (await page.getByRole("region", { name: "Season awards" }).isVisible().catch(() => false)) break;
      if (!sawPlayoffs && (await page.getByTestId("live-playoffs").isVisible().catch(() => false))) {
        sawPlayoffs = true;
        await page.getByTestId("live-playoffs").evaluate((el) => el.scrollIntoView({ block: "start" }));
        await page.evaluate(() => window.scrollBy(0, -60));
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${OUT}/48h0-320-manager-live-playoffs.png` });
        console.log("shot 48h0-320-manager-live-playoffs");
      }
      // v1.58: full time on the season comes before the review.
      if (await page.getByRole("region", { name: "Season over" }).isVisible().catch(() => false)) {
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${OUT}/48h1-320-manager-season-over.png`, fullPage: true });
        console.log("shot 48h1-320-manager-season-over");
        await page.getByRole("button", { name: "See the season review" }).click().catch(() => {});
        await page.waitForTimeout(700);
        continue;
      }
      // A hub pop-up (legend signing, random event) waits for an answer: take the default.
      if (await page.getByTestId("career-event").isVisible().catch(() => false)) await page.keyboard.press("Escape");
      if (!sawMagic && (await page.getByTestId("fixture-banner").isVisible().catch(() => false))) {
        sawMagic = true;
        await page.screenshot({ path: `${OUT}/48i-320-manager-special-fixture.png` });
        console.log("shot 48i-320-manager-special-fixture");
      }
      const next = page
        .getByRole("button", {
          name: /^(Quick sim|Continue|Shut the window|Skip pre-season|Start the season|On to the play-offs|On to the semi-finals|On to the Million Pound Game|Watch the play-offs|On to the Grand Final|Watch the Grand Final)$/,
        })
        .first();
      if (await next.isVisible().catch(() => false)) await next.click().catch(() => {});
      await page.waitForTimeout(150);
    }
    await page.getByRole("region", { name: "Season awards" }).scrollIntoViewIfNeeded({ timeout: 5000 });
    await page.waitForTimeout(400);
  });
  // v1.58: the season review, section by section, then the whole page.
  for (const [name, id] of [["48p-320-review-honours", "review-honours"], ["48q-320-review-playoffs", "review-playoffs"], ["48r-320-review-cup", "review-cup"], ["48s-320-review-results", "review-results"], ["48t-320-review-tables", "review-tables"]]) {
    await shot(narrow, name, "/manager", async (page) => {
      const el = page.getByTestId(id);
      await el.waitFor({ timeout: 5000 });
      if (id === "review-results") await el.locator("summary").click({ timeout: 3000 }).catch(() => {});
      await el.evaluate((n) => n.scrollIntoView({ block: "start" }));
      await page.evaluate(() => window.scrollBy(0, -60));
      await page.waitForTimeout(400);
    });
  }
  await shot(narrow, "48u-320-review-full", "/manager", null, true);
  // Next season, then Club → Records → last season's story.
  await shot(narrow, "48v-320-past-season", "/manager", async (page) => {
    await page.getByRole("button", { name: "Next: retirements and contracts" }).click({ timeout: 5000 });
    await page.getByRole("button", { name: /^(Open the transfer window|Continue to the window)$/ }).click({ timeout: 8000 });
    await page.getByRole("button", { name: /^Let \d+ go · open the window$/ }).click({ timeout: 2000 }).catch(() => {});
    await page.getByRole("button", { name: /Start (the )?\d{4} season/ }).click({ timeout: 8000 });
    await page.waitForTimeout(800);
    for (let i = 0; i < 4 && (await page.getByTestId("career-event").isVisible().catch(() => false)); i++) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }
    await page.getByRole("tab", { name: "Club" }).click({ timeout: 5000 });
    await page.getByRole("tab", { name: "Records", exact: true }).click({ timeout: 5000 });
    await page.getByTestId("past-seasons").getByRole("button").first().click({ timeout: 5000 });
    await page.getByTestId("past-season").waitFor({ timeout: 5000 });
    await page.waitForTimeout(500);
  });
  await shot(narrow, "48w-320-past-seasons-list", "/manager", async (page) => {
    await page.getByRole("tab", { name: "Club" }).click({ timeout: 5000 });
    await page.getByRole("tab", { name: "Records", exact: true }).click({ timeout: 5000 });
    await page.getByTestId("past-seasons").evaluate((n) => n.scrollIntoView({ block: "start" }));
    await page.evaluate(() => window.scrollBy(0, -60));
    await page.waitForTimeout(400);
  });
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
// Classic (v1.40): one Spin button, the reel spins positions; the picker offers 3 players from
// 3 clubs (after a few signings so a club link can show). Era's picker for comparison.
async function spinSlot(page, label) {
  await page.getByRole("button", { name: new RegExp(`^${label}: empty`) }).first().click({ timeout: 5000 });
}
async function classicSpin(page) {
  await page.getByRole("button", { name: /^(Spin|Back to)/ }).first().click({ timeout: 5000 });
}
async function skipSpin(page) {
  await page.waitForTimeout(400);
  await page.getByRole("dialog", { name: "Recruitment spin" }).click({ timeout: 3000 }).catch(() => {});
  await page.getByRole("button", { name: "See players" }).click({ timeout: 4000 }).catch(() => {});
  await page.getByRole("button", { name: /^Sign / }).first().waitFor({ timeout: 8000 });
  await page.waitForTimeout(500);
}
for (const [ctx, suffix] of [[phone, ""], [null, "-320"]]) {
  const c = ctx ?? (await browser.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }));
  await shot(c, `38-classic-position-spin${suffix}`, "/play?e2e=1", async (page) => {
    await tapFirst(page, [/Skip boost|Continue without boost/i]);
    await page.waitForTimeout(600);
    await classicSpin(page);
    await page.waitForTimeout(1500);
  });
  await shot(c, `39-classic-choice-picker${suffix}`, "/play?e2e=1", async (page) => {
    await tapFirst(page, [/Skip boost|Continue without boost/i]);
    await page.waitForTimeout(600);
    for (let i = 0; i < 4; i++) {
      await classicSpin(page);
      await skipSpin(page);
      await page.getByRole("button", { name: /^Sign / }).first().click({ timeout: 5000 });
      await page.waitForTimeout(900);
    }
    await classicSpin(page);
    await skipSpin(page);
  });
  if (!ctx) await c.close();
}
await shot(phone, "39a-classic-team-sheet", "/play?e2e=1", async (page) => {
  await tapFirst(page, [/Skip boost|Continue without boost/i]);
  await page.waitForTimeout(600);
  for (let i = 0; i < 3; i++) {
    await classicSpin(page);
    await skipSpin(page);
    await page.getByRole("button", { name: /^Sign / }).first().click({ timeout: 5000 });
    await page.waitForTimeout(900);
  }
}, true);
await shot(phone, "39b-era-picker", "/play?era=1&e2e=1", async (page) => {
  await tapFirst(page, [/Skip boost|Continue without boost/i]);
  await page.waitForTimeout(600);
  await spinSlot(page, "Left Wing");
  await skipSpin(page);
  await page.getByRole("button", { name: /^Sign / }).first().click({ timeout: 5000 });
  await page.waitForTimeout(900);
  await spinSlot(page, "Left Centre");
  await skipSpin(page);
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
  // Phones: hero text stacks and page intros are centred (sm+ keeps them left).
  for (const [name, path] of [["store", "/store"], ["records", "/records"], ["squad-book", "/squad-book"], ["puzzles", "/mini-games"], ["modes", "/modes"], ["leaderboard", "/leaderboard"]]) {
    await shot(ctx, `88-375-${name}`, path);
  }
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => localStorage.setItem("27-0-dark-mode", JSON.stringify({ on: false, updatedAt: 1 })));
  for (const [name, path] of [["home", "/"], ["store", "/store"], ["puzzles", "/mini-games"], ["settings", "/settings"]]) {
    await shot(ctx, `89-lime-320-${name}`, path);
  }
  await ctx.close();
}

// Manager Mode tidy audit (v1.57): every hub screen and pop-up at 320 and 390 wide, plus where the
// page lands after Quick sim / a live match / switching tabs (viewport shots, not full page).
for (const [w, h] of [[320, 640], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const snap = async (name, fullPage = false) => {
    await page.waitForTimeout(450);
    await page.screenshot({ path: `${OUT}/90-${w}-${name}.png`, fullPage }).catch(() => {});
    console.log("shot", `90-${w}-${name}`);
  };
  const tab = (name) => page.getByRole("tab", { name, exact: true }).first().click({ timeout: 5000 });
  const esc = async () => {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  };
  const clearPopups = async () => {
    for (let i = 0; i < 4 && (await page.getByTestId("career-event").isVisible().catch(() => false)); i++) await esc();
  };
  try {
    await page.goto(BASE + "/manager", { waitUntil: "networkidle", timeout: 30000 });
    await page.getByRole("list", { name: "Clubs" }).getByRole("button").first().click({ timeout: 5000 });
    await page.getByRole("button", { name: /Take charge of/ }).click({ timeout: 5000 });
    await page.getByRole("dialog", { name: "Manager Mode walkthrough" }).getByRole("button", { name: "Skip" }).click({ timeout: 8000 }).catch(() => {});
    await snap("01-preseason", true);
    await page.getByRole("button", { name: "Open market" }).first().click({ timeout: 5000 }).catch(() => {});
    await snap("02-market");
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.getByRole("button", { name: /Back to pre-season/ }).click({ timeout: 5000 }).catch(() => {});
    await snap("03-back-from-market");
    await page.getByRole("button", { name: /^Skip pre-season/ }).click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(800);
    await snap("04-round1", true);
    await page.evaluate(() => window.scrollTo(0, 700));
    await page.getByRole("button", { name: "Quick sim" }).click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(900);
    await clearPopups();
    await snap("05-after-quick-sim");
    await snap("06-match-full", true);
    await page.evaluate(() => window.scrollTo(0, 700));
    await page.getByRole("button", { name: "Play match" }).click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await snap("07-live");
    for (let i = 0; i < 40; i++) {
      const call = page.locator("section[aria-label] button.btn-press").first();
      if (await call.isVisible().catch(() => false)) {
        await snap("08-live-call");
        break;
      }
      await page.waitForTimeout(500);
    }
    await page.getByRole("button", { name: "Skip to full time" }).first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(600);
    await snap("09-live-full-time");
    await page.getByRole("button", { name: "Continue", exact: true }).click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(900);
    await clearPopups();
    await snap("10-after-live");
    await page.evaluate(() => window.scrollTo(0, 500));
    await tab("Team");
    await snap("11-team-tab-landing");
    await snap("12-team-full", true);
    await page.getByRole("button", { name: "Change", exact: true }).first().click({ timeout: 5000 }).catch(() => {});
    await snap("13-captain-sheet");
    await esc();
    await page.getByRole("button", { name: /^Shirt 1,/ }).click({ timeout: 5000 }).catch(() => {});
    await snap("14-shirt-sheet");
    await esc();
    await tab("Table");
    await snap("15-table-full", true);
    await page.locator("table tbody tr").nth(2).getByRole("button").first().click({ timeout: 5000 }).catch(() => {});
    await snap("16-club-sheet");
    await esc();
    await tab("Club");
    await snap("17-club-full", true);
    for (const sub of ["Stats", "Records", "News"]) {
      if (await page.getByRole("tab", { name: sub, exact: true }).isVisible().catch(() => false)) {
        await tab(sub);
        await snap(`18-club-${sub.toLowerCase()}`, true);
      }
    }
    if (await page.getByRole("tab", { name: "Records", exact: true }).isVisible().catch(() => false)) await tab("Records");
    await page.getByRole("button", { name: "Legend Vault" }).first().click({ timeout: 5000 }).catch(() => {});
    await snap("19-vault-sheet");
    await esc();
    await page.getByRole("button", { name: "Records", exact: true }).first().click({ timeout: 5000 }).catch(() => {});
    await snap("20-records-sheet");
    await esc();
    if (await page.getByRole("tab", { name: "Overview", exact: true }).isVisible().catch(() => false)) await tab("Overview");
    await page.getByRole("button", { name: "Start a new career" }).click({ timeout: 5000 }).catch(() => {});
    await snap("21-new-career-confirm");
    await esc();
    // Hub pop-ups, injected: a legend signing (one button) and a two-choice event.
    await page.evaluate((k) => {
      const s = JSON.parse(localStorage.getItem(k) || "null");
      if (!s) return;
      const club = Object.values(s.clubs).find((c) => c.id !== s.userClubId);
      s.events = [
        ...(s.events || []),
        { id: "tidy-legend", kind: "legend-signing", year: s.year, clubId: club.id, name: "Sam Tomkins", rating: 91, title: `${club.name} sign Sam Tomkins!`, text: `A club legend is back at ${club.name}.`, options: [{ id: "ok", label: "Bring it on" }] },
        { id: "tidy-choice", kind: "record-bid", year: s.year, clubId: club.id, playerId: s.lineup[0], name: s.players[s.lineup[0]].name, rating: s.players[s.lineup[0]].rating, amount: 450000, title: "Record bid!", text: `${club.name} offer a club-record fee. Take the money?`, options: [{ id: "reject", label: "Reject" }, { id: "accept", label: "Accept · £450k" }] },
      ];
      localStorage.setItem(k, JSON.stringify(s));
    }, "27-0-career-v2-save");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByTestId("career-event").waitFor({ timeout: 5000 }).catch(() => {});
    await snap("22-popup-legend");
    await esc();
    await page.getByTestId("career-event").waitFor({ timeout: 3000 }).catch(() => {});
    await snap("23-popup-choice");
    await esc();
    await tab("Match");
    await snap("24-match-after-tab");
  } catch (e) {
    console.log("skip tidy", w, String(e).slice(0, 200));
  }
  await ctx.close();
}

// v1.65: the NRL in Manager Mode and the World Club Challenge, at 320 wide (and 390).
for (const [w, h] of [[320, 640], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const snap = async (name, fullPage = false) => {
    await page.waitForTimeout(450);
    await page.screenshot({ path: `${OUT}/95-${w}-${name}.png`, fullPage }).catch(() => {});
    console.log("shot", `95-${w}-${name}`);
  };
  const tab = (name) => page.getByRole("tab", { name, exact: true }).first().click({ timeout: 5000 });
  const clearPopups = async () => {
    for (let i = 0; i < 4 && (await page.getByTestId("career-event").isVisible().catch(() => false)); i++) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }
  };
  try {
    await page.goto(BASE + "/manager", { waitUntil: "networkidle", timeout: 30000 });
    await tab("NRL");
    await snap("01-picker-nrl");
    await snap("02-picker-nrl-full", true);
    await page.getByRole("list", { name: "Clubs" }).getByRole("button", { name: /Brisbane Broncos/ }).first().click({ timeout: 5000 });
    await page.getByRole("button", { name: /Take charge of/ }).click({ timeout: 5000 });
    await page.getByRole("dialog", { name: "Manager Mode walkthrough" }).getByRole("button", { name: "Skip" }).click({ timeout: 8000 }).catch(() => {});
    await snap("03-nrl-preseason", true);
    await page.getByRole("button", { name: /^Skip pre-season/ }).click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(800);
    await snap("04-wcc-banner");
    await snap("05-wcc-match-full", true);
    await page.getByRole("button", { name: "Quick sim" }).click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(900);
    await snap("06-wcc-popup");
    await clearPopups();
    await page.evaluate(() => window.scrollTo(0, 0));
    await snap("07-wcc-result");
    await tab("Table");
    await snap("08-nrl-table", true);
    await tab("Finals");
    await snap("09-nrl-finals-view", true);
    await tab("Fixtures");
    await snap("10-nrl-fixtures", true);
    await tab("League");
    await page.getByRole("tab", { name: /Super League/ }).last().click({ timeout: 5000 }).catch(() => {});
    await snap("11-sl-table-from-nrl", true);
    await tab("Club");
    if (await page.getByRole("tab", { name: "Records", exact: true }).isVisible().catch(() => false)) await tab("Records");
    await page.getByTestId("nrl-honours").scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
    await snap("12-nrl-hall-of-fame");
    // Sim to the end of the league for the finals.
    await tab("Match");
    for (let i = 0; i < 60; i++) {
      await clearPopups();
      if (await page.getByRole("region", { name: "League over" }).isVisible().catch(() => false)) break;
      if (await page.getByRole("button", { name: "Shut the window" }).first().isVisible().catch(() => false)) {
        await page.getByRole("button", { name: "Shut the window" }).first().click().catch(() => {});
        await page.waitForTimeout(400);
        continue;
      }
      const next = page.getByRole("button", { name: /^(Quick sim|Continue)$/ }).first();
      if (await next.isVisible().catch(() => false)) await next.click().catch(() => {});
      await page.waitForTimeout(150);
    }
    await snap("13-nrl-league-over", true);
    await page.getByRole("button", { name: /^(On to the finals|Watch the finals)$/ }).click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(600);
    await clearPopups();
    await snap("14-nrl-finals-week1", true);
  } catch (e) {
    console.log("skip nrl", w, String(e).slice(0, 200));
  }
  await ctx.close();
}
// Someone else's World Club Challenge: a Super League club lands on Round 1 with the result card.
{
  const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + "/manager", { waitUntil: "networkidle", timeout: 30000 });
    await page.getByRole("list", { name: "Clubs" }).getByRole("button", { name: /Wigan Warriors/ }).first().click({ timeout: 5000 });
    await page.getByRole("button", { name: /Take charge of/ }).click({ timeout: 5000 });
    await page.getByRole("dialog", { name: "Manager Mode walkthrough" }).getByRole("button", { name: "Skip" }).click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/96-320-sl-preseason-wcc.png`, fullPage: true });
    await page.getByRole("button", { name: /^Skip pre-season/ }).click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/96-320-sl-wcc-popup.png` });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/96-320-sl-round1-wcc-card.png`, fullPage: true });
    console.log("shot 96-320-sl");
  } catch (e) {
    console.log("skip sl wcc", String(e).slice(0, 200));
  }
  await ctx.close();
}

// Squad Book card tiles + the player card sheet (v1.72): seeded book and history, 320/375/desktop, dark + light.
{
  const ids = [
    "castleford-hist-derrell-olpherts-2022", "castleford-cur-phoenix-laulu-togagae", "catalans-cur-guillermo-aispuro-bichet",
    "castleford-cur-krystian-mapapalangi", "leeds-leg-kevin-sinfield-2009", "leeds-leg-kevin-sinfield-2015",
    "st-helens-hist-paul-wellens-2006", "st-helens-cur-jack-welsby", "catalans-cur-iszac-faasuamaleaui",
  ];
  const seed = (args) => {
    const [cardIds, on] = args;
    localStorage.setItem("27-0-dark-mode", JSON.stringify({ on, updatedAt: 1 }));
    if (localStorage.getItem("27-0-squad-book")) return;
    const cards = {};
    cardIds.forEach((id, i) => { cards[id] = { name: id, club: "", year: null, firstAt: 1735689600000 + i * 86400000, source: i % 2 ? "era" : "classic", times: 1 + (i % 4) }; });
    localStorage.setItem("27-0-squad-book", JSON.stringify({ v: 1, cards, claimed: [], runs: [], dreamTeam: Array(13).fill(null), dreamTeamAt: 0, favourites: [cardIds[4]], favouritesAt: 1 }));
    const counts = Object.fromEntries(cardIds.map((id, i) => [id, 2 + i]));
    localStorage.setItem("27-0-stats-schema-version", "3");
    if (!localStorage.getItem("27-0-stats")) {
      localStorage.setItem("27-0-stats", JSON.stringify({ normal: { draftCounts: counts, playerSeasonWins: Object.fromEntries(cardIds.map((id, i) => [id, 40 + i * 5])), playerSeasonLosses: Object.fromEntries(cardIds.map((id) => [id, 12])), playerPerfectSeasons: { [cardIds[4]]: 1 }, playerTries: { [cardIds[4]]: 9 } } }));
    }
  };
  for (const [w, h, label] of [[320, 640, "320"], [375, 812, "375"], [1366, 900, "desktop"]]) {
    for (const dark of [true, false]) {
      const mobile = w < 1000;
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
      await ctx.addInitScript(seed, [ids, dark]);
      const page = await ctx.newPage();
      const tag = `97-${label}-${dark ? "dark" : "light"}`;
      try {
        await page.goto(BASE + "/squad-book", { waitUntil: "networkidle", timeout: 30000 });
        await page.waitForTimeout(900);
        await page.getByRole("tab", { name: /Cards/ }).first().click({ timeout: 5000 }).catch(async () => {
          await page.getByRole("button", { name: /^Cards$/ }).first().click({ timeout: 5000 });
        });
        await page.getByRole("button", { name: /^collected$/i }).first().click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(700);
        await page.screenshot({ path: `${OUT}/${tag}-squad-book-cards.png`, fullPage: true });
        await page.locator("[data-rarity]", { hasText: "Kevin Sinfield" }).first().click({ timeout: 5000 });
        await page.waitForTimeout(900);
        await page.screenshot({ path: `${OUT}/${tag}-card-sheet.png` });
        // A tall viewport shows the whole sheet (it scrolls inside a capped-height panel).
        await page.setViewportSize({ width: w, height: 3000 });
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${OUT}/${tag}-card-sheet-full.png` });
        console.log("shot", tag);
      } catch (e) {
        console.log("skip", tag, String(e).slice(0, 200));
      }
      await ctx.close();
    }
  }
}

await browser.close();
