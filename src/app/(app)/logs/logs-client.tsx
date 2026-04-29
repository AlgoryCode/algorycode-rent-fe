"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays, parseISO, startOfDay } from "date-fns";
import {
  CalendarDays,
  CarFront,
  ChevronLeft,
  ChevronRight,
  Download,
  EllipsisVertical,
  KeyRound,
  LayoutGrid,
  List,
  MailCheck,
  ScrollText,
  Search,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { AddEntityButton } from "@/components/ui/add-entity-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ListingPanel, ListingTableWell } from "@/components/ui/listing-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFleetSessions } from "@/hooks/use-fleet-sessions";
import { useFleetVehicles } from "@/hooks/use-fleet-vehicles";
import { vehicleFleetStatus } from "@/lib/fleet-utils";
import {
  emptyRentalLogFilters,
  filterRentalLogSessions,
  sortSessionsByLogTimeDesc,
  type RentalLogFilterValues,
} from "@/lib/rental-log-filters";
import { fetchRentalsFromRentApi, getRentApiErrorMessage } from "@/lib/rent-api";
import { rentKeys } from "@/lib/rent-query-keys";
import type { RentalSession, Vehicle } from "@/lib/mock-fleet";
import { vehiclePlate } from "@/lib/rental-metadata";
import { mergeVehicleImagesWithDemo, type VehicleImageSlot } from "@/lib/vehicle-images";
import { RENTAL_STATUS_LABEL, type RentalStatus } from "@/lib/rental-status";
import { cn } from "@/lib/utils";
import { RequestsClient } from "../requests/requests-client";

type VehicleStartView = "gallery" | "list";

const CARD_COVER_ORDER: VehicleImageSlot[] = ["front", "left", "right", "rear", "interiorDash", "interiorRear"];

const PAGE_SIZE = 8;

function vehicleCardCoverUrl(v: Vehicle): string | undefined {
  const merged = mergeVehicleImagesWithDemo(v.images, v.id);
  for (const key of CARD_COVER_ORDER) {
    const u = merged[key];
    if (typeof u === "string" && u.trim().length > 0) return u;
  }
  return undefined;
}

function formatVehicleDailyRental(v: Vehicle): string {
  const p = v.rentalDailyPrice;
  if (p == null || !Number.isFinite(p)) return "—";
  return `${p.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₺`;
}

function vehicleMatchesSearch(v: Vehicle, raw: string): boolean {
  const q = raw.trim().toLocaleLowerCase("tr-TR");
  if (!q) return true;
  const parts = [v.plate, v.brand, v.model, String(v.year), v.id, v.externalCompany ?? ""];
  const blob = parts.join(" ").toLocaleLowerCase("tr-TR");
  const blobCompact = blob.replace(/\s+/g, "");
  const qCompact = q.replace(/\s+/g, "");
  if (blob.includes(q) || blobCompact.includes(qCompact)) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every(
    (t) => blob.includes(t) || blobCompact.includes(t.replace(/\s+/g, "")) || parts.some((p) => p.toLocaleLowerCase("tr-TR").includes(t)),
  );
}

function sessionStatus(s: RentalSession): RentalStatus {
  return s.status ?? "active";
}

function rentalDayCount(startDate: string, endDate: string): number {
  const a = parseISO(startDate);
  const b = parseISO(endDate);
  return Math.max(1, differenceInCalendarDays(b, a) + 1);
}

function sessionEstimatedTotal(session: RentalSession, vehicle: Vehicle | undefined): string {
  const daily = vehicle?.rentalDailyPrice;
  if (daily == null || !Number.isFinite(daily)) return "—";
  const days = rentalDayCount(session.startDate, session.endDate);
  const total = days * daily;
  return `${total.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₺`;
}

