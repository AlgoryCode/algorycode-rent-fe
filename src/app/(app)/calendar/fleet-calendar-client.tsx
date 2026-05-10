"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
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
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFleetSessions } from "@/hooks/use-fleet-sessions";
import { useFleetVehicles } from "@/hooks/use-fleet-vehicles";
import { rentalsActiveOnDay } from "@/lib/fleet-utils";
import type { RentalSession } from "@/lib/mock-fleet";
import { normalizeRentalStatus } from "@/lib/rental-status";
import { cn } from "@/lib/utils";

const MAX_RENTALS_PER_CELL = 3;
const ALL_VEHICLES_VALUE = "__all__";
const DAY_TIMELINE_START_H = 7;
const DAY_TIMELINE_HOURS = 14;
type ZoomMode = "month" | "week" | "day";
type CalendarStatus = "active" | "completed" | "maintenance" | "pending";

function rentalPickupReturnFlags(day: Date, s: RentalSession) {
  const iso = format(day, "yyyy-MM-dd");
  const isPickup = iso === s.startDate;
  const isReturn = iso === s.endDate;
  const isMiddle = iso > s.startDate && iso < s.endDate;
  return { isPickup, isReturn, isMiddle };
}

export function FleetCalendarClient() {
  const { allSessions, ready: sessionsReady, error: sessionsError } = useFleetSessions();
  const { allVehicles, ready: vehiclesReady, error: vehiclesError } = useFleetVehicles();
  const [focusDate, setFocusDate] = useState(() => startOfMonth(new Date()));
  const [vehicleScope, setVehicleScope] = useState<string>(ALL_VEHICLES_VALUE);
  const [zoomMode, setZoomMode] = useState<ZoomMode>("month");

  const vehicleById = useMemo(() => new Map(allVehicles.map((v) => [String(v.id), v])), [allVehicles]);

  const vehiclesForSelect = useMemo(() => {
    const list = [...allVehicles].sort((a, b) => a.plate.localeCompare(b.plate, "tr"));
    const filtered = list;
    if (vehicleScope === ALL_VEHICLES_VALUE) return filtered;
    const sel = allVehicles.find((v) => String(v.id) === vehicleScope);
    if (sel && !filtered.some((v) => String(v.id) === vehicleScope)) {
      return [sel, ...filtered];
    }
    return filtered;
  }, [allVehicles, vehicleScope]);

  const safeVehicleScope = useMemo(() => {
    if (vehicleScope === ALL_VEHICLES_VALUE) return ALL_VEHICLES_VALUE;
    return allVehicles.some((v) => String(v.id) === vehicleScope) ? vehicleScope : ALL_VEHICLES_VALUE;
  }, [allVehicles, vehicleScope]);

  const rentalsForCell = (day: Date) => {
    const infos = rentalsActiveOnDay(allSessions, day);
    if (safeVehicleScope === ALL_VEHICLES_VALUE) return infos;
    return infos.filter((i) => String(i.session.vehicleId) === String(safeVehicleScope));
  };

  const weekdayLabels = useMemo(() => ["PZT", "SAL", "CAR", "PER", "CUM", "CMT", "PAZ"], []);
  const mobileWeekdayLabels = useMemo(() => ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"], []);

  const displayMonthStart = useMemo(() => startOfMonth(focusDate), [focusDate]);

  const gridDays = useMemo(() => {
    const start = displayMonthStart;
    const end = endOfMonth(start);
    const from = startOfWeek(start, { weekStartsOn: 1 });
    const to = endOfWeek(end, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: from, end: to });
  }, [displayMonthStart]);
  const mobileGridDays = useMemo(() => {
    const start = displayMonthStart;
    const end = endOfMonth(start);
    const from = startOfWeek(start, { weekStartsOn: 0 });
    const to = endOfWeek(end, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: from, end: to });
  }, [displayMonthStart]);

  const weekDays = useMemo(() => {
    const from = startOfWeek(focusDate, { weekStartsOn: 1 });
    const to = endOfWeek(focusDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: from, end: to });
  }, [focusDate]);

  const goToday = () => {
    const n = new Date();
    if (zoomMode === "month") setFocusDate(startOfMonth(n));
    else setFocusDate(n);
  };

  const goPrev = () => {
    setFocusDate((d) => {
      if (zoomMode === "month") return addMonths(startOfMonth(d), -1);
      if (zoomMode === "week") return addWeeks(d, -1);
      return addDays(d, -1);
    });
  };

  const goNext = () => {
    setFocusDate((d) => {
      if (zoomMode === "month") return addMonths(startOfMonth(d), 1);
      if (zoomMode === "week") return addWeeks(d, 1);
      return addDays(d, 1);
    });
  };

  const periodTitle = useMemo(() => {
    if (zoomMode === "month") return format(displayMonthStart, "LLLL yyyy", { locale: tr });
    if (zoomMode === "week") {
      const w0 = startOfWeek(focusDate, { weekStartsOn: 1 });
      const w1 = endOfWeek(focusDate, { weekStartsOn: 1 });
      return `${format(w0, "d MMM", { locale: tr })} – ${format(w1, "d MMM yyyy", { locale: tr })}`;
    }
    return format(focusDate, "d MMMM yyyy EEEE", { locale: tr });
  }, [zoomMode, displayMonthStart, focusDate]);

  const ready = sessionsReady && vehiclesReady;
  const error = sessionsError ?? vehiclesError;

  const resolveCalendarStatus = (session: RentalSession): CalendarStatus => {
    const vehicle = vehicleById.get(String(session.vehicleId));
    if (vehicle?.status === "MAINTENANCE") return "maintenance";
    const st = normalizeRentalStatus(session.status);
    if (st === "completed") return "completed";
    if (st === "pending") return "pending";
    if (st === "cancelled") return "completed";
    return "active";
  };

  const statusClasses: Record<CalendarStatus, string> = {
    active: "border-primary bg-primary/10 text-foreground",
    completed: "border-sky-400 bg-sky-50 text-sky-900",
    maintenance: "border-amber-500 bg-amber-50 text-amber-900",
    pending: "border-slate-400 bg-slate-100 text-slate-700",
  };
  const today = new Date();
  const todayIso = format(today, "yyyy-MM-dd");
  const todayEvents = rentalsForCell(today).slice(0, 4);
  const eventTimeLabel = (idx: number) => ["09:30", "11:00", "14:00", "16:30"][idx] ?? "10:00";
  const statusDotClass: Record<CalendarStatus, string> = {
    active: "bg-primary",
    completed: "bg-sky-500",
    maintenance: "bg-amber-500",
    pending: "bg-slate-400",
  };

  const renderRentalCard = (day: Date, s: RentalSession) => {
    const v = vehicleById.get(s.vehicleId);
    const plate = v?.plate ?? s.vehicleId.slice(0, 8);
    const status = resolveCalendarStatus(s);
    const customer = s.customer?.fullName?.trim() || s.customer?.email?.trim() || "Musteri";
    const { isPickup, isReturn, isMiddle } = rentalPickupReturnFlags(day, s);
    return (
      <div
        key={`${s.id}-${format(day, "yyyy-MM-dd")}`}
        className={cn("rounded-md border-l-4 px-2 py-1 text-[11px]", statusClasses[status])}
        title={`${plate}: ${s.startDate} → ${s.endDate}`}
      >
        {(isPickup || isReturn) && (
          <div className="mb-0.5 flex flex-wrap gap-0.5">
            {isPickup && (
              <span className="rounded bg-emerald-600/15 px-1 text-[9px] font-semibold uppercase tracking-tight text-emerald-800 dark:text-emerald-200">
                Teslim
              </span>
            )}
            {isReturn && (
              <span className="rounded bg-sky-600/15 px-1 text-[9px] font-semibold uppercase tracking-tight text-sky-900 dark:text-sky-100">
                Iade
              </span>
            )}
          </div>
        )}
        {isMiddle && <div className="mb-1 h-0.5 w-full rounded-full bg-primary/35" />}
        <p className="truncate font-medium">{plate}</p>
        <p className="truncate text-[10px] opacity-80">Musteri: {customer}</p>
      </div>
    );
  };

  const dayColumnRentals = zoomMode === "day" ? rentalsForCell(focusDate) : [];

  return (
    <div className="mx-auto max-w-[min(100%,90rem)] space-y-4">
      <div className="hidden flex-wrap items-center justify-between gap-3 lg:flex">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">Planlama Modulu</p>
          <h1 className="text-3xl font-semibold tracking-tight">Kiralama Takvimi</h1>
        </div>
        <div className="flex items-center gap-2">
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
                  onClick={goToday}
                >
                  Bugun
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-md" onClick={goPrev}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-[12rem] text-center text-base font-semibold capitalize tabular-nums">
                  {periodTitle}
                </span>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-md" onClick={goNext}>
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
                      <SelectItem key={v.id} value={String(v.id)} className="text-xs">
                        <span className="font-mono">{v.plate}</span>
                        <span className="text-muted-foreground"> - {v.brand} {v.model}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Tabs
                  value={zoomMode}
                  onValueChange={(v) => {
                    const mode = v as ZoomMode;
                    setZoomMode(mode);
                    if (mode === "month") setFocusDate((d) => startOfMonth(d));
                  }}
                >
                  <TabsList className="h-9 rounded-lg bg-white p-1 dark:bg-background">
                    <TabsTrigger value="month" className="px-3 text-xs">Ay</TabsTrigger>
                    <TabsTrigger value="week" className="px-3 text-xs">Hafta</TabsTrigger>
                    <TabsTrigger value="day" className="px-3 text-xs">Gun</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-primary" />Aktif</span>
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
                  <h2 className="text-xl font-semibold text-slate-900">{format(displayMonthStart, "LLLL yyyy", { locale: tr })}</h2>
                  <div className="flex gap-1">
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-lg border-slate-300" onClick={() => setFocusDate((d) => addMonths(startOfMonth(d), -1))}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-lg border-slate-300" onClick={() => setFocusDate((d) => addMonths(startOfMonth(d), 1))}>
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
                      const inMonth = isSameMonth(day, displayMonthStart);
                      const dots = infos.slice(0, 3).map(({ session }) => resolveCalendarStatus(session));
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
                        const status = resolveCalendarStatus(s);
                        const customer = s.customer?.fullName?.trim() || "Musteri";
                        return (
                          <div key={`today-${s.id}`} className="flex items-start gap-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                            <div className={cn("rounded-lg p-2.5", status === "maintenance" ? "bg-amber-50 text-amber-600" : status === "pending" ? "bg-sky-50 text-sky-600" : "bg-primary/10 text-primary")}>
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
                {zoomMode === "month" && (
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
                        const inMonth = isSameMonth(day, displayMonthStart);
                        const visible = infos.slice(0, MAX_RENTALS_PER_CELL);
                        const more = infos.length - visible.length;
                        return (
                          <div
                            key={format(day, "yyyy-MM-dd")}
                            className={cn(
                              "min-h-[8rem] border-b border-r p-2 last:border-r-0",
                              !inMonth && "bg-muted/30 text-muted-foreground",
                              isToday(day) && "bg-sky-50/70 dark:bg-sky-950/25",
                            )}
                          >
                            <p className={cn("mb-2 text-sm font-medium", isToday(day) && "text-sky-700 dark:text-sky-300")}>{format(day, "d")}</p>
                            <div className="space-y-1">
                              {visible.map(({ session: s }) => renderRentalCard(day, s))}
                              {more > 0 && <p className="text-[10px] text-muted-foreground">+{more} kayit daha</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {zoomMode === "week" && (
                  <div className="min-w-[920px] rounded-2xl border bg-card">
                    <div className="grid grid-cols-7 border-b">
                      {weekDays.map((day, idx) => (
                        <div key={format(day, "yyyy-MM-dd")} className="border-r px-2 py-3 text-center last:border-r-0">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{weekdayLabels[idx]}</div>
                          <div className={cn("mt-1 text-sm font-semibold tabular-nums", isToday(day) && "text-sky-700 dark:text-sky-300")}>{format(day, "d")}</div>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7">
                      {weekDays.map((day) => {
                        const infos = rentalsForCell(day);
                        const visible = infos.slice(0, MAX_RENTALS_PER_CELL);
                        const more = infos.length - visible.length;
                        return (
                          <div
                            key={format(day, "yyyy-MM-dd")}
                            className={cn("min-h-[14rem] border-b border-r p-2 last:border-r-0", isToday(day) && "bg-sky-50/70 dark:bg-sky-950/25")}
                          >
                            <div className="space-y-1">
                              {visible.map(({ session: s }) => renderRentalCard(day, s))}
                              {more > 0 && <p className="text-[10px] text-muted-foreground">+{more} kayit daha</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {zoomMode === "day" && (
                  <div className="min-w-[640px] overflow-hidden rounded-2xl border bg-card">
                    <div className="border-b bg-muted/30 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Gunluk zaman cizelgesi</p>
                      <p className="text-base font-semibold capitalize">{format(focusDate, "d MMMM yyyy EEEE", { locale: tr })}</p>
                    </div>
                    <div className="flex min-h-[320px]">
                      <div className="w-11 shrink-0 border-r bg-muted/15">
                        {Array.from({ length: DAY_TIMELINE_HOURS }, (_, i) => DAY_TIMELINE_START_H + i).map((h) => (
                          <div key={h} className="h-12 border-b border-border/40 px-1 py-1 text-right text-[10px] text-muted-foreground tabular-nums">
                            {h}:00
                          </div>
                        ))}
                      </div>
                      <div className="relative flex-1 bg-muted/5">
                        <div className="pointer-events-none absolute inset-0 flex flex-col">
                          {Array.from({ length: DAY_TIMELINE_HOURS }).map((_, i) => (
                            <div key={i} className="h-12 border-b border-border/25" />
                          ))}
                        </div>
                        <div className="relative space-y-3 p-4">
                          {dayColumnRentals.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Bu gun icin kiralama yok.</p>
                          ) : (
                            dayColumnRentals.map(({ session: s }) => {
                              const plate = vehicleById.get(s.vehicleId)?.plate ?? s.vehicleId.slice(0, 8);
                              const status = resolveCalendarStatus(s);
                              const customer = s.customer?.fullName?.trim() || s.customer?.email?.trim() || "Musteri";
                              const { isPickup, isReturn } = rentalPickupReturnFlags(focusDate, s);
                              return (
                                <div key={s.id} className={cn("rounded-lg border-l-4 bg-card p-3 shadow-sm", statusClasses[status])}>
                                  {(isPickup || isReturn) && (
                                    <div className="mb-2 flex flex-wrap gap-1">
                                      {isPickup && (
                                        <span className="rounded bg-emerald-600/15 px-1.5 text-[10px] font-semibold text-emerald-800 dark:text-emerald-200">
                                          Teslim
                                        </span>
                                      )}
                                      {isReturn && (
                                        <span className="rounded bg-sky-600/15 px-1.5 text-[10px] font-semibold text-sky-900 dark:text-sky-100">
                                          Iade
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  <p className="font-mono text-sm font-semibold">{plate}</p>
                                  <p className="text-xs text-muted-foreground">{customer}</p>
                                  <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
                                    Saat bilgisi rezervasyonda yok; blok gun boyu gosterilir.
                                  </p>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
