"use client";

import React, { useState } from "react";
import { useManager } from "@/lib/manager/context";
import { useCompactViewport } from "@/lib/ui/viewport";
import type { InboxMessage } from "@/lib/manager/types";

export function ManagerInboxView() {
  const {
    state,
    markMessageRead,
    markAllMessagesRead,
    setActiveTab,
    decideOnIncomingBid,
  } = useManager();
  const compact = useCompactViewport();
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [mobileReading, setMobileReading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  if (!state) return null;

  const messages = state.inbox.messages;
  const unreadCount = state.inbox.unreadCount;
  const selectedMessage =
    messages.find((m) => m.id === selectedMessageId) ||
    (!compact ? messages[0] : null) ||
    null;

  const handleSelect = (msg: InboxMessage) => {
    setSelectedMessageId(msg.id);
    setActionMsg(null);
    if (!msg.isRead) {
      markMessageRead(msg.id);
    }
    if (compact) setMobileReading(true);
  };

  const pendingIncomingBids = state.transfers.activeBids.filter(
    (b) => b.toClubId === state.manager.clubId && b.status === "pending_club"
  );

  const resolveIncomingBidId = (
    msg: InboxMessage,
    payload?: { bidId?: string; playerId?: string }
  ): string | null => {
    if (payload?.bidId && pendingIncomingBids.some((b) => b.id === payload.bidId)) {
      return payload.bidId;
    }
    if (msg.relatedEntityId && pendingIncomingBids.some((b) => b.id === msg.relatedEntityId)) {
      return msg.relatedEntityId;
    }
    const byName = pendingIncomingBids.find((b) => {
      const pname = state.players[b.playerId]?.name;
      return pname && msg.subject.includes(pname);
    });
    return byName?.id || null;
  };

  const runInboxAction = (
    actionType: "accept_bid" | "reject_bid" | "renew_contract" | "recall_loan" | "dismiss",
    msg: InboxMessage,
    payload?: { bidId?: string; playerId?: string }
  ) => {
    if (actionType === "accept_bid" || actionType === "reject_bid") {
      const id = resolveIncomingBidId(msg, payload);
      if (!id) {
        setActionMsg("No matching pending bid for this message — open Transfers.");
        setActiveTab("transfers");
        return;
      }
      const res = decideOnIncomingBid(id, actionType === "accept_bid" ? "accept" : "reject");
      setActionMsg(
        res.success
          ? `Bid ${actionType === "accept_bid" ? "accepted" : "rejected"}.`
          : res.error || "Failed"
      );
      return;
    }
    if (actionType === "renew_contract") {
      setActiveTab("contracts");
      return;
    }
    if (actionType === "recall_loan") {
      setActiveTab("loans");
      return;
    }
    if (actionType === "dismiss") {
      markMessageRead(msg.id);
    }
  };

  const messageList = (
    <div className="rounded-2xl border border-pitch-800 bg-pitch-900/80 p-3 shadow-lg flex flex-col">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-pitch-800/80 px-1 shrink-0">
        <span className="text-xs font-bold text-pitch-300">Messages ({messages.length})</span>
        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={() => markAllMessagesRead()}
            className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300"
          >
            Seen All ({unreadCount})
          </button>
        ) : (
          <span className="text-[10px] text-pitch-500 font-medium">All Read</span>
        )}
      </div>

      <div className="divide-y divide-pitch-800/60 sm:max-h-[550px] sm:overflow-y-auto">
        {messages.length ? (
          messages.map((msg) => {
            const isSelected = selectedMessage?.id === msg.id;
            return (
              <button
                key={msg.id}
                type="button"
                onClick={() => handleSelect(msg)}
                className={`w-full text-left p-3 rounded-xl transition-all ${
                  isSelected
                    ? "bg-pitch-800/90 border border-emerald-500/40"
                    : "hover:bg-pitch-800/40"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-pitch-400">
                    {msg.sender}
                  </span>
                  <span className="text-[10px] text-pitch-500">{msg.dateStr}</span>
                </div>
                <div className="flex items-center gap-2">
                  {!msg.isRead && <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />}
                  <h4
                    className={`text-xs truncate ${
                      !msg.isRead ? "font-bold text-white" : "text-pitch-200"
                    }`}
                  >
                    {msg.subject}
                  </h4>
                </div>
                <p className="text-[11px] text-pitch-400 truncate mt-1">{msg.body}</p>
              </button>
            );
          })
        ) : (
          <p className="text-xs text-pitch-500 italic p-4 text-center">Your inbox is empty.</p>
        )}
      </div>
    </div>
  );

  const detailPane = selectedMessage ? (
    <div className="rounded-2xl border border-pitch-700 bg-pitch-900/95 p-4 sm:p-6 shadow-xl space-y-4">
      {compact && (
        <button
          type="button"
          onClick={() => setMobileReading(false)}
          className="text-xs font-bold text-emerald-400"
        >
          ← Back to inbox
        </button>
      )}
      <div className="border-b border-pitch-800 pb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="rounded bg-pitch-800 px-2 py-0.5 text-[10px] font-bold text-pitch-300 uppercase">
            {selectedMessage.category}
          </span>
          <span className="text-xs text-pitch-400">{selectedMessage.dateStr}</span>
        </div>
        <h3 className="text-lg sm:text-xl font-bold text-white mt-2">{selectedMessage.subject}</h3>
        <span className="text-xs text-emerald-400 font-semibold block mt-1">
          From: {selectedMessage.sender}
        </span>
      </div>
      <div className="text-sm text-pitch-200 leading-relaxed whitespace-pre-wrap">
        {selectedMessage.body}
      </div>
      {actionMsg && (
        <p className="text-xs font-semibold text-emerald-400">{actionMsg}</p>
      )}
      {(selectedMessage.actions?.length ||
        (selectedMessage.category === "transfer" &&
          resolveIncomingBidId(selectedMessage) !== null)) && (
        <div className="pt-4 border-t border-pitch-800 flex flex-wrap gap-2">
          {selectedMessage.actions?.length
            ? selectedMessage.actions.map((action) => (
                <button
                  key={action.actionType + action.label}
                  type="button"
                  onClick={() =>
                    runInboxAction(action.actionType, selectedMessage, action.payload)
                  }
                  className={`rounded-xl px-4 py-2 text-xs font-bold ${
                    action.actionType === "accept_bid"
                      ? "bg-emerald-600 text-white"
                      : action.actionType === "reject_bid"
                      ? "bg-rose-700 text-white"
                      : "bg-pitch-800 text-white border border-pitch-700"
                  }`}
                >
                  {action.label}
                </button>
              ))
            : (
                <>
                  <button
                    type="button"
                    onClick={() => runInboxAction("accept_bid", selectedMessage)}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white"
                  >
                    Accept Bid
                  </button>
                  <button
                    type="button"
                    onClick={() => runInboxAction("reject_bid", selectedMessage)}
                    className="rounded-xl bg-rose-700 px-4 py-2 text-xs font-bold text-white"
                  >
                    Reject Bid
                  </button>
                </>
              )}
          {selectedMessage.category === "transfer" && (
            <button
              type="button"
              onClick={() => setActiveTab("transfers")}
              className="rounded-xl bg-pitch-800 border border-pitch-700 px-4 py-2 text-xs font-bold text-white"
            >
              Go to Transfers →
            </button>
          )}
        </div>
      )}
      {selectedMessage.category === "transfer" &&
        !(selectedMessage.actions?.length || resolveIncomingBidId(selectedMessage)) && (
        <div className="pt-4 border-t border-pitch-800">
          <button
            type="button"
            onClick={() => setActiveTab("transfers")}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white"
          >
            Go to Transfers →
          </button>
        </div>
      )}
    </div>
  ) : (
    <div className="hidden lg:flex rounded-2xl border border-pitch-700 bg-pitch-900/95 p-6 shadow-xl items-center justify-center">
      <p className="text-xs text-pitch-500 italic">Select a message to view its details.</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-3 py-3 sm:py-6 sm:px-6 space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-2xl font-black text-white">Inbox</h2>
          <p className="hidden sm:block text-xs text-pitch-400">
            Board notes, transfer news, and injury bulletins.
          </p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => markAllMessagesRead()}
            disabled={unreadCount === 0}
            className={`rounded-xl px-3 py-2 text-xs font-bold ${
              unreadCount > 0
                ? "border border-pitch-700 bg-pitch-900 text-white"
                : "border border-pitch-800 text-pitch-500 opacity-60"
            }`}
          >
            Seen All
          </button>
        )}
      </div>

      {compact ? (
        mobileReading && selectedMessage ? detailPane : messageList
      ) : (
        <div className="grid gap-5 lg:grid-cols-12 items-start">
          <div className="lg:col-span-5">{messageList}</div>
          <div className="lg:col-span-7">{detailPane}</div>
        </div>
      )}
    </div>
  );
}
