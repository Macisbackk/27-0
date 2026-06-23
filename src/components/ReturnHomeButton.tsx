"use client";

import { useRouter } from "next/navigation";
import { BTN } from "@/lib/ui/design-system";
import { playUiClick } from "@/lib/sound";

interface ReturnHomeButtonProps {
  onBeforeNavigate?: () => void;
  className?: string;
}

export function ReturnHomeButton({
  onBeforeNavigate,
  className = "",
}: ReturnHomeButtonProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        playUiClick();
        onBeforeNavigate?.();
        router.push("/");
      }}
      className={`${BTN.base} ${BTN.secondary} w-full ${className}`}
    >
      Return Home
    </button>
  );
}
