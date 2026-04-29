"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, KeyRound, LayoutGrid, List, ScrollText, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RentalLogEntries } from "@/components/rental-logs/rental-log-entries";
import { RentalLogFiltersBar } from "@/components/rental-logs/rental-log-filters-bar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFleetVehicles } from "@/hooks/use-fleet-vehicles";
import {
  emptyRentalLogFilters,
  filterRentalLogSessions,
  sortSessionsByLogTimeDesc,
  type RentalLogFilterValues,
} from "@/lib/rental-log-filters";
import { fetchRentalsFromRentApi, getRentApiErrorMessage } from "@/lib/rent-api";
import { rentKeys } from "@/lib/rent-query-keys";
import type { Vehicle } from "@/lib/mock-fleet";
import { vehiclePlate } from "@/lib/rental-metadata";
import { mergeVehicleImagesWithDemo, type VehicleImageSlot } from "@/lib/vehicle-images";
import { cn } from "@/lib/utils";

type VehicleStartView = "gallery" | "list";

const CARD_COVER_ORDER: VehicleImageSlot[] = ["front", "left", "right", "rear", "interiorDash", "interiorRear"];

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

export function RentalLogsClient() {
  const router = useRouter();
  const { allVehicles } = useFleetVehicles();
  const [draftFilters, setDraftFilters] = useState<RentalLogFilterValues>(emptyRentalLogFilters);
  const [filters, setFilters] = useState<RentalLogFilterValues>(emptyRentalLogFilters);
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [vehicleStartView, setVehicleStartView] = useState<VehicleStartView>("gallery");

  const vehiclesById = useMemo(() => new Map(allVehicles.map((v) => [v.id, v])), [allVehicles]);

  const vehiclesForStartTab = useMemo(
    () => allVehicles.filter((v) => vehicleMatchesSearch(v, vehicleSearch)),
    [allVehicles, vehicleSearch],
  );

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

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <CalendarDays className="h-5 w-5 text-primary" />
          Kiralamalar
        </h1>
        <p className="text-xs text-muted-foreground">
          Tüm filo kiralama kayıtlarını inceleyin; araç seçerek yeni kiralama başlatmak için «Kiralama başlat» sekmesine geçin.
        </p>
      </div>

      <Tabs defaultValue="logs" className="w-full">
        <TabsList className="h-9 w-full justify-start gap-1 overflow-x-auto sm:w-auto">
          <TabsTrigger value="logs" className="gap-1.5 text-xs">
            <ScrollText className="h-3.5 w-3.5" />
            Kiralamalar
          </TabsTrigger>
          <TabsTrigger value="start" className="gap-1.5 text-xs">
            <KeyRound className="h-3.5 w-3.5" />
            Kiralama başlat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="mt-4">
          <Card className="glow-card">
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Kiralamalar</CardTitle>
              <CardDescription className="text-xs">
                {sessionsLoading
                  ? "Yükleniyor..."
                  : sessionsError
                    ? getRentApiErrorMessage(sessionsError)
                    : `${filteredSessions.length} kayıt gösteriliyor · toplam ${allSessions.length} seans.`}{" "}
                Müşteri özetleri için{" "}
                <Link href="/customers" className="font-medium text-primary underline-offset-2 hover:underline">
                  Müşteriler
                </Link>
                .
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RentalLogFiltersBar
                values={draftFilters}
                onChange={setDraftFilters}
                showVehicleQuery
                manualApply
                onApply={() => setFilters(draftFilters)}
              />
              <RentalLogEntries
                sessions={filteredSessions}
                plateOf={(s) => ({ plate: vehiclePlate(vehiclesById, s.vehicleId), vehicleId: s.vehicleId })}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="start" className="mt-4 space-y-4">
          <Card className="glow-card">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm">Araç seçin</CardTitle>
              <CardDescription className="text-xs">
                Plaka, marka, model veya yıl ile arayın. Araç kartına tıklayınca kiralama formu açılır.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
              <div
                className={cn(
                  vehicleStartView === "gallery"
                    ? "grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3"
                    : "flex flex-col gap-2",
                )}
              >
                {vehiclesForStartTab.length === 0 ? (
                  <p
                    className={cn(
                      "py-6 text-center text-xs text-muted-foreground",
                      vehicleStartView === "gallery" && "col-span-full",
                    )}
                  >
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

                  if (vehicleStartView === "list") {
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={disabled}
                        title={disabled ? "Bakımda" : `${v.plate} — kiralama başlat`}
                        onClick={onActivate}
                        className={cn(
                          "group flex w-full items-center gap-3 overflow-hidden rounded-xl border bg-card p-2 text-left shadow-sm outline-none transition-[box-shadow,transform,border-color] focus-visible:ring-2 focus-visible:ring-ring",
                          disabled && "cursor-not-allowed opacity-55",
                          !disabled &&
                            "border-border/55 hover:border-emerald-500/35 hover:shadow-md active:scale-[0.995]",
                        )}
                      >
                        <div className="relative h-14 w-[4.5rem] shrink-0 overflow-hidden rounded-md bg-muted sm:h-16 sm:w-24">
                          {cover ? (
                            <div
                              className="h-full w-full bg-cover bg-center transition-transform duration-300 group-hover:scale-105 group-disabled:grayscale"
                              style={{ backgroundImage: `url(${JSON.stringify(cover)})` }}
                              aria-hidden
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center px-0.5 text-center text-[9px] leading-tight text-muted-foreground">
                              Görsel yok
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-sm font-semibold tracking-tight text-foreground">{v.plate}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {v.brand} {v.model}
                          </p>
                          {disabled ? (
                            <p className="mt-0.5 text-[10px] font-medium text-destructive">Bakımda</p>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Günlük</p>
                          <p
                            className={cn(
                              "text-sm font-semibold tabular-nums leading-tight text-foreground",
                              dailyLabel === "—" && "text-muted-foreground",
                            )}
                          >
                            {dailyLabel}
                          </p>
                        </div>
                      </button>
                    );
                  }

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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
