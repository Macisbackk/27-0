"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getUsername, setUsername } from "@/lib/storage/user";
import { SidebarNav } from "./SidebarNav";

const HEADER_BTN =
  "header-control-btn flex h-9 min-w-[5.5rem] items-center justify-center gap-1.5 rounded-lg border border-pitch-600 px-3 text-xs font-medium text-gray-300 transition hover:border-accent-green hover:text-white";

export function Header() {
  const [username, setLocalUsername] = useState("Player");
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setLocalUsername(getUsername());
  }, []);

  const saveUsername = () => {
    if (input.trim().length >= 2) {
      setUsername(input.trim());
      setLocalUsername(getUsername());
    }
    setEditing(false);
    setInput("");
  };

  return (
    <>
      <header className="app-header sticky top-0 z-50 border-b backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-tight">
              <span className="text-gradient">27</span>
              <span className="text-white">-0</span>
            </span>
            <span className="hidden text-xs text-gray-500 sm:inline">
              Super League
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className={HEADER_BTN}
              aria-label="Open menu"
            >
              <span aria-hidden className="text-sm leading-none">
                ☰
              </span>
              <span className="hidden sm:inline">Menu</span>
            </button>

            {editing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveUsername()}
                  placeholder="Username"
                  maxLength={20}
                  autoFocus
                  className="h-9 w-28 rounded-lg border border-pitch-600 bg-pitch-800 px-2 text-sm outline-none focus:border-accent-green sm:w-36"
                />
                <button
                  onClick={saveUsername}
                  className="header-control-btn h-9 rounded-lg bg-accent-green px-3 text-xs font-semibold text-pitch-950"
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setInput(username);
                  setEditing(true);
                }}
                className={HEADER_BTN}
                title="Change username"
              >
                {username}
              </button>
            )}
          </div>
        </div>
      </header>

      <SidebarNav open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
