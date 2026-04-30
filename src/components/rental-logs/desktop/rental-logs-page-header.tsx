"use client";

import { Download, KeyRound } from "lucide-react";

import { AddEntityButton } from "@/components/ui/add-entity-actions";
import { Button } from "@/components/ui/button";

export function RentalLogsPageHeaderDesktop({
  onExport,
  onNewRental,
}: {
  onExport: () => void;
  onNewRental: () => void;
}) {
  return (
    <div className="hidden flex-col gap-4 lg:flex lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Kiralamalar</h1>
        <p className="mt-1 text-sm text-slate-500">
          Filo kiralama kayıtlarını yönetin; yeni kiralama için «Kiralama başlat» sekmesine geçin.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 gap-1.5 rounded-lg border-slate-200 bg-white text-xs text-slate-700 shadow-sm"
          onClick={() => void onExport()}
        >
          <Download className="h-4 w-4" />
          Excel dışa aktar
        </Button>
        <AddEntityButton icon={KeyRound} onClick={onNewRental}>
          Yeni kiralama
        </AddEntityButton>
      </div>
    </div>
  );
}
