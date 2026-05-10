"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { CarFront, ClipboardList, Truck, Wrench } from "lucide-react";

import { useFleetSessions } from "@/hooks/use-fleet-sessions";
import { useFleetVehicles } from "@/hooks/use-fleet-vehicles";
import { rentalCountsForCalendar } from "@/lib/rental-status";
import { cn } from "@/lib/utils";

function OccupancyRing({ pct, className }: { pct: number; className?: string }) {
  const size = 56;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const c = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={cn("shrink-0 -rotate-90", className)} aria-hidden>
      <circle cx={cx} cy={cy} r={r} fill="none" className="stroke-muted/45" strokeWidth={stroke} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        className="stroke-primary transition-[stroke-dasharray] duration-500 ease-out"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${c}`}
      />
    </svg>
  );
}

function MiniBar({ value }: { value: number }) {
  const v = Math.min(100, Math.max(0, value));
  return (
    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
      <div
        className="h-full rounded-full bg-primary/90 transition-[width] duration-500 ease-out dark:bg-primary"
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

export function FleetOverviewSection() {
  const { allSessions } = useFleetSessions();
  const { allVehicles } = useFleetVehicles();

  const fleetOverviewStats = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const reservations = allSessions.filter(rentalCountsForCalendar).length;
    const activeDeliveries = allSessions.filter((s) => s.startDate <= todayStr && s.endDate >= todayStr).length;
    const maintenanceCount = allVehicles.filter((v) => v.status === "MAINTENANCE").length;
    const fleetSize = allVehicles.length;
    const occupancyPct = fleetSize === 0 ? 0 : Math.min(100, Math.round((reservations / fleetSize) * 100));
    const activeVsFleetPct = fleetSize === 0 ? 0 : Math.min(100, Math.round((activeDeliveries / fleetSize) * 100));
    const maintenanceVsFleetPct = fleetSize === 0 ? 0 : Math.min(100, Math.round((maintenanceCount / fleetSize) * 100));
    return {
      reservations,
      activeDeliveries,
      maintenanceCount,
      fleetSize,
      occupancyPct,
      activeVsFleetPct,
      maintenanceVsFleetPct,
    };
  }, [allSessions, allVehicles]);

  return (
    <section className="rounded-2xl border bg-white/95 p-4 shadow-sm dark:bg-card sm:p-6">
      <div className="mb-4 space-y-1 border-b border-border/60 pb-4">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Filo özeti</h2>
        <p className="max-w-xl text-sm text-muted-foreground">
          Anlık göstergeler. Tarih aralığı ve araç filtresi ile detaylı grafikleri aşağıda inceleyin.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative overflow-hidden rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50 via-card to-card p-4 shadow-sm dark:border-sky-900/40 dark:from-sky-950/50">
          <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-sky-400/15 blur-2xl dark:bg-sky-400/10" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-900/70 dark:text-sky-200/80">Toplam rezervasyon</p>
              <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-sky-950 dark:text-sky-50">
                {fleetOverviewStats.reservations}
              </p>
              <p className="mt-1 text-xs text-sky-900/65 dark:text-sky-300/70">Takvimde sayilan acik veya beklemedeki kayitlar</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-700 dark:bg-sky-400/20 dark:text-sky-200">
              <ClipboardList className="h-6 w-6" aria-hidden />
            </div>
          </div>
          <MiniBar
            value={
              fleetOverviewStats.fleetSize === 0
                ? 0
                : Math.min(100, (fleetOverviewStats.reservations / fleetOverviewStats.fleetSize) * 100)
            }
          />
          <p className="mt-2 text-[11px] tabular-nums text-sky-900/55 dark:text-sky-400/70">
            Filo: <span className="font-medium text-foreground">{fleetOverviewStats.fleetSize}</span> araç
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-card to-card p-4 shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/45">
          <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-emerald-400/15 blur-2xl dark:bg-emerald-400/10" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-900/70 dark:text-emerald-200/80">Aktif teslimat</p>
              <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-emerald-950 dark:text-emerald-50">
                {fleetOverviewStats.activeDeliveries}
              </p>
              <p className="mt-1 text-xs text-emerald-900/65 dark:text-emerald-300/70">Bugün tarih aralığında olan kiralama</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-200">
              <Truck className="h-6 w-6" aria-hidden />
            </div>
          </div>
          <MiniBar value={fleetOverviewStats.activeVsFleetPct} />
          <p className="mt-2 text-[11px] tabular-nums text-emerald-900/55 dark:text-emerald-400/70">
            Filoya oran: <span className="font-medium text-foreground">%{fleetOverviewStats.activeVsFleetPct}</span>
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-card to-card p-4 shadow-sm dark:border-amber-900/40 dark:from-amber-950/40">
          <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-amber-400/15 blur-2xl dark:bg-amber-400/10" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900/70 dark:text-amber-200/80">Servis bekleyen</p>
              <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-amber-950 dark:text-amber-50">
                {fleetOverviewStats.maintenanceCount}
              </p>
              <p className="mt-1 text-xs text-amber-900/65 dark:text-amber-300/70">Bakımda işaretli araçlar</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-800 dark:bg-amber-400/20 dark:text-amber-100">
              <Wrench className="h-6 w-6" aria-hidden />
            </div>
          </div>
          <MiniBar value={fleetOverviewStats.maintenanceVsFleetPct} />
          <p className="mt-2 text-[11px] tabular-nums text-amber-900/55 dark:text-amber-400/70">
            Filoya oran: <span className="font-medium text-foreground">%{fleetOverviewStats.maintenanceVsFleetPct}</span>
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card p-4 shadow-sm dark:from-primary/15">
          <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
          <div className="relative flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Doluluk oranı</p>
              <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-foreground">%{fleetOverviewStats.occupancyPct}</p>
              <p className="mt-1 text-xs text-muted-foreground">Rezervasyon kaydı / araç (yaklaşık)</p>
            </div>
            <div className="flex shrink-0 items-center justify-center rounded-xl bg-primary/10 p-1 dark:bg-primary/15">
              <OccupancyRing pct={fleetOverviewStats.occupancyPct} />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted/40 px-2 py-1.5 dark:bg-muted/25">
            <CarFront className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-[11px] tabular-nums text-muted-foreground">
              <span className="font-semibold text-foreground">{fleetOverviewStats.reservations}</span>
              <span className="mx-1 opacity-60">/</span>
              <span className="font-semibold text-foreground">{fleetOverviewStats.fleetSize}</span>
              <span className="ml-1.5 text-muted-foreground">rezervasyon / araç</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
