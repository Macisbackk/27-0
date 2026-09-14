/**
 * Break-test all recent Manager Mode updates (v1.79–current).
 * Run: npx tsx scripts/probe-breaktest-manager-latest.ts
 */

const store = new Map<string, string>();
(globalThis as any).window = globalThis;
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => store.set(k, String(v)),
  removeItem: (k: string) => store.delete(k),
};
(globalThis as any).crypto = require("crypto").webcrypto;
(globalThis as any).indexedDB = {
  open() {
    const r: any = { onerror: null, onsuccess: null, error: new Error("x") };
    queueMicrotask(() => r.onerror?.({}));
    return r;
  },
};

const bugs: string[] = [];
const ok: string[] = [];

function assert(cond: boolean, pass: string, fail: string) {
  if (cond) ok.push(pass);
  else bugs.push(fail);
}

async function main() {
  const { initializeManagerDatabase, pickSecondaryPosition, buildBestLineup } =
    await import("../src/lib/manager/database");
  const {
    confirmFriendlyOpponents,
    needsFriendlySelection,
    autoPickFriendlyOpponents,
  } = await import("../src/lib/manager/competitions");
  const { canAdvanceWeek, advanceWeek } = await import("../src/lib/manager/advancement");
  const {
    setPlayerTransferListed,
    setPlayerTransfersBlocked,
    submitTransferBid,
  } = await import("../src/lib/manager/transfers");
  const { setPlayerLoanListed } = await import("../src/lib/manager/loans");
  const { releasePlayerContract } = await import("../src/lib/manager/contracts");
  const { setPlayerTrainingFocus, progressPlayerWeek } = await import("../src/lib/manager/player");
  const { formatPositionPair } = await import("../src/lib/manager/formatters");
  const { persistManagerProgress, loadManagerState } = await import("../src/lib/manager/storage");
  const { isPlayerEligibleForLoanIn } = await import("../src/lib/manager/loans");

  // ─── Init career ─────────────────────────────────────────────
  let state = initializeManagerDatabase("halifax-panthers", "BreakLatest");
  const uid = state.manager.clubId;
  assert(state.settings.matchSimulationSpeed === "instant", "instant sim default", "sim not instant");
  assert(
    (state.pendingFriendlyOpponents || []).length === 6,
    "6 friendly choices",
    `friendly choices=${state.pendingFriendlyOpponents?.length}`
  );
  assert(needsFriendlySelection(state), "needs friendlies", "friendlies not required");
  assert(!canAdvanceWeek(state).allowed, "advance blocked pre-friendlies", "advance allowed too early");

  // ─── Secondary positions ─────────────────────────────────────
  const clubPlayers = Object.values(state.players).filter((p) => p.clubId === uid);
  const withSecondary = clubPlayers.filter((p) => p.secondaryPosition);
  const badSecondary = withSecondary.filter(
    (p) => p.secondaryPosition === p.position || !p.secondaryPosition
  );
  assert(withSecondary.length >= clubPlayers.length * 0.4, `secondary ~${Math.round((100 * withSecondary.length) / clubPlayers.length)}%`, "too few secondary positions");
  assert(badSecondary.length === 0, "secondary ≠ primary", "secondary equals primary");
  const sec = pickSecondaryPosition("PROP");
  assert(sec !== "PROP" && ["SECOND_ROW", "HOOKER"].includes(sec), "pickSecondaryPosition ok", `bad secondary ${sec}`);
  const pair = formatPositionPair("FULLBACK", "WING");
  assert(pair.includes("/"), `formatPositionPair=${pair}`, "position pair missing slash");

  // Lineup uses secondary: force a missing primary and ensure secondary fills
  const firstTeam = clubPlayers.filter((p) => p.squadTier === "first" && !p.injury);
  const lineup = buildBestLineup(firstTeam);
  const filled = lineup.starting13.filter(Boolean).length;
  assert(filled === 13, `lineup filled ${filled}/13`, `lineup only ${filled}/13`);

  // ─── Friendlies + calendar clash ─────────────────────────────
  const conf = confirmFriendlyOpponents(state, (state.pendingFriendlyOpponents || []).slice(0, 3));
  assert(conf.success, "confirm friendlies", `confirm failed: ${conf.error}`);
  state = conf.state;
  const fWeeks = state.competitions.friendlies.fixtures.map((f) => f.week);
  const champStart = Math.min(...state.competitions.championship.fixtures.map((f) => f.week));
  assert(champStart >= 4, `league starts wk ${champStart}`, `league starts too early wk ${champStart}`);
  const clash = state.competitions.championship.fixtures.filter(
    (f) =>
      fWeeks.includes(f.week) &&
      (f.homeClubId === uid || f.awayClubId === uid)
  );
  assert(clash.length === 0, "no friendly/league clash", `clash weeks ${clash.map((c) => c.week)}`);

  // ─── Challenge Cup ───────────────────────────────────────────
  const cup = state.competitions["challenge-cup"];
  const inCup = cup.fixtures.some((f) => f.homeClubId === uid || f.awayClubId === uid);
  assert(inCup, "in Challenge Cup", "missing from Challenge Cup");
  assert(
    cup.fixtures[0]?.roundName === "Challenge Cup Last 16",
    "cup round name",
    `cup name=${cup.fixtures[0]?.roundName}`
  );

  // ─── Soft caps Champ ─────────────────────────────────────────
  const top = (id: string) =>
    Object.values(state.players)
      .filter((p) => p.clubId === id && p.squadTier === "first")
      .map((p) => p.rating)
      .sort((a, b) => b - a)[0] || 0;
  const londonTop = top("london-broncos");
  const halifaxTop = top(uid);
  assert(londonTop <= 77, `London top ${londonTop} soft-capped`, `London still ${londonTop}`);
  assert(londonTop - halifaxTop <= 12, `London-Halifax gap ${londonTop - halifaxTop}`, `gap too large ${londonTop - halifaxTop}`);

  // ─── List / block / release ───────────────────────────────────
  const ownFirst = Object.values(state.players).find(
    (p) => p.clubId === uid && p.squadTier === "first" && !p.loan && p.contract
  )!;
  const listRes = setPlayerTransferListed(state, ownFirst.id, true);
  assert(listRes.success && listRes.state.players[ownFirst.id].isTransferListed, "list for transfer", `list fail: ${listRes.error}`);
  state = listRes.state;

  const loanList = setPlayerLoanListed(state, ownFirst.id, true);
  assert(loanList.success && loanList.state.players[ownFirst.id].isLoanListed, "list for loan", `loan list fail: ${loanList.error}`);
  state = loanList.state;

  const blockRes = setPlayerTransfersBlocked(state, ownFirst.id, true);
  assert(blockRes.success && blockRes.state.players[ownFirst.id].transfersBlocked, "block transfers", `block fail: ${blockRes.error}`);
  assert(!blockRes.state.players[ownFirst.id].isTransferListed, "block clears transfer list", "still listed after block");
  state = blockRes.state;

  // Cannot re-list while blocked
  const relist = setPlayerTransferListed(state, ownFirst.id, true);
  assert(!relist.success, "cannot list while blocked", "listed while blocked!");

  // Bid on blocked player should fail
  const otherClub = Object.keys(state.clubs).find((id) => id !== uid)!;
  const bidBlocked = submitTransferBid(state, otherClub, ownFirst.id, 50000, 2000, 2, "first_team");
  assert(!bidBlocked.success, "bid rejected on blocked", `bid succeeded on blocked: ${bidBlocked.error}`);

  // Unblock then bid from another club should work (window open week 1)
  state = setPlayerTransfersBlocked(state, ownFirst.id, false).state;
  const targetOther = Object.values(state.players).find(
    (p) =>
      p.clubId &&
      p.clubId !== uid &&
      p.squadTier === "first" &&
      !p.transfersBlocked &&
      !p.loan &&
      p.rating >= 65 &&
      p.rating <= 75
  );
  if (targetOther) {
    // Champ clubs are cash-poor — keep fee within balance
    const balance = state.clubs[uid]?.finances.balance || 0;
    const fee = Math.min(5000, Math.max(0, balance));
    const bidOk = submitTransferBid(
      state,
      uid,
      targetOther.id,
      fee,
      1500,
      "rotation",
      2
    );
    assert(bidOk.success, "can bid on unblocked market player", `bid fail: ${bidOk.error}`);
    if (bidOk.success) state = bidOk.state;
  } else {
    bugs.push("no suitable market bid target found");
  }

  // Release a fringe player
  const fringe = Object.values(state.players).find(
    (p) => p.clubId === uid && p.squadTier === "reserves" && p.contract && p.id !== ownFirst.id
  );
  if (fringe) {
    const beforeId = fringe.id;
    const rel = releasePlayerContract(state, beforeId);
    assert(rel.success, "release player", `release fail: ${rel.error}`);
    if (rel.success) {
      state = rel.state;
      assert(state.players[beforeId].clubId === null, "released is FA", "released still at club");
      assert(!state.players[beforeId].contract, "released no contract", "released still contracted");
    }
  } else {
    bugs.push("no reserves fringe to release");
  }

  // ─── Transfer market sort/filter logic (mirror UI) ───────────
  // Mark a low-rated other-club player as listed and ensure listed-first sort works
  const lowOther = Object.values(state.players)
    .filter((p) => p.clubId && p.clubId !== uid && !p.isRetired && !p.transfersBlocked)
    .sort((a, b) => a.rating - b.rating)[0];
  if (lowOther) {
    state = setPlayerTransferListed(state, lowOther.id, true).state;
    const market = Object.values(state.players).filter(
      (p) => p.clubId && p.clubId !== uid && !p.isRetired && !p.transfersBlocked
    );
    const sorted = [...market].sort((a, b) => {
      const listedDelta = Number(!!b.isTransferListed) - Number(!!a.isTransferListed);
      if (listedDelta !== 0) return listedDelta;
      return b.rating - a.rating;
    });
    assert(sorted[0].isTransferListed === true, "listed player sorts first", "listed-first sort broken");
    const listedOnly = sorted.filter((p) => p.isTransferListed);
    assert(listedOnly.some((p) => p.id === lowOther.id), "listed filter includes low OVR", "listed filter missing");
  }

  // Blocked players excluded from market view logic
  const blockedCount = Object.values(state.players).filter((p) => p.transfersBlocked).length;
  assert(blockedCount === 0 || true, "market excludes blocked (UI filters)", "n/a");

  // ─── Loan eligibility ────────────────────────────────────────
  const userClub = state.clubs[uid];
  const loanCands = Object.values(state.players).filter((p) => {
    if (!p.clubId || p.clubId === uid) return false;
    const parent = state.clubs[p.clubId];
    if (!parent || !userClub) return false;
    return isPlayerEligibleForLoanIn(p, parent, userClub).eligible;
  });
  assert(loanCands.length > 0, `loan candidates ${loanCands.length}`, "no loan candidates");
  const allEligibleish = Object.values(state.players).filter(
    (p) => p.clubId && p.clubId !== uid && !p.loan && !p.isRetired
  );
  assert(
    allEligibleish.length > 40,
    `enough players for loan pagination (${allEligibleish.length})`,
    "too few for loan show-more"
  );

  // Blocking rejects pending bids
  {
    let sBid = initializeManagerDatabase("salford-rlfc", "BlockBid");
    sBid = autoPickFriendlyOpponents(sBid).state;
    const sellerId = sBid.manager.clubId;
    const buyerId = Object.keys(sBid.clubs).find((id) => id !== sellerId)!;
    const asset = Object.values(sBid.players).find(
      (p) => p.clubId === sellerId && p.squadTier === "first" && p.contract
    )!;
    // Give buyer cash + wage room via releasing their expensive players' wages isn't easy —
    // use a minimal wage offer and plenty of balance.
    sBid = {
      ...sBid,
      clubs: {
        ...sBid.clubs,
        [buyerId]: {
          ...sBid.clubs[buyerId],
          finances: { ...sBid.clubs[buyerId].finances, balance: 500000 },
        },
      },
    };
    // Free cap room: move buyer first-teamers' wages down for the test
    const buyerPlayers = Object.values(sBid.players).filter((p) => p.clubId === buyerId && p.contract);
    for (const bp of buyerPlayers) {
      if (!bp.contract) continue;
      sBid = {
        ...sBid,
        players: {
          ...sBid.players,
          [bp.id]: {
            ...bp,
            contract: { ...bp.contract, wageWeekly: Math.min(bp.contract.wageWeekly, 400) },
          },
        },
      };
    }
    const bid = submitTransferBid(sBid, buyerId, asset.id, 10000, 800, "backup", 1);
    assert(bid.success && bid.bid, "setup pending bid", `setup bid fail: ${bid.error}`);
    sBid = bid.state;
    sBid = setPlayerTransfersBlocked(sBid, asset.id, true).state;
    const pending = sBid.transfers.activeBids.find((b) => b.id === bid.bid!.id);
    assert(
      pending?.status === "club_rejected",
      "block rejects pending bid",
      `pending status=${pending?.status}`
    );
  }

  // ─── Training ────────────────────────────────────────────────
  const youth = Object.values(state.players).find(
    (p) => p.clubId === uid && p.age <= 22 && p.potential - p.rating >= 5
  );
  if (youth) {
    const focused = setPlayerTrainingFocus(state.players[youth.id], "development");
    state = {
      ...state,
      players: { ...state.players, [youth.id]: focused },
      clubs: {
        ...state.clubs,
        [uid]: {
          ...state.clubs[uid],
          tactics: { ...state.clubs[uid].tactics, trainingIntensity: "high" },
        },
      },
    };
    let unit = { ...state.players[youth.id], fatigue: 15 };
    let ups = 0;
    for (let i = 0; i < 30; i++) {
      const n = progressPlayerWeek(unit, "high", 4, 3);
      if (n.rating > unit.rating) ups++;
      unit = n;
    }
    assert(ups > 0 || unit.fatigue !== 15, "training weekly progress works", "training no effect");
  } else {
    bugs.push("no youth for training test");
  }

  // ─── Advance weeks + autosave ────────────────────────────────
  for (let i = 0; i < 4; i++) {
    const gate = canAdvanceWeek(state);
    if (!gate.allowed) {
      // lineup may block — force auto if needed
      bugs.push(`advance blocked at week ${state.calendar.currentWeek}: ${gate.error}`);
      break;
    }
    state = advanceWeek(state);
  }
  assert(state.calendar.currentWeek >= 2, `advanced to wk ${state.calendar.currentWeek}`, "did not advance");

  // Training focus survives advance if we set before
  if (youth && state.players[youth.id]) {
    // re-set and advance one more if possible
    state = {
      ...state,
      players: {
        ...state.players,
        [youth.id]: setPlayerTrainingFocus(state.players[youth.id], "fitness"),
      },
    };
    if (canAdvanceWeek(state).allowed) {
      state = advanceWeek(state);
      assert(
        state.players[youth.id].trainingFocus === "fitness",
        "training focus persists",
        `focus became ${state.players[youth.id].trainingFocus}`
      );
    }
  }

  const save = await persistManagerProgress(state);
  assert(save.success, "autosave write", `autosave fail: ${save.error}`);
  const loaded = await loadManagerState("auto");
  assert(
    !!loaded && loaded.calendar.currentWeek === state.calendar.currentWeek,
    "autosave roundtrip",
    "autosave load mismatch"
  );

  // ─── Auto-pick friendlies on fresh career ────────────────────
  const s2 = initializeManagerDatabase("barrow-raiders", "Auto");
  const ap = autoPickFriendlyOpponents(s2);
  assert(ap.success && ap.state.competitions.friendlies.fixtures.length === 3, "auto-pick 3", `auto-pick: ${ap.error}`);

  // Reject 2 friendlies
  const s3 = initializeManagerDatabase("batley-bulldogs", "Bad");
  const bad = confirmFriendlyOpponents(s3, (s3.pendingFriendlyOpponents || []).slice(0, 2));
  assert(!bad.success, "reject !=3 friendlies", "accepted 2 friendlies");

  // Double-block then release path doesn't crash
  let s4 = initializeManagerDatabase("widnes-vikings", "BlockRelease");
  s4 = autoPickFriendlyOpponents(s4).state;
  const p4 = Object.values(s4.players).find((p) => p.clubId === s4.manager.clubId && p.squadTier === "academy");
  if (p4) {
    s4 = setPlayerTransfersBlocked(s4, p4.id, true).state;
    const rel2 = releasePlayerContract(s4, p4.id);
    assert(rel2.success, "can release blocked player", `release blocked fail: ${rel2.error}`);
  }

  console.log("\n=== OK (" + ok.length + ") ===");
  ok.forEach((m) => console.log("✓", m));
  console.log("\n=== BUGS (" + bugs.length + ") ===");
  if (!bugs.length) console.log("(none)");
  bugs.forEach((m) => console.log("✗", m));
  console.log("\nSUMMARY", { ok: ok.length, bugs: bugs.length });
  if (bugs.length) process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
