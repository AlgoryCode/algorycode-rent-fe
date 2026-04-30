"use client";

import type { RentalSession, Vehicle } from "@/lib/mock-fleet";
import type { RentalStatus } from "@/lib/rental-status";
import { rentalLogStatusPillClass, sessionStatus, vehicleCardCoverUrl } from "@/components/rental-logs/shared/rental-logs-helpers";

export function RentalLogsSessionCardsMobile({
  sessions,
  vehiclesById,
  onOpenSession,
}: {
  sessions: RentalSession[];
  vehiclesById: Map<string, Vehicle>;
  onOpenSession: (sessionId: string) => void;
}) {
  return (
    <div className="space-y-3 p-0 lg:hidden">
      {sessions.map((s) => {
        const v = vehiclesById.get(s.vehicleId);
        const cover = v ? vehicleCardCoverUrl(v) : undefined;
        const st = sessionStatus(s);
        return (
          <button
            key={`mobile-${s.id}`}
            type="button"
            className="w-full rounded-xl border border-slate-100 bg-white p-4 text-left shadow-[0_4px_6px_-1px_rgba(15,23,42,0.05)]"
            onClick={() => onOpenSession(s.id)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-50">
                  {cover ? (
                    <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(cover)})` }} />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[9px] text-muted-foreground">—</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-slate-900">{v ? `${v.brand} ${v.model}` : "Araç"}</p>
                  <p className="truncate text-xs text-slate-500">{s.customer.fullName}</p>
                </div>
              </div>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${rentalLogStatusPillClass(st)}`}>
                {mobileStatusLabel(st)}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
              <div className="text-slate-500">
                <span>
                  {s.startDate} - {s.endDate}
                </span>
              </div>
              <span className="font-semibold text-primary">Details</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function mobileStatusLabel(st: RentalStatus): string {
  if (st === "active") return "Rented";
  if (st === "pending") return "Pending";
  if (st === "completed") return "Completed";
  return "Cancelled";
}
