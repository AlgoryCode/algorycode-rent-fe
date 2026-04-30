"use client";

import { KeyRound, MailCheck, ScrollText } from "lucide-react";

import { cn } from "@/lib/utils";

type LogTabNav = "logs" | "start" | "requests" | "menu";

export function RentalLogsHubMenuMobile({
  logTab,
  onNavigate,
}: {
  logTab: LogTabNav;
  onNavigate: (tab: LogTabNav) => void;
}) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 lg:hidden">
      <button
        type="button"
        className={cn(
          "aspect-square rounded-xl border border-border bg-card p-3 text-left transition-colors active:scale-[0.99]",
          logTab === "logs" ? "border-primary/35 bg-tertiary/60" : "hover:bg-tertiary/30",
        )}
        onClick={() => onNavigate("logs")}
      >
        <div className="flex h-full flex-col items-center justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <ScrollText className="h-7 w-7" />
          </div>
          <p className="text-center text-sm font-semibold text-foreground">Kiralamaları Görüntüle</p>
        </div>
      </button>
      <button
        type="button"
        className={cn(
          "aspect-square rounded-xl border border-border bg-card p-3 text-left transition-colors active:scale-[0.99]",
          logTab === "requests" ? "border-primary/35 bg-tertiary/60" : "hover:bg-tertiary/30",
        )}
        onClick={() => onNavigate("requests")}
      >
        <div className="flex h-full flex-col items-center justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/25 text-secondary-foreground">
            <MailCheck className="h-7 w-7" />
          </div>
          <p className="text-center text-sm font-semibold text-foreground">Kiralama İstekleri</p>
        </div>
      </button>
      <button
        type="button"
        className={cn(
          "col-span-2 rounded-xl border border-border bg-card p-4 text-left transition-colors active:scale-[0.99]",
          logTab === "start" ? "border-primary/35 bg-tertiary/60" : "hover:bg-tertiary/30",
        )}
        onClick={() => onNavigate("start")}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-tertiary text-tertiary-foreground">
            <KeyRound className="h-7 w-7" />
          </div>
          <p className="text-sm font-semibold text-foreground">Kiralama Başlat</p>
        </div>
      </button>
    </div>
  );
}
