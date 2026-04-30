"use client";

import { KeyRound, MailCheck, ScrollText } from "lucide-react";

export function RentalLogsHubMenuDesktop({
  onNavigateList,
  onNavigateStart,
  onNavigateRequests,
}: {
  onNavigateList: () => void;
  onNavigateStart: () => void;
  onNavigateRequests: () => void;
}) {
  return (
    <div className="hidden lg:block">
      <div className="grid grid-cols-3 gap-4">
        <button
          type="button"
          className="rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-colors hover:bg-tertiary/30"
          onClick={onNavigateList}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <ScrollText className="h-6 w-6" />
          </div>
          <p className="mt-4 text-base font-semibold text-foreground">Kiralamaları Görüntüle</p>
          <p className="mt-1 text-xs text-muted-foreground">Tüm kiralama kayıtlarını listele ve filtrele.</p>
        </button>
        <button
          type="button"
          className="rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-colors hover:bg-tertiary/30"
          onClick={onNavigateStart}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/25 text-secondary-foreground">
            <KeyRound className="h-6 w-6" />
          </div>
          <p className="mt-4 text-base font-semibold text-foreground">Kiralama Başlat</p>
          <p className="mt-1 text-xs text-muted-foreground">Araç seçip hızlıca yeni kiralama oluştur.</p>
        </button>
        <button
          type="button"
          className="rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-colors hover:bg-tertiary/30"
          onClick={onNavigateRequests}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-tertiary text-tertiary-foreground">
            <MailCheck className="h-6 w-6" />
          </div>
          <p className="mt-4 text-base font-semibold text-foreground">Kiralama İstekleri</p>
          <p className="mt-1 text-xs text-muted-foreground">Bekleyen/Onaylı talepleri görüntüle.</p>
        </button>
      </div>
    </div>
  );
}
