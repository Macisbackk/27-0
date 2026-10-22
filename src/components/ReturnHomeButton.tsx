"use client";

import { useRouter } from "next/navigation";
import { playUiClick } from "@/lib/sound";
import { ActionButton } from "./ui/ActionButton";

interface ReturnHomeButtonProps {
  onBeforeNavigate?: () => void;
  className?: string;
  /** Primary (theme) when it is the only action; secondary beside Play again. */
  variant?: "theme" | "secondary";
}

export function ReturnHomeButton({
  onBeforeNavigate,
  className = "",
  variant = "theme",
}: ReturnHomeButtonProps) {
  const router = useRouter();

  return (
    <ActionButton
      variant={variant}
      className={className}
      onClick={() => {
        playUiClick();
        onBeforeNavigate?.();
        router.push("/");
      }}
    >
      Return home
    </ActionButton>
  );
}
