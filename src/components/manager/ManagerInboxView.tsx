"use client";

import React, { useState } from "react";
import { useManager } from "@/lib/manager/context";
import type { InboxMessage } from "@/lib/manager/types";

export function ManagerInboxView() {
  const { state, markMessageRead, setActiveTab } = useManager();
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  if (!state) return null;

  const messages = state.inbox.messages;
  const selectedMessage =
    messages.find((m) => m.id === selectedMessageId) || messages[0] || null;

  const handleSelect = (msg: InboxMessage) => {
    setSelectedMessageId(msg.id);
    if (!msg.isRead) {
      markMessageRead(msg.id);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6 space-y-4">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-white">Manager Inbox</h2>
        <p className="text-xs text-pitch-400">
          Official communications from the board, scouting reports, transfer bids, and injury bulletins.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-12 items-start">
        {/* Left: Messages List */}
        <div className="lg:col-span-5 rounded-2xl border border-pitch-800 bg-pitch-900/80 p-3 shadow-lg divide-y divide-pitch-800/60 max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-pitch-700">
          {messages.length ? (
            messages.map((msg) => {
              const isSelected = selectedMessage?.id === msg.id;

              return (
                <div
                  key={msg.id}
                  onClick={() => handleSelect(msg)}
                  className={`p-3 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? "bg-pitch-800/90 border border-emerald-500/40 shadow-sm"
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
                    {!msg.isRead && (
                      <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                    )}
                    <h4 className={`text-xs truncate ${!msg.isRead ? "font-bold text-white" : "text-pitch-200"}`}>
                      {msg.subject}
                    </h4>
                  </div>
                  <p className="text-[11px] text-pitch-400 truncate mt-1">{msg.body}</p>
                </div>
              );
            })
          ) : (
            <p className="text-xs text-pitch-500 italic p-4 text-center">Your inbox is empty.</p>
          )}
        </div>

        {/* Right: Message Detail Reading Pane */}
        <div className="lg:col-span-7 rounded-2xl border border-pitch-700 bg-pitch-900/95 p-6 shadow-xl">
          {selectedMessage ? (
            <div className="space-y-4">
              <div className="border-b border-pitch-800 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="rounded bg-pitch-800 px-2 py-0.5 text-[10px] font-bold text-pitch-300 uppercase">
                    {selectedMessage.category}
                  </span>
                  <span className="text-xs text-pitch-400">{selectedMessage.dateStr}</span>
                </div>
                <h3 className="text-xl font-bold text-white mt-2">{selectedMessage.subject}</h3>
                <span className="text-xs text-emerald-400 font-semibold block mt-1">
                  From: {selectedMessage.sender}
                </span>
              </div>

              <div className="text-sm text-pitch-200 leading-relaxed whitespace-pre-wrap">
                {selectedMessage.body}
              </div>

              {selectedMessage.category === "transfer" && (
                <div className="pt-4 border-t border-pitch-800 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("transfers")}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 shadow transition-all"
                  >
                    Go to Transfers Desk →
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-pitch-500 italic text-center py-12">
              Select a message to view its details.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
