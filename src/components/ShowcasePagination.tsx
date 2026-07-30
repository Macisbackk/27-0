"use client";

import { GameButton } from "@/components/ui/GameButton";
import { GamePanel } from "@/components/ui/GamePanel";
import { playUiClick } from "@/lib/sound";

export const SHOWCASE_PAGE_SIZE = 50;
export const SHOWCASE_PAGE_SIZE_MOBILE = 25;

export function getShowcasePageSize(): number {
  if (typeof window === "undefined") return SHOWCASE_PAGE_SIZE;
  return window.matchMedia("(max-width: 639px)").matches
    ? SHOWCASE_PAGE_SIZE_MOBILE
    : SHOWCASE_PAGE_SIZE;
}

interface ShowcasePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}

export function ShowcasePagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize = SHOWCASE_PAGE_SIZE,
  onPageChange,
}: ShowcasePaginationProps) {
  if (totalItems === 0) return null;

  const isFirst = currentPage <= 1;
  const isLast = currentPage >= totalPages;
  const rangeStart = (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, totalItems);

  const goTo = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    playUiClick();
    onPageChange(page);
  };

  return (
    <GamePanel as="nav" variant="elevated" flush aria-label="Player showcase pagination">
      <div className="flex min-w-0 flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3">
        <p className="min-w-0 text-center text-xs text-gray-500 sm:text-left sm:text-sm">
          Showing{" "}
          <span className="font-medium text-gray-300">
            {rangeStart}–{rangeEnd}
          </span>{" "}
          of{" "}
          <span className="font-medium text-gray-300">{totalItems}</span>
        </p>

        <div className="flex min-w-0 items-center justify-center gap-2 sm:gap-3">
          <GameButton
            variant="secondary"
            size="sm"
            fullWidth={false}
            disabled={isFirst}
            onClick={() => goTo(currentPage - 1)}
            className="shrink-0 px-3 text-xs sm:px-4 sm:text-sm"
          >
            Previous
          </GameButton>

          <span className="shrink-0 whitespace-nowrap text-xs font-medium text-white sm:text-sm">
            Page {currentPage} of {totalPages}
          </span>

          <GameButton
            variant="secondary"
            size="sm"
            fullWidth={false}
            disabled={isLast}
            onClick={() => goTo(currentPage + 1)}
            className="shrink-0 px-3 text-xs sm:px-4 sm:text-sm"
          >
            Next
          </GameButton>
        </div>
      </div>
    </GamePanel>
  );
}
