"use client";

import type { Vehicle } from "@/lib/mock-fleet";
import { cn } from "@/lib/utils";

import { formatVehicleDailyRental, vehicleCardCoverUrl } from "@/components/rental-logs/shared/rental-logs-helpers";

export function RentalStartVehicleGalleryResponsive({
  vehicles,
  allVehiclesEmpty,
  onSelectVehicle,
}: {
  vehicles: Vehicle[];
  allVehiclesEmpty: boolean;
  onSelectVehicle: (vehicleId: string) => void;
}) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2 lg:gap-3 lg:grid-cols-3">
      {vehicles.length === 0 ? (
        <p className="col-span-full py-6 text-center text-xs text-muted-foreground">
          {allVehiclesEmpty
            ? "Kayıtlı araç yok."
            : "Aramanızla eşleşen araç yok. Plakayı boşluksuz veya marka + model şeklinde deneyin."}
        </p>
      ) : null}
      {vehicles.map((v) => {
        const disabled = Boolean(v.maintenance);
        const cover = vehicleCardCoverUrl(v);
        const dailyLabel = formatVehicleDailyRental(v);
        const onActivate = () => {
          if (disabled) return;
          onSelectVehicle(v.id);
        };

        return (
          <button
            key={v.id}
            type="button"
            disabled={disabled}
            title={disabled ? "Bakımda" : `${v.plate} — kiralama başlat`}
            onClick={onActivate}
            className={cn(
              "group flex w-full flex-col overflow-hidden rounded-xl border bg-card p-0 text-left shadow-sm outline-none transition-[box-shadow,transform,border-color] focus-visible:ring-2 focus-visible:ring-ring",
              disabled && "cursor-not-allowed opacity-55",
              !disabled && "border-border/55 hover:border-secondary/35 hover:shadow-md active:scale-[0.99]",
            )}
          >
            <div className="relative aspect-[5/3] w-full shrink-0 overflow-hidden bg-muted">
              {cover ? (
                <div
                  className="h-full w-full bg-cover bg-center transition-transform duration-300 group-hover:scale-105 group-disabled:grayscale"
                  style={{ backgroundImage: `url(${JSON.stringify(cover)})` }}
                  aria-hidden
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">Görsel yok</div>
              )}
            </div>
            <div
              className={cn(
                "flex items-center justify-between gap-1.5 border-t px-1.5 py-1.5 sm:gap-2 sm:px-2",
                "border-border/60 bg-card",
                disabled && "border-border/50 bg-muted/40",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[11px] font-semibold tracking-tight text-foreground sm:text-xs">{v.plate}</p>
                <p className="truncate text-[9px] leading-tight text-muted-foreground sm:text-[10px]">
                  {v.brand} {v.model}
                </p>
                {disabled ? <p className="mt-0.5 text-[8px] font-medium text-destructive sm:text-[9px]">Bakımda</p> : null}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[8px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[9px]">Günlük</p>
                <p
                  className={cn(
                    "text-[10px] font-semibold tabular-nums leading-tight text-foreground sm:text-xs",
                    dailyLabel === "—" && "text-muted-foreground",
                  )}
                >
                  {dailyLabel}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
