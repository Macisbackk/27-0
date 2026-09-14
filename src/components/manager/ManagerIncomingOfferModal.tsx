"use client";

import React, { useEffect, useState } from "react";
import { useManager } from "@/lib/manager/context";
import {
  formatPositionLabel,
  formatPositionShort,
  formatSquadTier,
} from "@/lib/manager";
import { useScrollLock } from "@/hooks/useScrollLock";

export function ManagerIncomingOfferModal() {
  const {
    state,
    offerPopup,
    deferOfferPopup,
    decideOnIncomingBid,
    decideOnLoanOffer,
    rejectPendingLoanOffer,
  } = useManager();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = Boolean(state && offerPopup);
  useScrollLock(open, "manager-incoming-offer");

  // Modal stays mounted across consecutive offers; reset action lock when the offer changes
  // (successful Accept left busy=true and greying out the next offer's buttons).
  const popupKey = offerPopup
    ? offerPopup.kind === "transfer_bid"
      ? `bid:${offerPopup.bidId}`
      : `loan:${offerPopup.offerId}`
    : null;
  useEffect(() => {
    setBusy(false);
    setError(null);
  }, [popupKey]);

  // Drop stale popup entries after accept/reject/expire without setState-in-render
  useEffect(() => {
    if (!state || !offerPopup) return;
    if (offerPopup.kind === "transfer_bid") {
      const bid = state.transfers.activeBids.find((b) => b.id === offerPopup.bidId);
      if (!bid || bid.status !== "pending_club") {
        deferOfferPopup();
      }
      return;
    }
    const offer = (state.transfers.pendingLoanOffers || []).find(
      (o) => o.id === offerPopup.offerId
    );
    if (!offer || !state.players[offer.playerId]) {
      deferOfferPopup();
    }
  }, [state, offerPopup, deferOfferPopup]);

  if (!state || !offerPopup) return null;

  const userClubId = state.manager.clubId;

  let title = "Incoming Offer";
  let eyebrow = "Market";
  let subtitle = "";
  let player = null as (typeof state.players)[string] | null;
  let clubLabel = "";
  let detailRows: { label: string; value: string }[] = [];

  if (offerPopup.kind === "transfer_bid") {
    const bid = state.transfers.activeBids.find((b) => b.id === offerPopup.bidId);
    if (!bid || bid.status !== "pending_club") return null;
    player = state.players[bid.playerId] || null;
    if (!player) return null;
    const buyer = state.clubs[bid.fromClubId];
    eyebrow = "Transfer Bid";
    title = "Club Bid Received";
    subtitle = `${buyer?.name || "A club"} want to buy this player.`;
    clubLabel = buyer?.name || "Unknown club";
    detailRows = [
      { label: "Fee offered", value: `£${bid.offeredFee.toLocaleString()}` },
      { label: "Wage offered", value: `£${bid.offeredWage.toLocaleString()}/wk` },
      {
        label: "Contract",
        value: `${bid.offeredContractYears} yr · ${bid.offeredRole.replace(/_/g, " ")}`,
      },
    ];
  } else {
    const offer = (state.transfers.pendingLoanOffers || []).find(
      (o) => o.id === offerPopup.offerId
    );
    if (!offer) return null;
    player = state.players[offer.playerId] || null;
    if (!player) return null;
    const otherClubId =
      offer.direction === "in" ? offer.parentClubId : offer.destinationClubId;
    const otherClub = state.clubs[otherClubId];
    eyebrow = offer.direction === "in" ? "Loan In" : "Loan Out";
    title = offer.direction === "in" ? "Loan Player Available" : "Loan Enquiry";
    subtitle =
      offer.direction === "in"
        ? `${otherClub?.name || "A club"} will loan this player to you.`
        : `${otherClub?.name || "A club"} want this player on loan.`;
    clubLabel = otherClub?.name || "Unknown club";
    detailRows = [
      { label: "Duration", value: `${offer.totalWeeks} weeks` },
      {
        label: "Wage share",
        value: `${offer.wageContributionPct}% covered by destination`,
      },
      { label: "Recall", value: offer.canRecall ? "Allowed" : "No recall" },
    ];
  }

  const wage = player.contract?.wageWeekly;
  const remaining =
    state.transfers.activeBids.filter(
      (b) => b.toClubId === userClubId && b.status === "pending_club"
    ).length + (state.transfers.pendingLoanOffers || []).length;

  const handleAccept = () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    if (offerPopup.kind === "transfer_bid") {
      const res = decideOnIncomingBid(offerPopup.bidId, "accept");
      if (!res.success) {
        setError(res.error || "Could not accept bid.");
        setBusy(false);
        return;
      }
      // Keep Accept disabled after a successful accept
      return;
    } else {
      const offer = (state.transfers.pendingLoanOffers || []).find(
        (o) => o.id === offerPopup.offerId
      );
      if (!offer) {
        setBusy(false);
        deferOfferPopup();
        return;
      }
      const res = decideOnLoanOffer({
        playerId: offer.playerId,
        parentClubId: offer.parentClubId,
        destinationClubId: offer.destinationClubId,
        totalWeeks: offer.totalWeeks,
        wageContributionPct: offer.wageContributionPct,
        canRecall: offer.canRecall,
        offerId: offer.id,
      });
      if (!res.success) {
        setError(res.error || "Could not confirm loan.");
        setBusy(false);
        return;
      }
      return;
    }
  };

  const handleReject = () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    if (offerPopup.kind === "transfer_bid") {
      const res = decideOnIncomingBid(offerPopup.bidId, "reject");
      if (!res.success) {
        setError(res.error || "Could not reject bid.");
        setBusy(false);
        return;
      }
    } else {
      rejectPendingLoanOffer(offerPopup.offerId);
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-3 sm:p-5">
      <div className="w-full max-w-md max-h-[min(90dvh,100%)] overflow-y-auto rounded-3xl border border-emerald-500/35 bg-pitch-950 p-5 sm:p-6 shadow-2xl space-y-4">
        <div className="text-center space-y-1">
          <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[10px] font-black text-emerald-400 border border-emerald-500/30 uppercase tracking-widest inline-block">
            {eyebrow}
          </span>
          <h2 className="text-xl font-black text-white">{title}</h2>
          <p className="text-xs text-pitch-400">{subtitle}</p>
          {remaining > 1 && (
            <p className="text-[10px] font-bold text-pitch-500 uppercase tracking-wider">
              {remaining} offers waiting
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-pitch-700 bg-pitch-900/90 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded bg-pitch-800 px-1.5 py-0.5 text-[10px] font-bold text-pitch-300">
                  {formatPositionShort(player.position)}
                </span>
                <h3 className="text-base font-black text-white truncate">{player.name}</h3>
              </div>
              <p className="text-[11px] text-pitch-400 mt-1">
                {formatPositionLabel(player.position)}
                {player.squadTier ? ` · ${formatSquadTier(player.squadTier)}` : ""}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-2xl font-black text-emerald-400 leading-none">
                {player.rating}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-pitch-500 mt-0.5">
                OVR
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-pitch-950/80 border border-pitch-800 px-2 py-2">
              <div className="text-sm font-black text-white">{player.age}</div>
              <div className="text-[9px] font-bold uppercase text-pitch-500">Age</div>
            </div>
            <div className="rounded-xl bg-pitch-950/80 border border-pitch-800 px-2 py-2">
              <div className="text-sm font-black text-white">{player.potential}</div>
              <div className="text-[9px] font-bold uppercase text-pitch-500">Pot</div>
            </div>
            <div className="rounded-xl bg-pitch-950/80 border border-pitch-800 px-2 py-2">
              <div className="text-sm font-black text-white">
                {wage != null ? `£${wage.toLocaleString()}` : "—"}
              </div>
              <div className="text-[9px] font-bold uppercase text-pitch-500">Wage/wk</div>
            </div>
          </div>

          <p className="text-[11px] text-pitch-400">
            From <span className="font-bold text-pitch-200">{clubLabel}</span>
            {player.nationality ? ` · ${player.nationality}` : ""}
            {player.form != null ? ` · Form ${player.form}` : ""}
          </p>
        </div>

        <div className="rounded-xl border border-pitch-800 bg-pitch-900/60 divide-y divide-pitch-800">
          {detailRows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between px-3 py-2 text-xs"
            >
              <span className="text-pitch-400 font-semibold">{row.label}</span>
              <span className="text-white font-bold capitalize">{row.value}</span>
            </div>
          ))}
        </div>

        {error && (
          <p className="text-xs font-semibold text-rose-400 text-center">{error}</p>
        )}

        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={handleAccept}
            className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 py-3 text-sm font-black text-slate-950 shadow-lg hover:brightness-110 active:scale-98 transition-all disabled:opacity-60"
          >
            {offerPopup.kind === "transfer_bid" ? "Accept Bid" : "Accept Loan"}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleReject}
              className="rounded-2xl border border-rose-500/40 bg-rose-500/10 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-500/20 transition-all disabled:opacity-60"
            >
              Reject
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => deferOfferPopup()}
              className="rounded-2xl border border-pitch-700 bg-pitch-900 py-2.5 text-xs font-bold text-pitch-200 hover:bg-pitch-800 transition-all disabled:opacity-60"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