function statusPillClass(st: RentalStatus): string {
  if (st === "active") return "bg-emerald-100 text-emerald-700";
  if (st === "pending") return "bg-sky-100 text-sky-700";
  if (st === "completed") return "bg-slate-100 text-slate-600";
  return "bg-rose-100 text-rose-700";
}

export function RentalLogsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sekme = searchParams.get("sekme");
  const logTab = sekme === "istekler" ? "requests" : sekme === "baslat" ? "start" : "logs";
  const navigateLogTab = (next: "logs" | "start" | "requests") => {
    if (next === "requests") router.replace("/logs?sekme=istekler", { scroll: false });
    else if (next === "start") router.replace("/logs?sekme=baslat", { scroll: false });
    else router.replace("/logs", { scroll: false });
  };
  const { allVehicles } = useFleetVehicles();
  const { allSessions: fleetSessions } = useFleetSessions();
  const [draftFilters, setDraftFilters] = useState<RentalLogFilterValues>(emptyRentalLogFilters);
  const [filters, setFilters] = useState<RentalLogFilterValues>(emptyRentalLogFilters);
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [vehicleStartView, setVehicleStartView] = useState<VehicleStartView>("gallery");
  const [page, setPage] = useState(1);

  const vehiclesById = useMemo(() => new Map(allVehicles.map((v) => [v.id, v])), [allVehicles]);

  const vehiclesForStartTab = useMemo(
    () => allVehicles.filter((v) => vehicleMatchesSearch(v, vehicleSearch)),
    [allVehicles, vehicleSearch],
  );

  const today = useMemo(() => startOfDay(new Date()), []);

  const {
    data: allSessions = [],
    isPending: sessionsLoading,
    error: sessionsError,
  } = useQuery({
    queryKey: [...rentKeys.rentals(), "logs", filters.rangeStart, filters.rangeEnd, filters.status],
    queryFn: () =>
      fetchRentalsFromRentApi({
        startDate: filters.rangeStart || undefined,
        endDate: filters.rangeEnd || undefined,
        status: filters.status === "all" ? undefined : filters.status,
      }),
  });

  const filteredSessions = useMemo(() => {
    let list = allSessions;
    const pq = filters.vehicleQuery?.trim().toUpperCase();
    if (pq) {
      list = list.filter((s) => vehiclePlate(vehiclesById, s.vehicleId).toUpperCase().includes(pq));
    }
    list = filterRentalLogSessions(list, filters);
    return sortSessionsByLogTimeDesc(list);
  }, [allSessions, filters, vehiclesById]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedSessions = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredSessions.slice(start, start + PAGE_SIZE);
  }, [filteredSessions, safePage]);

  const fleetMetrics = useMemo(() => {
    const rentable = allVehicles.filter((v) => !v.maintenance);
    let rentedToday = 0;
    let available = 0;
    let maintenance = 0;
    for (const v of allVehicles) {
      if (v.maintenance) {
        maintenance += 1;
        continue;
      }
      const st = vehicleFleetStatus(v, fleetSessions, today);
      if (st === "rented") rentedToday += 1;
      else available += 1;
    }
    const occupancyPct = rentable.length > 0 ? (rentedToday / rentable.length) * 100 : 0;
    const pendingApprovals = fleetSessions.filter((s) => sessionStatus(s) === "pending").length;
    return {
      occupancyPct,
      pendingApprovals,
      rentedToday,
      totalVehicles: allVehicles.length,
      available,
      maintenance,
    };
  }, [allVehicles, fleetSessions, today]);

  const openRentalForVehicle = (vehicleId: string) => {
    const v = allVehicles.find((x) => x.id === vehicleId);
    if (!v) {
      toast.error("Araç bulunamadı.");
      return;
    }
    if (v.maintenance) {
      toast.error("Bu araç bakımda; kiralama oluşturulamaz.");
      return;
    }
    router.push(`/vehicles/${vehicleId}?sayfa=kiralama`);
  };

  const handleExport = async () => {
    if (filteredSessions.length === 0) {
      toast.message("Dışa aktarılacak kiralama yok.");
      return;
    }
    const XLSX = await import("xlsx");
    const exportRows = filteredSessions.map((s) => {
      const v = vehiclesById.get(s.vehicleId);
      const days = rentalDayCount(s.startDate, s.endDate);
      const daily = v?.rentalDailyPrice;
      const est =
        daily != null && Number.isFinite(daily) ? Math.round(days * daily * 100) / 100 : "";
      return {
        Id: s.id,
        Plate: vehiclePlate(vehiclesById, s.vehicleId),
        Brand: v?.brand ?? "",
        Model: v?.model ?? "",
        Customer: s.customer.fullName,
        Email: s.customer.email ?? "",
        NationalId: s.customer.nationalId,
        StartDate: s.startDate,
        EndDate: s.endDate,
        Days: days,
        DailyRate: daily ?? "",
        EstimatedTotal: est,
        Status: RENTAL_STATUS_LABEL[sessionStatus(s)],
      };
    });
    const sheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Rentals");
    const d = new Date();
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    XLSX.writeFile(workbook, `kiralamalar-${dateKey}.xlsx`);
    toast.success("Excel indirildi.");
  };

  const statusLine = sessionsLoading ? "Yükleniyor…" : sessionsError ? getRentApiErrorMessage(sessionsError) : "";

  return (
    <div className="mx-auto max-w-[92rem] space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Kiralamalar</h1>
          <p className="mt-1 text-sm text-slate-500">
            Filo kiralama kayıtlarını yönetin; yeni kiralama için «Kiralama başlat» sekmesine geçin.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 gap-1.5 rounded-lg border-slate-200 bg-white text-xs text-slate-700 shadow-sm"
            onClick={() => void handleExport()}
          >
            <Download className="h-4 w-4" />
            Excel dışa aktar
          </Button>
          <AddEntityButton icon={KeyRound} onClick={() => navigateLogTab("start")}>
            Yeni kiralama
          </AddEntityButton>
        </div>
      </div>

      <Tabs value={logTab} onValueChange={(v) => navigateLogTab(v as "logs" | "start" | "requests")} className="w-full">
        <TabsList className="h-auto w-full justify-start gap-0 overflow-x-auto rounded-none border-0 border-b border-slate-200 bg-transparent p-0">
          <TabsTrigger
            value="logs"
            className="gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium text-slate-500 shadow-none data-[state=active]:border-sky-500 data-[state=active]:bg-transparent data-[state=active]:text-slate-900"
          >
            <ScrollText className="h-4 w-4" />
            Liste
          </TabsTrigger>
          <TabsTrigger
            value="start"
            className="gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium text-slate-500 shadow-none data-[state=active]:border-sky-500 data-[state=active]:bg-transparent data-[state=active]:text-slate-900"
          >
            <KeyRound className="h-4 w-4" />
            Kiralama başlat
          </TabsTrigger>
          <TabsTrigger
            value="requests"
            className="gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium text-slate-500 shadow-none data-[state=active]:border-sky-500 data-[state=active]:bg-transparent data-[state=active]:text-slate-900"
          >
            <MailCheck className="h-4 w-4" />
            Kiralama istekleri
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="mt-5">
          <div className="space-y-5">
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
                        draftFilters.rangeStart && draftFilters.rangeEnd
                          ? `${draftFilters.rangeStart} - ${draftFilters.rangeEnd}`
                          : ""
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
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-500"
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
                    className="h-10 w-10 text-slate-500 hover:text-sky-600"
                    onClick={() => setFilters(draftFilters)}
                  >
                    <SlidersHorizontal className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              {statusLine ? <p className="mt-3 text-xs text-slate-500">{statusLine}</p> : null}
            </div>
            <ListingPanel className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <ListingTableWell className="rounded-none border-0">
              {sessionsLoading && allSessions.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">Kiralamalar yükleniyor…</p>
              ) : filteredSessions.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">Filtreye uygun kiralama yok.</p>
              ) : (
                <>
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
                      {pagedSessions.map((s) => {
                        const v = vehiclesById.get(s.vehicleId);
                        const cover = v ? vehicleCardCoverUrl(v) : undefined;
                        const st = sessionStatus(s);
                        return (
                          <TableRow key={s.id} className="cursor-pointer hover:bg-sky-50/30" onClick={() => router.push(`/rentals/${s.id}`)}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="relative h-11 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                                  {cover ? (
                                    <div
                                      className="h-full w-full bg-cover bg-center"
                                      style={{ backgroundImage: `url(${JSON.stringify(cover)})` }}
                                    />
                                  ) : (
                                    <div className="flex h-full items-center justify-center text-[9px] text-muted-foreground">
                                      —
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-foreground">
                                    {v ? `${v.brand} ${v.model}` : "Araç"}
                                  </p>
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
                              <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold ${statusPillClass(st)}`}>
                                {RENTAL_STATUS_LABEL[st]}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-sky-600">
                                <EllipsisVertical className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                      <p className="text-xs text-slate-500">
                        {filteredSessions.length === 0
                          ? "—"
                          : `Toplam ${filteredSessions.length} kayıttan ${(safePage - 1) * PAGE_SIZE + 1}-${Math.min(safePage * PAGE_SIZE, filteredSessions.length)} arası gösteriliyor`}
                      </p>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 border-slate-200 bg-white p-0"
                          disabled={safePage <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          aria-label="Önceki sayfa"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="rounded-md bg-sky-500 px-2.5 py-1 text-xs font-bold text-white">{safePage}</span>
                        <span className="px-2 text-xs text-slate-500">/ {totalPages}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 border-slate-200 bg-white p-0"
                          disabled={safePage >= totalPages}
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          aria-label="Sonraki sayfa"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
            </ListingTableWell>
          </ListingPanel>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Doluluk</p>
                <p className="mt-1 text-5xl font-semibold tabular-nums text-slate-900">
                  {fleetMetrics.occupancyPct.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}%
                </p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Bekleyen Onaylar</p>
                <p className="mt-1 text-5xl font-semibold tabular-nums text-slate-900">
                  {fleetMetrics.pendingApprovals}
                </p>
                <p className="mt-1 text-xs text-slate-500">Yeni kiralama talebi</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardContent className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Filo Özeti</p>
                  <p className="text-xs font-bold text-slate-700">{fleetMetrics.totalVehicles} Araç</p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-sky-500 transition-[width]"
                    style={{
                      width: `${fleetMetrics.totalVehicles > 0 ? (fleetMetrics.rentedToday / fleetMetrics.totalVehicles) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-bold uppercase tracking-tight text-slate-600">
                  <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Musait: {fleetMetrics.available}</span>
                  <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Bakım: {fleetMetrics.maintenance}</span>
                  <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-sky-400" />Kirada: {fleetMetrics.rentedToday}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="requests" className="mt-5">
          <RequestsClient embedded />
        </TabsContent>

        <TabsContent value="start" className="mt-5 space-y-4">
          <ListingPanel>
            <ListingTableWell className="p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={vehicleSearch}
                    onChange={(e) => setVehicleSearch(e.target.value)}
                    placeholder="Ara: plaka, marka, model, yıl…"
                    className="h-9 pl-9 text-sm"
                    aria-label="Araç ara"
                  />
                </div>
                <div
                  className="flex shrink-0 rounded-lg border border-border/70 bg-muted/30 p-0.5"
                  role="group"
                  aria-label="Görünüm"
                >
                  <Button
                    type="button"
                    variant={vehicleStartView === "gallery" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-8 flex-1 gap-1.5 px-2.5 text-xs sm:flex-initial"
                    onClick={() => setVehicleStartView("gallery")}
                    aria-pressed={vehicleStartView === "gallery"}
                  >
                    <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
                    Galeri
                  </Button>
                  <Button
                    type="button"
                    variant={vehicleStartView === "list" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-8 flex-1 gap-1.5 px-2.5 text-xs sm:flex-initial"
                    onClick={() => setVehicleStartView("list")}
                    aria-pressed={vehicleStartView === "list"}
                  >
                    <List className="h-3.5 w-3.5 shrink-0" />
                    Liste
                  </Button>
                </div>
              </div>
              {vehicleStartView === "list" ? (
                vehiclesForStartTab.length === 0 ? (
                  <p className="mt-4 py-6 text-center text-xs text-muted-foreground">
                    {allVehicles.length === 0
                      ? "Kayıtlı araç yok."
                      : "Aramanızla eşleşen araç yok. Plakayı boşluksuz veya marka + model şeklinde deneyin."}
                  </p>
                ) : (
                  <div className="mt-4 overflow-x-auto rounded-lg border">
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
                        {vehiclesForStartTab.map((v) => {
                          const disabled = Boolean(v.maintenance);
                          const cover = vehicleCardCoverUrl(v);
                          const dailyLabel = formatVehicleDailyRental(v);
                          const onActivate = () => {
                            if (disabled) return;
                            openRentalForVehicle(v.id);
                          };
                          return (
                            <TableRow
                              key={v.id}
                              role="button"
                              tabIndex={disabled ? -1 : 0}
                              title={disabled ? "Bakımda" : `${v.plate} — kiralama başlat`}
                              className={cn(!disabled && "cursor-pointer", disabled && "cursor-not-allowed opacity-55")}
                              onClick={onActivate}
                              onKeyDown={(e) => {
                                if (disabled) return;
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  onActivate();
                                }
                              }}
                            >
                              <TableCell>
                                <div className="relative h-12 w-16 overflow-hidden rounded-md bg-muted">
                                  {cover ? (
                                    <div
                                      className="h-full w-full bg-cover bg-center"
                                      style={{ backgroundImage: `url(${JSON.stringify(cover)})` }}
                                      aria-hidden
                                    />
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
                              <TableCell
                                className={cn(
                                  "text-right text-sm font-semibold tabular-nums",
                                  dailyLabel === "—" && "text-muted-foreground",
                                )}
                              >
                                {dailyLabel}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
                  {vehiclesForStartTab.length === 0 ? (
                    <p className="col-span-full py-6 text-center text-xs text-muted-foreground">
                      {allVehicles.length === 0
                        ? "Kayıtlı araç yok."
                        : "Aramanızla eşleşen araç yok. Plakayı boşluksuz veya marka + model şeklinde deneyin."}
                    </p>
                  ) : null}
                  {vehiclesForStartTab.map((v) => {
                    const disabled = Boolean(v.maintenance);
                    const cover = vehicleCardCoverUrl(v);
                    const dailyLabel = formatVehicleDailyRental(v);
                    const onActivate = () => {
                      if (disabled) return;
                      openRentalForVehicle(v.id);
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
                          !disabled &&
                            "border-border/55 hover:border-emerald-500/35 hover:shadow-md active:scale-[0.99]",
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
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                              Görsel yok
                            </div>
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
                            <p className="truncate font-mono text-[11px] font-semibold tracking-tight text-foreground sm:text-xs">
                              {v.plate}
                            </p>
                            <p className="truncate text-[9px] leading-tight text-muted-foreground sm:text-[10px]">
                              {v.brand} {v.model}
                            </p>
                            {disabled ? (
                              <p className="mt-0.5 text-[8px] font-medium text-destructive sm:text-[9px]">Bakımda</p>
                            ) : null}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-[8px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[9px]">
                              Günlük
                            </p>
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
              )}
            </ListingTableWell>
          </ListingPanel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
