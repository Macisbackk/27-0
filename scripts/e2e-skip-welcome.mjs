/**
 * Browser tests that expect the homepage on "/" start as a returning guest, so the first-visit
 * welcome screen (src/lib/entry-gate.ts) doesn't stand in front of it. scripts/e2e-welcome.mjs
 * tests the welcome screen itself and doesn't use this.
 *
 *   const browser = skipWelcome(await chromium.launch());
 *
 * Every context the browser makes afterwards gets the init script. Only sets the flag when it's
 * missing, so a test that writes or corrupts it keeps its own value.
 */
export function markReturningGuest() {
  try {
    if (!localStorage.getItem("27-0-entry")) localStorage.setItem("27-0-entry", "guest");
  } catch {
    /* about:blank / storage blocked */
  }
}

export function skipWelcome(browser) {
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (...args) => {
    const context = await newContext(...args);
    await context.addInitScript(markReturningGuest);
    return context;
  };
  return browser;
}
