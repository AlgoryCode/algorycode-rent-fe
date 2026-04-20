"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { startOfDay } from "date-fns";
import { LayoutGrid, List, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCountries } from "@/hooks/use-countries";
import { useFleetSessions } from "@/hooks/use-fleet-sessions";
import { useFleetVehicles } from "@/hooks/use-fleet-vehicles";
import { vehicleFleetStatus, type FleetStatus } from "@/lib/fleet-utils";
import { fetchRentalRequestsFromRentApi } from "@/lib/rent-api";
import { rentKeys } from "@/lib/rent-query-keys";
import { mergeVehicleImagesWithDemo } from "@/lib/vehicle-images";
import type { Vehicle } from "@/lib/mock-fleet";
import { cn } from "@/lib/utils";

const VEHICLES_VIEW_STORAGE_KEY = "algoryRent.vehiclesViewMode";

type VehiclesViewMode = "gallery" | "list";

function vehicleCoverUrl(vehicle: Vehicle) {
  const merged = mergeVehicleImagesWithDemo(vehicle.images, vehicle.id);
  return merged.front ?? merged.left ?? merged.right ?? merged.rear;
}

function statusBadge(status: FleetStatus) {
  switch (status) {
    case "available":
      return <Badge variant="success">Müsait</Badge>;
    case "rented":
      return <Badge variant="warning">Kirada</Badge>;
    case "maintenance":
      return <Badge variant="muted">Bakım</Badge>;
    default:
      return null;
  }
}

