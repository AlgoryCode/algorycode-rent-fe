"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

import { PAGE_SIZE } from "@/components/rental-logs/shared/rental-logs-helpers";

export function RentalLogsSessionPaginationDesktop({
  totalFiltered,
  safePage,
  totalPages,
  onPrev,
  onNext,
}: {
  totalFiltered: number;
  safePage: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="hidden flex-col gap-3 border-t border-slate-100 bg-slate-50 px-4 py-3 lg:flex lg:flex-row lg:items-center lg:justify-between lg:px-5">
      <p className="text-xs text-slate-500">
        {totalFiltered === 0
          ? "—"
          : `Toplam ${totalFiltered} kayıttan ${(safePage - 1) * PAGE_SIZE + 1}-${Math.min(safePage * PAGE_SIZE, totalFiltered)} arası gösteriliyor`}
      </p>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 border-slate-200 bg-white p-0"
          disabled={safePage <= 1}
          onClick={onPrev}
          aria-label="Önceki sayfa"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="rounded-md bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">{safePage}</span>
        <span className="px-2 text-xs text-slate-500">/ {totalPages}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 border-slate-200 bg-white p-0"
          disabled={safePage >= totalPages}
          onClick={onNext}
          aria-label="Sonraki sayfa"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
