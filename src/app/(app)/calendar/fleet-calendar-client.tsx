"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { tr } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, Download, Plus, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFleetSessions } from "@/hooks/use-fleet-sessions";
import { useFleetVehicles } from "@/hooks/use-fleet-vehicles";
import { rentalsActiveOnDay } from "@/lib/fleet-utils";
import { rentalCountsForCalendar } from "@/lib/rental-status";
import { cn } from "@/lib/utils";

const MAX_RENTALS_PER_CELL = 3;
const ALL_VEHICLES_VALUE = "__all__";
type ZoomMode = "month" | "week" | "day";
type CalendarStatus = "active" | "completed" | "maintenance" | "pending";

export function FleetCalendarClient() {
  const { allSessions, ready: sessionsReady, error: sessionsError } = useFleetSessions();
  const { allVehicles, ready: vehiclesReady, error: vehiclesError } = useFleetVehicles();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [vehicleScope, setVehicleScope] = useState<string>(ALL_VEHICLES_VALUE);
  const [zoomMode, setZoomMode] = useState<ZoomMode>("month");

  const vehicleById = useMemo(() => new Map(allVehicles.map((v) => [v.id, v])), [allVehicles]);

  const vehiclesForSelect = useMemo(() => {
    const list = [...allVehicles].sort((a, b) => a.plate.localeCompare(b.plate, "tr"));
    const filtered = list;
    if (vehicleScope === ALL_VEHICLES_VALUE) return filtered;
    const sel = allVehicles.find((v) => v.id === vehicleScope);
    if (sel && !filtered.some((v) => v.id === vehicleScope)) {
      return [sel, ...filtered];
    }
    return filtered;
  }, [allVehicles, vehicleScope]);

  const safeVehicleScope = useMemo(() => {
    if (vehicleScope === ALL_VEHICLES_VALUE) return ALL_VEHICLES_VALUE;
    return allVehicles.some((v) => v.id === vehicleScope) ? vehicleScope : ALL_VEHICLES_VALUE;
  }, [allVehicles, vehicleScope]);

  const rentalsForCell = (day: Date) => {
    const infos = rentalsActiveOnDay(allSessions, day);
    if (safeVehicleScope === ALL_VEHICLES_VALUE) return infos;
    return infos.filter((i) => i.session.vehicleId === safeVehicleScope);
  };

  const weekdayLabels = useMemo(() => ["PZT", "SAL", "CAR", "PER", "CUM", "CMT", "PAZ"], []);
  const mobileWeekdayLabels = useMemo(() => ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"], []);

  const gridDays = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const from = startOfWeek(start, { weekStartsOn: 1 });
    const to = endOfWeek(end, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: from, end: to });
  }, [month]);
  const mobileGridDays = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const from = startOfWeek(start, { weekStartsOn: 0 });
    const to = endOfWeek(end, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: from, end: to });
  }, [month]);

  const ready = sessionsReady && vehiclesReady;
  const error = sessionsError ?? vehiclesError;

  const resolveStatus = (startDate: string, endDate: string, vehicleId: string): CalendarStatus => {
    const vehicle = vehicleById.get(vehicleId);
    if (vehicle?.maintenance) return "maintenance";
    const today = format(new Date(), "yyyy-MM-dd");
    if (endDate < today) return "completed";
    if (startDate > today) return "pending";
    return "active";
  };

  const statusClasses: Record<CalendarStatus, string> = {
    active: "border-emerald-500 bg-emerald-50 text-emerald-900",
    completed: "border-sky-400 bg-sky-50 text-sky-900",
    maintenance: "border-amber-500 bg-amber-50 text-amber-900",
    pending: "border-slate-400 bg-slate-100 text-slate-700",
  };
  const today = new Date();
  const todayIso = format(today, "yyyy-MM-dd");
  const todayEvents = rentalsForCell(today).slice(0, 4);
  const eventTimeLabel = (idx: number) => ["09:30", "11:00", "14:00", "16:30"][idx] ?? "10:00";
  const statusDotClass: Record<CalendarStatus, string> = {
    active: "bg-emerald-500",
    completed: "bg-sky-500",
    maintenance: "bg-amber-500",
    pending: "bg-slate-400",
  };

  return (
    <div className="mx-auto max-w-[min(100%,90rem)] space-y-4">
      <div className="hidden flex-wrap items-center justify-between gap-3 lg:flex">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">Planlama Modulu</p>
          <h1 className="text-3xl font-semibold tracking-tight">Kiralama Takvimi</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" className="h-10 gap-2 rounded-lg px-4">
            <Download className="h-4 w-4" />
            Disa Aktar
          </Button>
          <Button type="button" className="h-10 gap-2 rounded-lg bg-sky-500 px-4 text-white hover:bg-sky-600">
            <Plus className="h-4 w-4" />
            Yeni Rezervasyon
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      <Card className="rounded-2xl border bg-white/95 shadow-sm dark:bg-card">
        <CardContent className="space-y-4 px-4 py-4 sm:px-6">
          <div className="hidden rounded-xl border border-border/80 bg-muted/30 p-3 lg:block">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-lg border-white bg-white px-4 text-xs font-semibold dark:border-border dark:bg-background"
                  onClick={() => setMonth(startOfMonth(new Date()))}
                >
                  Bugun
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-md" onClick={() => setMonth((m) => addMonths(m, -1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-[9rem] text-center text-base font-semibold capitalize tabular-nums">
                  {format(month, "LLLL yyyy", { locale: tr })}
                </span>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-md" onClick={() => setMonth((m) => addMonths(m, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={safeVehicleScope} onValueChange={(v) => setVehicleScope(v)} disabled={!ready || allVehicles.length === 0}>
                  <SelectTrigger className="h-9 min-w-[11rem] rounded-lg bg-white text-xs dark:bg-background">
                    <SelectValue placeholder="Arac Kategorisi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VEHICLES_VALUE} className="text-xs">
                      Arac Kategorisi
                    </SelectItem>
                    {vehiclesForSelect.map((v) => (
                      <SelectItem key={v.id} value={v.id} className="text-xs">
                        <span className="font-mono">{v.plate}</span>
                        <span className="text-muted-foreground"> - {v.brand} {v.model}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Tabs value={zoomMode} onValueChange={(v) => setZoomMode(v as ZoomMode)}>
                  <TabsList className="h-9 rounded-lg bg-white p-1 dark:bg-background">
                    <TabsTrigger value="month" className="px-3 text-xs">Ay</TabsTrigger>
                    <TabsTrigger value="week" className="px-3 text-xs">Hafta</TabsTrigger>
                    <TabsTrigger value="day" className="px-3 text-xs">Gun</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Aktif</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sky-500" />Tamamlandi</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />Bakim</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-400" />Beklemede</span>
            </div>
          </div>
          {!ready ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Takvim yukleniyor...</p>
          ) : (
            <>
              <div className="space-y-6 lg:hidden">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-slate-900">{format(month, "LLLL yyyy", { locale: tr })}</h2>
                  <div className="flex gap-1">
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-lg border-slate-300" onClick={() => setMonth((m) => addMonths(m, -1))}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-lg border-slate-300" onClick={() => setMonth((m) => addMonths(m, 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
                  <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60 py-3">
                    {mobileWeekdayLabels.map((label) => (
                      <div key={label} className="text-center text-[11px] font-semibold text-slate-500">{label}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {mobileGridDays.map((day) => {
                      const infos = rentalsForCell(day);
                      const inMonth = isSameMonth(day, month);
                      const dots = infos.slice(0, 3).map(({ session }) => resolveStatus(session.startDate, session.endDate, session.vehicleId));
                      return (
                        <div key={`mobile-grid-${format(day, "yyyy-MM-dd")}`} className={cn("h-16 border-b border-r border-slate-50 text-sm", !inMonth && "text-slate-300", isToday(day) && "bg-sky-50 text-sky-700 font-bold")}>
                          <div className="flex h-full flex-col items-center justify-center">
                            <span>{format(day, "d")}</span>
                            <div className="mt-1 flex gap-0.5">
                              {dots.map((dot, idx) => (
                                <span key={`${dot}-${idx}`} className={cn("h-1.5 w-1.5 rounded-full", statusDotClass[dot])} />
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-900">Events Today</h3>
                    <span className="text-xs text-slate-400">{todayIso}</span>
                  </div>
                  <div className="space-y-3">
                    {todayEvents.length === 0 ? (
                      <div className="rounded-xl border border-slate-100 bg-white p-4 text-sm text-slate-500 shadow-sm">Bugün etkinlik yok.</div>
                    ) : (
                      todayEvents.map(({ session: s }, idx) => {
                        const v = vehicleById.get(s.vehicleId);
                        const status = resolveStatus(s.startDate, s.endDate, s.vehicleId);
                        const customer = s.customer?.fullName?.trim() || "Musteri";
                        return (
                          <div key={`today-${s.id}`} className="flex items-start gap-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                            <div className={cn("rounded-lg p-2.5", status === "maintenance" ? "bg-amber-50 text-amber-600" : status === "pending" ? "bg-sky-50 text-sky-600" : "bg-emerald-50 text-emerald-600")}>
                              {status === "maintenance" ? <Wrench className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-900">{status === "completed" ? "Scheduled Return" : "Scheduled Pickup"}</p>
                                  <p className="truncate text-xs text-slate-500">{v ? `${v.brand} ${v.model}` : "Arac"} • {vehicleById.get(s.vehicleId)?.plate ?? s.vehicleId.slice(0, 8)}</p>
                                </div>
                                <span className="text-xs font-bold text-slate-900">{eventTimeLabel(idx)}</span>
                              </div>
                              <div className="mt-3 flex items-center justify-between">
                                <span className="truncate text-xs text-slate-600">{customer}</span>
                                <button type="button" className="text-xs font-bold text-sky-600">Details</button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
                <Button type="button" size="icon" className="fixed bottom-24 right-6 z-30 h-14 w-14 rounded-full bg-sky-500 text-white shadow-lg">
                  <Plus className="h-8 w-8" />
                </Button>
              </div>
              <div className="hidden overflow-x-auto lg:block">
              <div className="min-w-[920px] rounded-2xl border bg-card">
                <div className="grid grid-cols-7 border-b">
                  {weekdayLabels.map((label) => (
                    <div key={label} className="border-r px-2 py-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground last:border-r-0">
                      {label}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {gridDays.map((day) => {
                    const infos = rentalsForCell(day);
                    const inMonth = isSameMonth(day, month);
                    const visible = infos.slice(0, MAX_RENTALS_PER_CELL);
                    const more = infos.length - visible.length;
                    return (
                      <div key={format(day, "yyyy-MM-dd")} className={cn("min-h-[8rem] border-b border-r p-2 last:border-r-0", !inMonth && "bg-muted/30 text-muted-foreground", isToday(day) && "bg-sky-50/70 dark:bg-sky-950/25")}>
                        <p className={cn("mb-2 text-sm font-medium", isToday(day) && "text-sky-700 dark:text-sky-300")}>{format(day, "d")}</p>
                        <div className="space-y-1">
                          {visible.map(({ session: s }) => {
                            const v = vehicleById.get(s.vehicleId);
                            const plate = v?.plate ?? s.vehicleId.slice(0, 8);
                            const status = resolveStatus(s.startDate, s.endDate, s.vehicleId);
                            const customer = s.customer?.fullName?.trim() || s.customer?.email?.trim() || "Musteri";
                            return (
                              <div key={s.id} className={cn("rounded-md border-l-4 px-2 py-1 text-[11px]", statusClasses[status])} title={`${plate}: ${s.startDate} -> ${s.endDate}`}>
                                <p className="truncate font-medium">{plate}</p>
                                <p className="truncate text-[10px] opacity-80">Musteri: {customer}</p>
                              </div>
                            );
                          })}
                          {more > 0 && <p className="text-[10px] text-muted-foreground">+{more} kayit daha</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              </div>
            </>
          )}
          <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Toplam Rezervasyon</p>
              <p className="mt-2 text-3xl font-semibold">{allSessions.filter(rentalCountsForCalendar).length}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Aktif Teslimat</p>
              <p className="mt-2 text-3xl font-semibold">{allSessions.filter((s) => {
                const today = format(new Date(), "yyyy-MM-dd");
                return s.startDate <= today && s.endDate >= today;
              }).length}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Servis Bekleyen</p>
              <p className="mt-2 text-3xl font-semibold">{allVehicles.filter((v) => v.maintenance).length}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Doluluk Orani</p>
              <p className="mt-2 text-3xl font-semibold">
                {allVehicles.length === 0 ? "%0" : `%${Math.round((allSessions.filter(rentalCountsForCalendar).length / allVehicles.length) * 100)}`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
