"use client";

import type { Dispatch, SetStateAction } from "react";
import { CalendarDays, CarFront, SlidersHorizontal, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RentalLogFilterValues } from "@/lib/rental-log-filters";
import { RENTAL_STATUS_LABEL, type RentalStatus } from "@/lib/rental-status";

export function RentalLogsFilterPanelDesktop({
  draftFilters,
  setDraftFilters,
  onApply,
  statusLine,
}: {
  draftFilters: RentalLogFilterValues;
  setDraftFilters: Dispatch<SetStateAction<RentalLogFilterValues>>;
  onApply: () => void;
  statusLine: string;
}) {
  return (
    <div className="hidden lg:block">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_1.2fr_1.1fr_0.8fr_auto]">
          <div>
            <p className="mb-1 ml-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Müşteri Ara</p>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={draftFilters.customerQuery}
                onChange={(e) => setDraftFilters((f) => ({ ...f, customerQuery: e.target.value }))}
                placeholder="Müşteri adı veya ID"
                className="h-10 rounded-lg border-slate-300 pl-10 text-sm"
              />
            </div>
          </div>
          <div>
            <p className="mb-1 ml-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Tarih Aralığı</p>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={
                  draftFilters.rangeStart && draftFilters.rangeEnd ? `${draftFilters.rangeStart} - ${draftFilters.rangeEnd}` : ""
                }
                onChange={(e) => {
                  const value = e.target.value;
                  const parts = value.split("-").map((p) => p.trim());
                  if (parts.length === 2) {
                    setDraftFilters((f) => ({ ...f, rangeStart: parts[0], rangeEnd: parts[1] }));
                  } else {
                    setDraftFilters((f) => ({ ...f, rangeStart: "", rangeEnd: "" }));
                  }
                }}
                placeholder="Giriş - Çıkış Tarihi"
                className="h-10 rounded-lg border-slate-300 pl-10 text-sm"
              />
            </div>
          </div>
          <div>
            <p className="mb-1 ml-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Plaka Ara</p>
            <div className="relative">
              <CarFront className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={draftFilters.vehicleQuery ?? ""}
                onChange={(e) => setDraftFilters((f) => ({ ...f, vehicleQuery: e.target.value }))}
                placeholder="34 ABC 123"
                className="h-10 rounded-lg border-slate-300 pl-10 text-sm font-mono"
              />
            </div>
          </div>
          <div>
            <p className="mb-1 ml-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Statü</p>
            <select
              value={draftFilters.status}
              onChange={(e) => setDraftFilters((f) => ({ ...f, status: e.target.value as RentalStatus | "all" }))}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-primary"
            >
              <option value="all">Tümü</option>
              {(Object.keys(RENTAL_STATUS_LABEL) as RentalStatus[]).map((k) => (
                <option key={k} value={k}>
                  {RENTAL_STATUS_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-slate-500 hover:text-primary"
              onClick={onApply}
            >
              <SlidersHorizontal className="h-5 w-5" />
            </Button>
          </div>
        </div>
        {statusLine ? <p className="mt-3 text-xs text-slate-500">{statusLine}</p> : null}
      </div>
    </div>
  );
}
