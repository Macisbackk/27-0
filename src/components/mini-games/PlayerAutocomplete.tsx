"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FILTER } from "@/lib/ui/design-system";
import { suggestPlayers, type GuessablePlayer } from "@/lib/mini-games/players";

export function PlayerAutocomplete<T extends GuessablePlayer>({
  value,
  onChange,
  onPick,
  pool,
  disabled,
  placeholder,
  autoFocus,
  label = "Player name",
}: {
  value: string;
  onChange: (value: string) => void;
  onPick: (player: T) => void;
  pool: readonly T[];
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  label?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const suggestions = suggestPlayers(value, pool);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <label>
        <span className="sr-only">{label}</span>
        <input
          value={value}
          disabled={disabled}
          autoFocus={autoFocus}
          placeholder={placeholder ?? "Type a player name"}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open && suggestions.length > 0}
          aria-controls={listId}
          className={`${FILTER.input} w-full text-center`}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
      </label>
      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto border border-white/10 bg-pitch-900"
        >
          {suggestions.map((player) => (
            <li key={player.id}>
              <button
                type="button"
                role="option"
                className="flex min-h-[44px] w-full items-center px-3 text-left text-sm text-white hover:bg-white/5"
                onClick={() => {
                  onPick(player);
                  setOpen(false);
                }}
              >
                {player.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
