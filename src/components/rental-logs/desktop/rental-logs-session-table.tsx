"use client";

import { EllipsisVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  rentalDayCount,
  rentalLogStatusPillClass,
  sessionEstimatedTotal,
  sessionStatus,
  vehicleCardCoverUrl,
} from "@/components/rental-logs/shared/rental-logs-helpers";
import type { RentalSession, Vehicle } from "@/lib/mock-fleet";
import { vehiclePlate } from "@/lib/rental-metadata";
import { RENTAL_STATUS_LABEL } from "@/lib/rental-status";

export function RentalLogsSessionTableDesktop({
  sessions,
  vehiclesById,
  onOpenSession,
}: {
  sessions: RentalSession[];
  vehiclesById: Map<string, Vehicle>;
  onOpenSession: (sessionId: string) => void;
}) {
  return (
    <div className="hidden lg:block">
      <Table className="min-w-[860px]">
        <TableHeader>
          <TableRow className="bg-slate-50 hover:bg-slate-50">
            <TableHead className="w-[220px] text-[11px] uppercase tracking-wide text-slate-500">Araç</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wide text-slate-500">Müşteri</TableHead>
            <TableHead className="whitespace-nowrap text-[11px] uppercase tracking-wide text-slate-500">Kiralama tarihleri</TableHead>
            <TableHead className="text-right whitespace-nowrap text-[11px] uppercase tracking-wide text-slate-500">Toplam tutar</TableHead>
            <TableHead className="w-[120px] text-[11px] uppercase tracking-wide text-slate-500">Statü</TableHead>
            <TableHead className="w-[88px] text-center text-[11px] uppercase tracking-wide text-slate-500">İşlemler</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((s) => {
            const v = vehiclesById.get(s.vehicleId);
            const cover = v ? vehicleCardCoverUrl(v) : undefined;
            const st = sessionStatus(s);
            return (
              <TableRow key={s.id} className="cursor-pointer hover:bg-primary/5" onClick={() => onOpenSession(s.id)}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="relative h-11 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                      {cover ? (
                        <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(cover)})` }} />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[9px] text-muted-foreground">—</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{v ? `${v.brand} ${v.model}` : "Araç"}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {vehiclePlate(vehiclesById, s.vehicleId)}
                        {v?.fuelType ? ` · ${v.fuelType}` : ""}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <p className="text-sm font-medium text-foreground">{s.customer.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Bireysel • {s.customer.nationalId || s.customer.email || s.customer.phone || "—"}
                  </p>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  <div className="text-sm text-slate-900">
                    {s.startDate} - {s.endDate}
                  </div>
                  <div className="text-[11px] text-slate-500">{rentalDayCount(s.startDate, s.endDate)} Gün Toplam</div>
                </TableCell>
                <TableCell className="text-right text-sm font-medium tabular-nums text-foreground">
                  <div className="text-base font-bold">{sessionEstimatedTotal(s, v)}</div>
                  <div className="text-[11px] text-slate-500">{sessionStatus(s) === "completed" ? "Tamamlandı" : "KDV Dahil"}</div>
                </TableCell>
                <TableCell>
                  <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold ${rentalLogStatusPillClass(st)}`}>
                    {RENTAL_STATUS_LABEL[st]}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary">
                    <EllipsisVertical className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
