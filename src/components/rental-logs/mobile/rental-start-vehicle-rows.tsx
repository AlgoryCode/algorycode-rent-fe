"use client";

import type { Vehicle } from "@/lib/mock-fleet";
import { cn } from "@/lib/utils";

import { formatVehicleDailyRental, vehicleCardCoverUrl } from "@/components/rental-logs/shared/rental-logs-helpers";

export function RentalStartVehicleRowsMobile({
  vehicles,
  onSelectVehicle,
}: {
  vehicles: Vehicle[];
  onSelectVehicle: (vehicleId: string) => void;
}) {
  return (
    <div className="mt-4 space-y-2 lg:hidden">
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
            key={`start-mobile-${v.id}`}
            type="button"
            disabled={disabled}
            onClick={onActivate}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left",
              disabled && "cursor-not-allowed opacity-55",
            )}
          >
            <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
              {cover ? (
                <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(cover)})` }} aria-hidden />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-0.5 text-center text-[9px] leading-tight text-muted-foreground">
                  —
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-sm font-semibold">{v.plate}</p>
              <p className="truncate text-xs text-slate-600">
                {v.brand} {v.model}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-slate-900">{dailyLabel}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
