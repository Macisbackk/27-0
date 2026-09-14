/**
 * Adversarial edge probes for Manager Mode.
 * Run: npx tsx scripts/probe-breaktest-manager-edge.ts
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
    const r: any = { onerror: null };
    queueMicrotask(() => r.onerror?.({}));
    return r;
  },
};

type Bug = {
  severity: "P0" | "P1" | "P2";
  area: string;
  message: string;
  file?: string;
  reproduction: string;
  rootCauseHypothesis: string;
  suggestedFix: string;
};

const bugs: Bug[] = [];
const ok: string[] = [];

function pass(m: string) {
  ok.push(m);
}
function fail(b: Bug) {
  bugs.push(b);
}
function assert(
  cond: boolean,
  passMsg: string,
  bug: Omit<Bug, "message"> & { message: string }
) {
  if (cond) pass(passMsg);
  else fail(bug);
}

async function main() {
  const { initializeManagerDatabase } = await import("../src/lib/manager/database");
  const { autoPickFriendlyOpponents } = await import("../src/lib/manager/competitions");
  const { advanceWeek, canAdvanceWeek } = await import("../src/lib/manager/advancement");
  const {
    safeguardClubMatchdayLineup,
    isPlayerAvailableForClub,
    validateSquadInvariants,
  } = await import("../src/lib/manager/squad");
  const {
    createLoanAgreement,
    loanPlayerIn,
    tickActiveLoans,
  } = await import("../src/lib/manager/loans");
  const {
    submitTransferBid,
    evaluateSellingClubBid,
    evaluatePlayerTransferTerms,
    completeTransfer,
    setPlayerTransfersBlocked,
  } = await import("../src/lib/manager/transfers");
  const { releasePlayerContract } = await import("../src/lib/manager/contracts");
  const {
    isRecentlySignedPlayer,
    weeksSinceClubJoin,
    absoluteCalendarWeek,
    TRANSFER_PROTECTION,
  } = await import("../src/lib/manager/rules");
  const { rolloverSeason, calculateSeasonAwards } = await import(
    "../src/lib/manager/rollover"
  );

  let s = initializeManagerDatabase("halifax-panthers", "Edge");
  s = autoPickFriendlyOpponents(s).state;
  const uid = s.manager.clubId;
  s = safeguardClubMatchdayLineup(s, uid);
  s = {
    ...s,
    clubs: {
      ...s.clubs,
      [uid]: {
        ...s.clubs[uid],
        finances: { ...s.clubs[uid].finances, balance: 5_000_000 },
      },
    },
  };
  for (const pl of Object.values(s.players)) {
    if (pl.clubId === uid && pl.contract) {
      s = {
        ...s,
        players: {
          ...s.players,
          [pl.id]: {
            ...pl,
            contract: { ...pl.contract, wageWeekly: Math.min(pl.contract.wageWeekly, 250) },
          },
        },
      };
    }
  }

  // ── Idempotency ────────────────────────────────────────────
  if (canAdvanceWeek(s).allowed) {
    const a1 = advanceWeek(s);
    const weekKey = `${s.calendar.currentSeason}_w${s.calendar.currentWeek}`;
    const spoof = {
      ...a1,
      calendar: {
        ...a1.calendar,
        currentWeek: s.calendar.currentWeek,
        // keep processed keys from a1 which includes weekKey
      },
    };
    const again = advanceWeek(spoof as any);
    assert(
      again.calendar.processedWeekKeys.filter((k: string) => k === weekKey).length === 1 &&
        again.calendar.currentWeek === s.calendar.currentWeek,
      "idempotent advanceWeek",
      {
        severity: "P0",
        area: "advance",
        message: "advanceWeek reprocessed an already-processed week key",
        file: "src/lib/manager/advancement.ts:95",
        reproduction: "advanceWeek twice with same processedWeekKeys entry",
        rootCauseHypothesis: "idempotency check missing or weekKey mismatch",
        suggestedFix: "Return state unchanged when weekKey already processed",
      }
    );
    s = a1;
  }

  // ── Recent signing across season boundary ──────────────────
  {
    const elapsed = weeksSinceClubJoin(2025, 30, 2026, 2);
    const absJoin = absoluteCalendarWeek(2025, 30);
    const absNow = absoluteCalendarWeek(2026, 2);
    pass(`weeksSinceJoin season boundary=${elapsed} (abs ${absNow}-${absJoin})`);
    assert(
      elapsed !== null && elapsed === absNow - absJoin,
      "weeksSinceClubJoin math",
      {
        severity: "P1",
        area: "transfers",
        message: `weeksSinceClubJoin unexpected ${elapsed}`,
        file: "src/lib/manager/rules.ts:179",
        reproduction: "weeksSinceClubJoin(2025,30,2026,2)",
        rootCauseHypothesis: "absolute week math wrong",
        suggestedFix: "season*TOTAL_WEEKS + week",
      }
    );
    const recent = isRecentlySignedPlayer(
      { joinedSeason: 2025, joinedWeek: 30 },
      2026,
      2
    );
    assert(
      recent === (elapsed! >= 0 && elapsed! < TRANSFER_PROTECTION.RECENT_SIGNING_WEEKS),
      `recent across boundary=${recent}`,
      {
        severity: "P1",
        area: "transfers",
        message: "isRecentlySignedPlayer disagree with elapsed",
        file: "src/lib/manager/rules.ts:193",
        reproduction: "join late prior season, query early next",
        rootCauseHypothesis: "boundary not handled",
        suggestedFix: "Use absoluteCalendarWeek delta",
      }
    );
  }

  // ── Transfer of loaned player ──────────────────────────────
  {
    const parentId = Object.keys(s.clubs).find(
      (id) => id !== uid && s.clubs[id].competitionId === "super-league"
    )!;
    const destId = Object.keys(s.clubs).find(
      (id) =>
        id !== uid &&
        id !== parentId &&
        s.clubs[id].competitionId === "championship"
    )!;
    const loanP = Object.values(s.players).find(
      (x) =>
        x.clubId === parentId &&
        x.squadTier === "reserves" &&
        !x.loan &&
        x.contract &&
        x.rating < 76
    );
    assert(!!loanP, "loan+transfer setup", {
      severity: "P2",
      area: "loans",
      message: "no SL reserves loan candidate",
      reproduction: "scan SL reserves",
      rootCauseHypothesis: "depth",
      suggestedFix: "n/a",
    });
    if (loanP) {
      // Put on parent lineup first to ensure clear works
      s = {
        ...s,
        clubs: {
          ...s.clubs,
          [parentId]: {
            ...s.clubs[parentId],
            lineup: {
              ...s.clubs[parentId].lineup,
              bench: [loanP.id, ...s.clubs[parentId].lineup.bench.slice(0, 3)],
            },
          },
          [destId]: {
            ...s.clubs[destId],
            lineup: {
              ...s.clubs[destId].lineup,
              bench: [loanP.id, ...s.clubs[destId].lineup.bench.slice(1)],
            },
          },
        },
      };
      let t = createLoanAgreement(s, parentId, destId, loanP.id, 10, 50, true).state;
      assert(!!t.players[loanP.id].loan, "loan created", {
        severity: "P0",
        area: "loans",
        message: `createLoanAgreement failed`,
        file: "src/lib/manager/loans.ts:51",
        reproduction: "SL→Champ loan",
        rootCauseHypothesis: "agreement rejected",
        suggestedFix: "Allow SL→Champ loans",
      });
      assert(isPlayerAvailableForClub(t.players[loanP.id], destId), "avail at dest", {
        severity: "P0",
        area: "loans",
        message: "loaned player not available at destination",
        file: "src/lib/manager/squad.ts:37",
        reproduction: "after createLoanAgreement",
        rootCauseHypothesis: "availability uses clubId only",
        suggestedFix: "Check loan.destinationClubId",
      });
      assert(!isPlayerAvailableForClub(t.players[loanP.id], parentId), "not avail at parent", {
        severity: "P0",
        area: "loans",
        message: "loaned player still available at parent",
        file: "src/lib/manager/squad.ts:37",
        reproduction: "after createLoanAgreement",
        rootCauseHypothesis: "loan branch missing",
        suggestedFix: "Return false for parent while loaned",
      });
      const parentLu = [
        ...t.clubs[parentId].lineup.starting13,
        ...t.clubs[parentId].lineup.bench,
      ];
      assert(!parentLu.includes(loanP.id), "cleared from parent lineup", {
        severity: "P1",
        area: "loans",
        message: "loaned player remains in parent matchday lineup",
        file: "src/lib/manager/loans.ts:110",
        reproduction: "player on parent bench → createLoanAgreement",
        rootCauseHypothesis: "parent lineup scrub incomplete",
        suggestedFix: "Null out player id from parent starting13/bench",
      });

      const bid = submitTransferBid(t, uid, loanP.id, 50000, 1500, "rotation", 2);
      assert(bid.success, "bid on loaned player", {
        severity: "P1",
        area: "transfers",
        message: `cannot bid on loaned player: ${bid.error}`,
        file: "src/lib/manager/transfers.ts:129",
        reproduction: "submitTransferBid for player with active loan",
        rootCauseHypothesis: "loan incorrectly blocks bids",
        suggestedFix: "Allow permanent transfer of loaned players",
      });
      if (bid.success && bid.bid) {
        t = evaluateSellingClubBid(bid.state, bid.bid.id, "accept").state;
        const terms = evaluatePlayerTransferTerms(t, bid.bid.id);
        t = terms.state;
        if (terms.bid?.status === "player_accepted") {
          const done = completeTransfer(t, bid.bid.id);
          assert(
            !!(done.success && done.state.players[loanP.id].clubId === uid && !done.state.players[loanP.id].loan),
            "transfer clears loan ownership",
            {
              severity: "P0",
              area: "transfers",
              message: `completeTransfer of loaned player failed: ${done.error}`,
              file: "src/lib/manager/transfers.ts:570",
              reproduction: "buy player currently on loan",
              rootCauseHypothesis: "loan not cleared or ownership wrong",
              suggestedFix: "Set loan=null, clubId=buyer, drop activeLoans",
            }
          );
          if (done.success) {
            const destLu = [
              ...done.state.clubs[destId].lineup.starting13,
              ...done.state.clubs[destId].lineup.bench,
            ];
            assert(!destLu.includes(loanP.id), "cleared from loan dest lineup", {
              severity: "P1",
              area: "transfers",
              message: "bought loaned player still named at former loan destination",
              file: "src/lib/manager/transfers.ts:556",
              reproduction: "completeTransfer while player on loan",
              rootCauseHypothesis: "loan dest lineup scrub missing",
              suggestedFix: "Strip player from loan destination lineup",
            });
            assert(
              !(done.state.transfers.activeLoans || []).some((l) => l.playerId === loanP.id),
              "removed from activeLoans",
              {
                severity: "P1",
                area: "transfers",
                message: "activeLoans still contains transferred player",
                file: "src/lib/manager/transfers.ts:612",
                reproduction: "completeTransfer of loaned player",
                rootCauseHypothesis: "activeLoans filter missing",
                suggestedFix: "Filter activeLoans by playerId",
              }
            );
          }
        } else {
          pass(`loaned transfer terms=${terms.bid?.status} (non-fatal)`);
        }
      }
    }
  }

  // ── Orphan activeLoans never cleaned ───────────────────────
  {
    const pid = Object.values(s.players).find((p) => p.clubId === uid && !p.loan)!.id;
    const dest = Object.keys(s.clubs).find((id) => id !== uid)!;
    const t = {
      ...s,
      transfers: {
        ...s.transfers,
        activeLoans: [
          {
            id: "orphan_loan",
            playerId: pid,
            playerName: "Orphan",
            parentClubId: uid,
            destinationClubId: dest,
            seasonStarted: 2026,
            weekStarted: 1,
            totalWeeks: 2,
            weeksRemaining: 1,
            wageContributionPct: 50,
            canRecall: true,
          },
          ...s.transfers.activeLoans,
        ],
      },
    };
    // Ensure player.loan is null (orphan record)
    const after = tickActiveLoans({
      ...t,
      players: {
        ...t.players,
        [pid]: { ...t.players[pid], loan: null },
      },
    });
    const orphanRemains = (after.transfers.activeLoans || []).some(
      (l) => l.id === "orphan_loan"
    );
    assert(!orphanRemains, "tickActiveLoans drops orphan activeLoans", {
      severity: "P1",
      area: "loans",
      message: "orphan activeLoans (no player.loan) persist forever across ticks",
      file: "src/lib/manager/loans.ts:256",
      reproduction: "inject activeLoans row without matching player.loan; tickActiveLoans",
      rootCauseHypothesis: "tick skips entries when !player.loan without removing them",
      suggestedFix: "Filter out activeLoans whose player has no loan (or repair/sync)",
    });
  }

  // ── Duplicate inbox on loanPlayerIn ────────────────────────
  {
    const cand = Object.values(s.players).find((p) => {
      if (!p.clubId || p.clubId === uid || p.loan || p.isRetired) return false;
      const parent = s.clubs[p.clubId];
      return (
        parent?.competitionId === "super-league" &&
        (p.squadTier === "reserves" || p.rating < 75)
      );
    });
    if (cand) {
      const before = s.inbox.messages.filter((m) => m.category === "loan").length;
      const res = loanPlayerIn(s, uid, cand.id, 6, 50, true);
      if (res.success) {
        const after = res.state.inbox.messages.filter(
          (m) =>
            m.category === "loan" &&
            m.subject.includes(cand.name) &&
            m.week === s.calendar.currentWeek
        );
        assert(
          after.length === 1,
          "loanPlayerIn single inbox message",
          {
            severity: "P1",
            area: "loans",
            message: `loanPlayerIn created ${after.length} inbox messages for one signing (expected 1)`,
            file: "src/lib/manager/loans.ts:404",
            reproduction: "loanPlayerIn involving user club",
            rootCauseHypothesis:
              "createLoanAgreement already posts inbox; loanPlayerIn posts a second",
            suggestedFix: "Pass silent/noInbox to createLoanAgreement or skip duplicate in loanPlayerIn",
          }
        );
      } else {
        pass(`loanPlayerIn skip: ${res.error}`);
      }
    }
  }

  // ── Block does not clear loan list (document) ──────────────
  {
    const own = Object.values(s.players).find(
      (p) => p.clubId === uid && !p.loan && p.contract
    )!;
    let t = {
      ...s,
      players: { ...s.players, [own.id]: { ...own, isLoanListed: true } },
    };
    t = setPlayerTransfersBlocked(t, own.id, true).state;
    assert(
      !t.players[own.id].isLoanListed,
      "block clears loan listing",
      {
        severity: "P2",
        area: "transfers",
        message: "transfersBlocked leaves isLoanListed=true",
        file: "src/lib/manager/transfers.ts:75",
        reproduction: "isLoanListed=true then setPlayerTransfersBlocked(true)",
        rootCauseHypothesis: "block only clears transfer list flag",
        suggestedFix: "Also clear isLoanListed when blocking",
      }
    );
  }

  // ── MPG duplicate promo asymmetry ──────────────────────────
  {
    let end = initializeManagerDatabase("halifax-panthers", "MpgEdge");
    end = autoPickFriendlyOpponents(end).state;
    const slIds = Object.values(end.clubs)
      .filter((c) => c.competitionId === "super-league")
      .map((c) => c.id);
    const chIds = Object.values(end.clubs)
      .filter((c) => c.competitionId === "championship")
      .map((c) => c.id);
    // Corrupt MPG: champ winner is ALSO championship 1st (auto-promoted)
    end = {
      ...end,
      calendar: { ...end.calendar, currentWeek: 32, phase: "season_end" },
      competitions: {
        ...end.competitions,
        "super-league": {
          ...end.competitions["super-league"],
          standings: slIds.map((id, i) => ({
            clubId: id,
            played: 27,
            won: 26 - i,
            drawn: 0,
            lost: i,
            pointsFor: 800,
            pointsAgainst: 400,
            pointsDiff: 400,
            points: (26 - i) * 2,
            form: ["W"],
          })),
          fixtures: [
            {
              id: "mpg_dup",
              competitionId: "super-league",
              season: end.calendar.currentSeason,
              week: 31,
              roundName: "The Million Pound Game",
              homeClubId: slIds[12],
              awayClubId: chIds[0], // SAME as auto-promoted
              homeScore: 10,
              awayScore: 20,
              isPlayed: true,
            },
          ],
        },
        championship: {
          ...end.competitions.championship,
          standings: chIds.map((id, i) => ({
            clubId: id,
            played: 27,
            won: 26 - i,
            drawn: 0,
            lost: i,
            pointsFor: 700,
            pointsAgainst: 350,
            pointsDiff: 350,
            points: (26 - i) * 2,
            form: ["W"],
          })),
        },
      },
    };
    const awards = calculateSeasonAwards(end);
    assert(
      awards.promotedClubIds.length === awards.relegatedClubIds.length,
      `promo/releg balanced under MPG dup (${awards.promotedClubIds.length}/${awards.relegatedClubIds.length})`,
      {
        severity: "P0",
        area: "rollover",
        message: `Unbalanced promo/releg when MPG champ equals auto-promoted: P=${awards.promotedClubIds.join(",")} R=${awards.relegatedClubIds.join(",")}`,
        file: "src/lib/manager/rollover.ts:220",
        reproduction:
          "MPG away=championship 1st (already auto-promoted), champ wins MPG → relegated gets 13th SL pushed but promoted stays length 1",
        rootCauseHypothesis:
          "includes() guard skips duplicate promote but still adds unique relegation",
        suggestedFix:
          "When MPG champ already promoted, still ensure equal counts — e.g. don't relegate 13th if no new promote, or promote next eligible",
      }
    );
    const { state: next } = rolloverSeason(end);
    const sl = Object.values(next.clubs).filter((c) => c.competitionId === "super-league").length;
    const ch = Object.values(next.clubs).filter((c) => c.competitionId === "championship").length;
    assert(sl === 14 && ch === 14, `divisions survive corrupt MPG ${sl}/${ch}`, {
      severity: "P0",
      area: "rollover",
      message: `rollover produced ${sl}/${ch} after MPG/auto-promote collision`,
      file: "src/lib/manager/rollover.ts:699",
      reproduction: "rolloverSeason with MPG winner === championship champions",
      rootCauseHypothesis: "asymmetric promoted/relegated arrays",
      suggestedFix: "Assert and repair 14/14 after applying promo/releg",
    });
  }

  // ── Invariants after release ───────────────────────────────
  {
    const fringe = Object.values(s.players).find(
      (p) => p.clubId === uid && p.squadTier === "academy"
    );
    if (fringe) {
      const rel = releasePlayerContract(s, fringe.id);
      assert(rel.success && rel.state.players[fringe.id].clubId === null, "release → FA", {
        severity: "P1",
        area: "contracts",
        message: `release failed: ${rel.error}`,
        file: "src/lib/manager/contracts.ts:535",
        reproduction: "releasePlayerContract academy",
        rootCauseHypothesis: "release blocked",
        suggestedFix: "Allow releasing academy",
      });
      if (rel.success) {
        const v = validateSquadInvariants(rel.state);
        assert(v.valid, "invariants after release", {
          severity: "P1",
          area: "squad",
          message: v.errors.slice(0, 3).join("; "),
          file: "src/lib/manager/squad.ts:416",
          reproduction: "validateSquadInvariants after release",
          rootCauseHypothesis: "FA still has contract/tier or leftover lineup id",
          suggestedFix: "Clear contract/tier; scrub lineups on release",
        });
      }
    }
  }

  console.log("\n=== OK (" + ok.length + ") ===");
  ok.forEach((m) => console.log("✓", m));
  console.log("\n=== BUGS (" + bugs.length + ") ===");
  if (!bugs.length) console.log("(none)");
  for (const b of bugs) {
    console.log(`✗ [${b.severity}] (${b.area}) ${b.message}` + (b.file ? ` @ ${b.file}` : ""));
    console.log(`    repro: ${b.reproduction}`);
    console.log(`    cause: ${b.rootCauseHypothesis}`);
    console.log(`    fix:   ${b.suggestedFix}`);
  }
  console.log("\nSUMMARY", {
    ok: ok.length,
    bugs: bugs.length,
    p0: bugs.filter((b) => b.severity === "P0").length,
    p1: bugs.filter((b) => b.severity === "P1").length,
    p2: bugs.filter((b) => b.severity === "P2").length,
  });
  if (bugs.length) process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
