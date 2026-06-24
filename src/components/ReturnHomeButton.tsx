"use client";

import { useRouter } from "next/navigation";
import { playUiClick } from "@/lib/sound";
import { ActionButton } from "./ui/ActionButton";

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
    <ActionButton
      variant="secondary"
      className={className}
      onClick={() => {
        playUiClick();
        onBeforeNavigate?.();
        router.push("/");
      }}
    >
      Return Home
    </ActionButton>
  );
}