export function VehiclesClient() {
  const router = useRouter();
  const { allVehicles, ready, error: fleetError } = useFleetVehicles();
  const { allSessions } = useFleetSessions();
  const { data: rentalRequests = [] } = useQuery({
    queryKey: rentKeys.rentalRequests(),
    queryFn: () => fetchRentalRequestsFromRentApi(),
  });
  const { countryByCode } = useCountries();
  const [tab, setTab] = useState<"all" | FleetStatus>("all");
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<VehiclesViewMode>("gallery");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(VEHICLES_VIEW_STORAGE_KEY);
      if (stored === "gallery" || stored === "list") setViewMode(stored);
    } catch {
      /* private mode */
    }
  }, []);

  const setViewModePersist = (mode: VehiclesViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VEHICLES_VIEW_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  };

  const today = startOfDay(new Date());

  const rows = useMemo(() => {
    return allVehicles.map((v) => {
      const status = vehicleFleetStatus(v, allSessions, today, rentalRequests);
      return { v, status };
    });
  }, [allVehicles, allSessions, today, rentalRequests]);

  const filteredByTab = useMemo(() => {
    if (tab === "all") return rows;
    return rows.filter((r) => r.status === tab);
  }, [rows, tab]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return filteredByTab;
    return filteredByTab.filter(
      ({ v }) =>
        v.plate.toLowerCase().includes(q) ||
        v.brand.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        String(v.year).includes(q),
    );
  }, [filteredByTab, query]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Araçlar</h1>
          <p className="text-xs text-muted-foreground">
            Varsayılan galeri görünümü; isterseniz liste görünümüne geçin. Sekmelerle durum, arama ile plaka veya marka/model süzün. Karta tıklayarak detaya gidin.{" "}
            <span className="text-muted-foreground/90">
              “Kirada” rozeti, bugünü kapsayan kesin kiralamalar ile onaylı veya bekleyen kiralama taleplerini birlikte dikkate alır.
            </span>
          </p>
        </div>
        <Button size="sm" className="h-9 gap-1.5 shrink-0" asChild>
          <Link href="/vehicles/new">
            <Plus className="h-4 w-4" />
            Yeni araç
          </Link>
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="h-8">
          <TabsTrigger value="all" className="px-2.5 text-xs">
            Tümü
          </TabsTrigger>
          <TabsTrigger value="available" className="px-2.5 text-xs">
            Müsait
          </TabsTrigger>
          <TabsTrigger value="rented" className="px-2.5 text-xs">
            Kirada
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="px-2.5 text-xs">
            Bakım
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="glow-card">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Filo</CardTitle>
          <CardDescription>
            {!ready
              ? "Yükleniyor…"
              : fleetError
                ? `Liste yüklenemedi: ${fleetError}`
                : `${filtered.length} araç gösteriliyor (${allVehicles.length} toplam)`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-2 pb-3 sm:px-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="relative min-w-0 max-w-md flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Ara: plaka, marka, model…"
                className="h-9 pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Araç ara"
              />
            </div>
            <div
              className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border/80 bg-muted/30 p-0.5"
              role="group"
              aria-label="Görünüm"
            >
              <Button
                type="button"
                variant={viewMode === "gallery" ? "secondary" : "ghost"}
                size="sm"
                className={cn("h-8 gap-1.5 px-2.5 text-xs", viewMode === "gallery" && "shadow-sm")}
                aria-pressed={viewMode === "gallery"}
                onClick={() => setViewModePersist("gallery")}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Galeri
              </Button>
              <Button
                type="button"
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                className={cn("h-8 gap-1.5 px-2.5 text-xs", viewMode === "list" && "shadow-sm")}
                aria-pressed={viewMode === "list"}
                onClick={() => setViewModePersist("list")}
              >
                <List className="h-3.5 w-3.5" />
                Liste
              </Button>
            </div>
          </div>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Sonuç yok. Aramayı veya filtreyi değiştirin.</p>
          ) : viewMode === "gallery" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map(({ v, status }) => {
                const cc = v.countryCode?.toUpperCase();
                const countryMeta = cc ? countryByCode.get(cc) : undefined;
                const rowAccent = countryMeta?.colorCode ?? (cc ? "#94a3b8" : undefined);
                const cover = vehicleCoverUrl(v);
                return (
                  <Card
                    key={v.id}
                    role="link"
                    tabIndex={0}
                    aria-label={`${v.plate} ${v.brand} ${v.model}, detay`}
                    className="cursor-pointer overflow-hidden border-border/60 bg-card/80 text-sm shadow-sm transition-shadow hover:shadow-md"
                    onClick={() => router.push(`/vehicles/${v.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/vehicles/${v.id}`);
                      }
                    }}
                  >
                    <div className="relative aspect-[4/3] bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element -- data URL + harici demo URL */}
                      <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </div>
                    <CardContent className="space-y-2 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-mono text-xs font-semibold tracking-tight">{v.plate}</p>
                        {cc ? (
                          <div
                            className="h-4 w-4 shrink-0 rounded border border-border/60"
                            style={{ backgroundColor: rowAccent }}
                            title={countryMeta ? `${countryMeta.name} (${cc})` : `Bilinmeyen ülke: ${cc}`}
                            aria-hidden
                          />
                        ) : null}
                      </div>
                      <p className="truncate text-xs">
                        <span className="font-medium text-foreground">{v.brand}</span>{" "}
                        <span className="text-muted-foreground">{v.model}</span>
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">{v.year}</span>
                        {statusBadge(status)}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map(({ v, status }) => {
                const cc = v.countryCode?.toUpperCase();
                const countryMeta = cc ? countryByCode.get(cc) : undefined;
                const rowAccent = countryMeta?.colorCode ?? (cc ? "#94a3b8" : undefined);
                const cover = vehicleCoverUrl(v);
                return (
                  <Card
                    key={v.id}
                    role="link"
                    tabIndex={0}
                    aria-label={`${v.plate} ${v.brand} ${v.model}, detay`}
                    className="cursor-pointer overflow-hidden border-border/60 bg-card/80 shadow-sm transition-shadow hover:shadow-md"
                    onClick={() => router.push(`/vehicles/${v.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/vehicles/${v.id}`);
                      }
                    }}
                  >
                    <CardContent className="flex gap-3 p-3 sm:gap-4">
                      <div className="relative h-[4.5rem] w-[6.5rem] shrink-0 overflow-hidden rounded-md bg-muted sm:h-20 sm:w-28">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-mono text-xs font-semibold">{v.plate}</span>
                          {cc ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <span
                                className="h-3.5 w-3.5 shrink-0 rounded border border-border/60"
                                style={{ backgroundColor: rowAccent }}
                                title={countryMeta ? `${countryMeta.name} (${cc})` : `Bilinmeyen ülke: ${cc}`}
                                aria-hidden
                              />
                              <span className="font-mono">{cc}</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Ülke —</span>
                          )}
                        </div>
                        <p className="truncate text-sm">
                          <span className="font-medium">{v.brand}</span>{" "}
                          <span className="text-muted-foreground">{v.model}</span>
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground">{v.year}</span>
                          {statusBadge(status)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
