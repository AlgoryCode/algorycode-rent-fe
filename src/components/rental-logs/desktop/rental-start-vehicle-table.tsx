"use client";

import type { KeyboardEvent } from "react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatVehicleDailyRental, vehicleCardCoverUrl } from "@/components/rental-logs/shared/rental-logs-helpers";
import type { Vehicle } from "@/lib/mock-fleet";
import { cn } from "@/lib/utils";

export function RentalStartVehicleTableDesktop({
  vehicles,
  onSelectVehicle,
}: {
  vehicles: Vehicle[];
  onSelectVehicle: (vehicleId: string) => void;
}) {
  return (
    <div className="mt-4 hidden overflow-x-auto rounded-lg border lg:block">
      <Table className="min-w-[640px] text-xs">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-24">Önizleme</TableHead>
            <TableHead>Plaka</TableHead>
            <TableHead>Araç</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead className="text-right">Günlük</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vehicles.map((v) => {
            const disabled = Boolean(v.maintenance);
            const cover = vehicleCardCoverUrl(v);
            const dailyLabel = formatVehicleDailyRental(v);
            const onActivate = () => {
              if (disabled) return;
              onSelectVehicle(v.id);
            };
            const onKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
              if (disabled) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onActivate();
              }
            };
            return (
              <TableRow
                key={v.id}
                role="button"
                tabIndex={disabled ? -1 : 0}
                title={disabled ? "Bakımda" : `${v.plate} — kiralama başlat`}
                className={cn(!disabled && "cursor-pointer", disabled && "cursor-not-allowed opacity-55")}
                onClick={onActivate}
                onKeyDown={onKeyDown}
              >
                <TableCell>
                  <div className="relative h-12 w-16 overflow-hidden rounded-md bg-muted">
                    {cover ? (
                      <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(cover)})` }} aria-hidden />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center px-0.5 text-center text-[9px] leading-tight text-muted-foreground">
                        —
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm font-semibold">{v.plate}</TableCell>
                <TableCell className="text-muted-foreground">
                  {v.brand} {v.model}
                  {disabled ? (
                    <span className="mt-0.5 block text-[10px] font-medium text-destructive">Bakımda</span>
                  ) : null}
                </TableCell>
                <TableCell>{disabled ? "Bakım" : "Kiralanabilir"}</TableCell>
                <TableCell className={cn("text-right text-sm font-semibold tabular-nums", dailyLabel === "—" && "text-muted-foreground")}>
                  {dailyLabel}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
