"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ActionButton } from "@/components/ui/ActionButton";
import { playUiClick } from "@/lib/sound";

interface ShareResultButtonProps {
  /** The spoiler-free text from buildShareResultText. */
  text: string;
  /** Secondary share control (e.g. the image card), shown small under the main button. */
  secondary?: ReactNode;
  className?: string;
  /** Button text (default "Share result" with the 🟩🟥 mark). */
  label?: ReactNode;
  ariaLabel?: string;
  variant?: "theme" | "secondary";
  /** Runs before sharing (e.g. to save the name used in a challenge link). */
  onBeforeShare?: () => void;
  disabled?: boolean;
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the textarea fallback.
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/** Wordle-style "Share result": the native share sheet when there is one, else copy + toast. */
export function ShareResultButton({
  text,
  secondary,
  className = "",
  label,
  ariaLabel = "Share result (spoiler-free)",
  variant = "theme",
  onBeforeShare,
  disabled = false,
}: ShareResultButtonProps) {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    []
  );

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const handleShare = useCallback(async () => {
    playUiClick();
    onBeforeShare?.();
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
        return;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        // Share sheet unavailable (e.g. desktop permission) — copy instead.
      }
    }
    const ok = await copyText(text);
    showToast(ok ? "Copied — paste it anywhere" : "Couldn't copy");
  }, [text, showToast, onBeforeShare]);

  return (
    <div className={`flex w-full flex-col items-stretch gap-1.5 ${className}`}>
      <ActionButton
        variant={variant}
        onClick={() => void handleShare()}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        {label ?? (
          <>
            <span aria-hidden className="mr-1.5 tracking-[-0.15em]">🟩🟥</span>
            Share result
          </>
        )}
      </ActionButton>
      {secondary ? <div className="flex justify-center">{secondary}</div> : null}
      <AnimatePresence>
        {toast ? (
          <motion.div
            key="share-toast"
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="pointer-events-none fixed inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-50 flex justify-center px-4"
          >
            <span className="rounded-control border border-white/10 bg-pitch-950/95 px-4 py-2 text-sm font-semibold text-white shadow-lg">
              {toast}
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
