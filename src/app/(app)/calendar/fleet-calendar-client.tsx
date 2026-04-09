"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { tr } from "date-fns/locale";
import { Calendar, ChevronLeft, ChevronRight, Rows3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFleetSessions } from "@/hooks/use-fleet-sessions";
import { useFleetVehicles } from "@/hooks/use-fleet-vehicles";
import { rentalsActiveOnDay } from "@/lib/fleet-utils";
import { rentalCountsForCalendar } from "@/lib/rental-status";
import { cn } from "@/lib/utils";

const MAX_RENTALS_PER_CELL = 3;
const ALL_VEHICLES_VALUE = "__all__";
const VIEW_STORAGE_KEY = "fleet-calendar-view-mode-v1";
type ViewMode = "calendar" | "timeline";

function accentForVehicleId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 62% 42%)`;
}

export function FleetCalendarClient() {
  const { allSessions, ready: sessionsReady, error: sessionsError } = useFleetSessions();
  const { allVehicles, ready: vehiclesReady, error: vehiclesError } = useFleetVehicles();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [vehicleScope, setVehicleScope] = useState<string>(ALL_VEHICLES_VALUE);
  const [plateFilter, setPlateFilter] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");

  const vehicleById = useMemo(() => new Map(allVehicles.map((v) => [v.id, v])), [allVehicles]);

  const vehiclesForSelect = useMemo(() => {
    const q = plateFilter.trim().toUpperCase();
    const list = [...allVehicles].sort((a, b) => a.plate.localeCompare(b.plate, "tr"));
    const filtered = list.filter(
      (v) =>
        !q || v.plate.toUpperCase().includes(q) || `${v.brand} ${v.model}`.toUpperCase().includes(q),
    );
    if (vehicleScope === ALL_VEHICLES_VALUE) return filtered;
    const sel = allVehicles.find((v) => v.id === vehicleScope);
    if (sel && !filtered.some((v) => v.id === vehicleScope)) {
      return [sel, ...filtered];
    }
    return filtered;
  }, [allVehicles, plateFilter, vehicleScope]);

  useEffect(() => {
    if (vehicleScope === ALL_VEHICLES_VALUE) return;
    if (!allVehicles.some((v) => v.id === vehicleScope)) {
      setVehicleScope(ALL_VEHICLES_VALUE);
    }
  }, [allVehicles, vehicleScope]);

  const rentalsForCell = (day: Date) => {
    const infos = rentalsActiveOnDay(allSessions, day);
    if (vehicleScope === ALL_VEHICLES_VALUE) return infos;
    return infos.filter((i) => i.session.vehicleId === vehicleScope);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (saved === "calendar" || saved === "timeline") {
      setViewMode(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  const weekdayLabels = useMemo(() => {
    const monday = startOfWeek(new Date(2024, 1, 5), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => format(addDays(monday, i), "EEE", { locale: tr }));
  }, []);

  const gridDays = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const from = startOfWeek(start, { weekStartsOn: 1 });
    const to = endOfWeek(end, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: from, end: to });
  }, [month]);

  const monthStart = useMemo(() => startOfMonth(month), [month]);
  const monthEnd = useMemo(() => endOfMonth(month), [month]);
  const monthDays = useMemo(() => eachDayOfInterval({ start: monthStart, end: monthEnd }), [monthStart, monthEnd]);

  const scopedSessions = useMemo(() => {
    return allSessions.filter((s) => {
      if (!rentalCountsForCalendar(s)) return false;
      if (vehicleScope === ALL_VEHICLES_VALUE) return true;
      return s.vehicleId === vehicleScope;
    });
  }, [allSessions, vehicleScope]);

  const timelineRows = useMemo(() => {
    return scopedSessions
      .filter((s) => s.startDate <= format(monthEnd, "yyyy-MM-dd") && s.endDate >= format(monthStart, "yyyy-MM-dd"))
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [scopedSessions, monthEnd, monthStart]);

  const ready = sessionsReady && vehiclesReady;
  const error = sessionsError ?? vehiclesError;

  return (
    <div className="mx-auto max-w-[min(100%,88rem)] space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Calendar className="h-5 w-5 text-primary" />
          Takvim
        </h1>
        <p className="text-xs text-muted-foreground">
          Tüm filo veya tek araç seçerek takvimi daraltın. Tek araçta yalnızca o plakanın kiralı olduğu günlerde kiralama satırı görünür; diğer araçların kayıtları gösterilmez.
        </p>
      </div>

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      <Card className="glow-card">
        <CardHeader className="flex flex-col gap-3 py-3 sm:space-y-0">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <CardTitle className="text-sm">Filo kiralama takvimi</CardTitle>
              <CardDescription>
                {!ready ? "Yükleniyor…" : `${allSessions.filter(rentalCountsForCalendar).length} takvimde sayılan kiralama`}
                {vehicleScope !== ALL_VEHICLES_VALUE && vehicleById.get(vehicleScope) && (
                  <span className="mt-1 block text-foreground/90">
                    Görünüm:{" "}
                    <span className="font-mono font-medium">{vehicleById.get(vehicleScope)!.plate}</span> — yalnızca bu aracın
                    kiralı günleri.
                  </span>
                )}
                <span className="mt-1 block text-foreground/80">
                  Başlangıç: {format(monthStart, "dd.MM.yyyy")} (1.gün) · Bitiş: {format(monthEnd, "dd.MM.yyyy")} (
                  {monthDays.length}.gün)
                </span>
              </CardDescription>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="min-w-0 flex-1 space-y-1 sm:min-w-[14rem] sm:max-w-xs">
                  <Label htmlFor="fleet-cal-vehicle" className="text-[11px] text-muted-foreground">
                    Araç
                  </Label>
                  <Select
                    value={vehicleScope}
                    onValueChange={(v) => setVehicleScope(v)}
                    disabled={!ready || allVehicles.length === 0}
                  >
                    <SelectTrigger id="fleet-cal-vehicle" className="h-9 text-xs">
                      <SelectValue placeholder="Araç seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_VEHICLES_VALUE} className="text-xs">
                        Tüm araçlar (filo özeti)
                      </SelectItem>
                      {vehiclesForSelect.map((v) => (
                        <SelectItem key={v.id} value={v.id} className="text-xs">
                          <span className="font-mono">{v.plate}</span>
                          <span className="text-muted-foreground"> — {v.brand} {v.model}</span>
                          {v.maintenance ? " (bakım)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0 flex-1 space-y-1 sm:min-w-[10rem] sm:max-w-[14rem]">
                  <Label htmlFor="fleet-cal-plate" className="text-[11px] text-muted-foreground">
                    Listeyi daralt (plaka / model)
                  </Label>
                  <Input
                    id="fleet-cal-plate"
                    className="h-9 text-xs"
                    placeholder="Örn: 34 veya Corolla"
                    value={plateFilter}
                    onChange={(e) => setPlateFilter(e.target.value)}
                    disabled={!ready}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Görünüm</Label>
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="w-full sm:w-auto">
                  <TabsList className="h-9">
                    <TabsTrigger value="calendar" className="gap-1 text-xs">
                      <Calendar className="h-3.5 w-3.5" />
                      Takvim
                    </TabsTrigger>
                    <TabsTrigger value="timeline" className="gap-1 text-xs">
                      <Rows3 className="h-3.5 w-3.5" />
                      Timeline
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                aria-label="Önceki ay"
                onClick={() => setMonth((m) => addMonths(m, -1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[10rem] text-center text-sm font-semibold capitalize tabular-nums">
                {format(month, "LLLL yyyy", { locale: tr })}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                aria-label="Sonraki ay"
                onClick={() => setMonth((m) => addMonths(m, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="ml-1 h-9 text-xs"
                onClick={() => setMonth(startOfMonth(new Date()))}
              >
                Bugün
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-2 pb-4 pt-0 sm:px-4">
          {!ready ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Takvim yükleniyor…</p>
          ) : viewMode === "calendar" ? (
            <div className="overflow-x-auto">
              <div className="min-w-[640px]">
                <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                  {weekdayLabels.map((label) => (
                    <div
                      key={label}
                      className="rounded-md bg-muted/50 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs"
                    >
                      {label}
                    </div>
                  ))}
                  {gridDays.map((day) => {
                    const infos = rentalsForCell(day);
                    const inMonth = isSameMonth(day, month);
                    const seqDay = inMonth ? Math.floor((day.getTime() - monthStart.getTime()) / 86_400_000) + 1 : null;
                    const visible = infos.slice(0, MAX_RENTALS_PER_CELL);
                    const more = infos.length - visible.length;
                    const singleVehicleMode = vehicleScope !== ALL_VEHICLES_VALUE;
                    const hasRental = infos.length > 0;
                    return (
                      <div
                        key={format(day, "yyyy-MM-dd")}
                        className={cn(
                          "flex min-h-[5.5rem] flex-col rounded-lg border border-border/80 bg-card p-1 shadow-sm sm:min-h-[7.5rem] lg:min-h-[9rem]",
                          !inMonth && "opacity-45",
                          isToday(day) && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                          singleVehicleMode && inMonth && !hasRental && "bg-muted/20",
                        )}
                      >
                        <div className="flex items-start justify-between gap-1 px-0.5 pt-0.5">
                          <div className="space-y-0.5">
                            <span
                              className={cn(
                                "tabular-nums text-xs font-semibold sm:text-sm",
                                isToday(day) ? "text-primary" : "text-foreground",
                              )}
                            >
                              {format(day, "d")}
                            </span>
                            {seqDay != null && <p className="text-[9px] text-muted-foreground">{seqDay}.gün</p>}
                          </div>
                        </div>
                        <div className="mt-1 flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
                          {visible.map(({ session: s, durationDays }) => {
                            const v = vehicleById.get(s.vehicleId);
                            const plate = v?.plate ?? s.vehicleId.slice(0, 8);
                            const accent = accentForVehicleId(s.vehicleId);
                            return (
                              <div
                                key={s.id}
                                className="block truncate rounded-md border border-border/50 bg-muted/30 px-1 py-0.5 text-left text-[10px] sm:text-xs"
                                style={{ borderLeftWidth: 3, borderLeftColor: accent }}
                                title={`${plate}: ${s.startDate} → ${s.endDate} (${durationDays} gün)`}
                              >
                                <span className="font-mono font-medium">{plate}</span>
                                <span className="text-muted-foreground"> · {durationDays} gün</span>
                              </div>
                            );
                          })}
                          {more > 0 && (
                            <p className="truncate px-0.5 text-[10px] text-muted-foreground">+{more} kirada</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {timelineRows.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Bu ay için eşleşen kiralama kaydı yok.</p>
              ) : (
                <div className="overflow-x-auto">
                  <div className="rounded-lg border border-border/70 bg-card/40 p-2">
                    <div className="mb-2 grid grid-cols-[240px_1fr] gap-2 px-1">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Kiralama</div>
                      <div
                        className="grid min-w-[760px]"
                        style={{ gridTemplateColumns: `repeat(${monthDays.length}, minmax(24px, 1fr))` }}
                      >
                        {monthDays.map((d, idx) => (
                          <div key={`h-${format(d, "yyyy-MM-dd")}`} className="text-center text-[9px] text-muted-foreground">
                            {idx === 0 || idx === monthDays.length - 1 || idx % 3 === 0 ? `${idx + 1}` : "·"}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {timelineRows.map((s) => {
                        const v = vehicleById.get(s.vehicleId);
                        const plate = v?.plate ?? s.vehicleId.slice(0, 8);
                        const accent = accentForVehicleId(s.vehicleId);
                        const start = parseISO(s.startDate);
                        const end = parseISO(s.endDate);
                        const clampedStart = start < monthStart ? monthStart : start;
                        const clampedEnd = end > monthEnd ? monthEnd : end;
                        const msDay = 86_400_000;
                        const startIdx = Math.max(0, Math.floor((clampedStart.getTime() - monthStart.getTime()) / msDay));
                        const endIdx = Math.min(monthDays.length - 1, Math.floor((clampedEnd.getTime() - monthStart.getTime()) / msDay));
                        const spanDays = Math.max(1, endIdx - startIdx + 1);
                        const leftPct = (startIdx / monthDays.length) * 100;
                        const widthPct = (spanDays / monthDays.length) * 100;
                        const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / msDay) + 1);
                        return (
                          <div key={s.id} className="grid grid-cols-[240px_1fr] gap-2 rounded-md border border-border/60 bg-background/70 px-1 py-1.5">
                            <div className="min-w-0 px-1">
                              <p className="truncate font-mono text-xs font-semibold">{plate}</p>
                              <p className="truncate text-[10px] text-muted-foreground">
                                {s.startDate} → {s.endDate} · {totalDays} gün
                              </p>
                            </div>
                            <div className="relative block h-8 min-w-[760px] rounded bg-muted/50" title={`${plate}: ${s.startDate} → ${s.endDate} (${totalDays} gün)`}>
                              <div
                                className="absolute inset-y-1 overflow-hidden rounded px-2 text-[10px] font-semibold text-white"
                                style={{ left: `${leftPct}%`, width: `${widthPct}%`, backgroundColor: accent }}
                              >
                                <span className="truncate">{plate}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Sprint benzeri timeline: satırlar kiralamaları, yatay eksen ayın günlerini gösterir.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
