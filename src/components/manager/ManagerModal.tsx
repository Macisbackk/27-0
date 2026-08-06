"use client";

import type { ReactNode, RefObject } from "react";
import { GameModal } from "@/components/ui/GameModal";

interface ManagerModalProps {
  open: boolean;
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
  labelledBy?: string;
  wide?: boolean;
  className?: string;
  zClass?: string;
  panelRef?: RefObject<HTMLDivElement | null>;
}

/**
 * Shared Manager Mode modal shell — sticky header/footer, scrolling body,
 * padding from design-system tokens.
 */
export function ManagerModal({
  open,
  children,
  header,
  footer,
  onClose,
  labelledBy,
  wide = false,
  className = "",
  zClass,
  panelRef,
}: ManagerModalProps) {
  return (
    <GameModal
      open={open}
      onClose={onClose}
      labelledBy={labelledBy}
      wide={wide}
      zClass={zClass}
      panelRef={panelRef}
      className={`manager-modal !flex !max-h-[min(78dvh,720px)] !flex-col !overflow-hidden !p-0 ${className}`.trim()}
    >
      {header != null && (
        <div className="manager-modal__header shrink-0">{header}</div>
      )}
      <div
        data-scroll-lock-allow="true"
        className="manager-modal__body min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {children}
      </div>
      {footer != null && (
        <div className="manager-modal__footer shrink-0">{footer}</div>
      )}
    </GameModal>
  );
}
