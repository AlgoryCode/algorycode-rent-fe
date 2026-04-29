"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, Download, Search, SquarePen } from "lucide-react";
import { toast } from "sonner";
import { AddEntityLink } from "@/components/ui/add-entity-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListingPanel, ListingTableWell, ListingToolbar } from "@/components/ui/listing-panel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCountries } from "@/hooks/use-countries";
import { useFleetSessions } from "@/hooks/use-fleet-sessions";
import { useFleetVehicles } from "@/hooks/use-fleet-vehicles";
import { vehicleFleetStatus, type FleetStatus } from "@/lib/fleet-utils";
import { fetchRentalRequestsFromRentApi, fetchVehicleFormCatalogFromRentApi } from "@/lib/rent-api";
import { rentKeys } from "@/lib/rent-query-keys";
import { mergeVehicleImagesWithDemo } from "@/lib/vehicle-images";
import type { Vehicle } from "@/lib/mock-fleet";
import { cn } from "@/lib/utils";

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
  const queryClient = useQueryClient();
  const { allVehicles, ready, error: fleetError } = useFleetVehicles();
  const { allSessions } = useFleetSessions();
  const { data: rentalRequests = [] } = useQuery({
    queryKey: rentKeys.rentalRequests(),
    queryFn: () => fetchRentalRequestsFromRentApi(),
  });
  const { countryByCode } = useCountries();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | FleetStatus>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | FleetStatus>("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

  const today = startOfDay(new Date());

  const rows = useMemo(() => {
    return allVehicles.map((v) => {
      const status = vehicleFleetStatus(v, allSessions, today, rentalRequests);
      return { v, status };
    });
  }, [allVehicles, allSessions, today, rentalRequests]);

  const filteredByCategory = useMemo(() => {
    if (categoryFilter === "all") return rows;
    return rows.filter((r) => r.status === categoryFilter);
  }, [rows, categoryFilter]);

  const filteredByStatus = useMemo(() => {
    if (statusFilter === "all") return filteredByCategory;
    return filteredByCategory.filter((r) => r.status === statusFilter);
  }, [filteredByCategory, statusFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return filteredByStatus;
    return filteredByStatus.filter(
      ({ v }) =>
        v.plate.toLowerCase().includes(q) ||
        v.brand.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        String(v.year).includes(q),
    );
  }, [filteredByStatus, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  const handleExport = async () => {
    if (filtered.length === 0) {
      toast.message("Dışa aktarılacak araç yok.");
      return;
    }
    const XLSX = await import("xlsx");
    const exportRows = filtered.map(({ v, status }) => ({
      Plate: v.plate,
      Brand: v.brand,
      Model: v.model,
      Year: v.year,
      Status: status === "available" ? "Müsait" : status === "rented" ? "Kirada" : "Bakım",
      FuelType: v.fuelType ?? "",
      Transmission: v.transmissionType ?? "",
      DailyRateEUR: v.rentalDailyPrice ?? "",
      CountryCode: v.countryCode ?? "",
      External: v.external ? "Evet" : "Hayır",
      ExternalCompany: v.externalCompany ?? "",
    }));
    const sheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Vehicles");
    const d = new Date();
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    XLSX.writeFile(workbook, `vehicles-${dateKey}.xlsx`);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fleet Inventory</h1>
        </div>
        <AddEntityLink
          href="/vehicles/new"
          label="Yeni araç"
          onClick={() => {
            void queryClient.prefetchQuery({
              queryKey: rentKeys.vehicleFormCatalog(),
              queryFn: fetchVehicleFormCatalogFromRentApi,
            });
          }}
        />
      </div>

      <ListingPanel>
        <ListingToolbar>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.3fr_0.8fr_0.8fr_auto] md:items-end">
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Search Fleet</p>
                  <div className="relative min-w-0">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Model veya marka ara..."
                      className="h-10 border-border/80 bg-background pl-9"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setPage(1);
                      }}
                      aria-label="Araç ara"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Category</p>
                  <Select
                    value={categoryFilter}
                    onValueChange={(v) => {
                      setCategoryFilter(v as typeof categoryFilter);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="h-10 border-border/80 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="available">Müsait</SelectItem>
                      <SelectItem value="rented">Kirada</SelectItem>
                      <SelectItem value="maintenance">Bakım</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</p>
                  <Select
                    value={statusFilter}
                    onValueChange={(v) => {
                      setStatusFilter(v as typeof statusFilter);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="h-10 border-border/80 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="available">Müsait</SelectItem>
                      <SelectItem value="rented">Kirada</SelectItem>
                      <SelectItem value="maintenance">Bakım</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <Button type="button" size="sm" className="h-10 gap-1.5 px-4" onClick={() => void handleExport()}>
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                </div>
              </div>
        </ListingToolbar>

        <ListingTableWell>
              {!ready ? (
                <p className="py-12 text-center text-sm text-muted-foreground">Yükleniyor…</p>
              ) : fleetError ? (
                <p className="py-8 text-center text-sm text-destructive">Liste yüklenemedi: {fleetError}</p>
              ) : (
                <>
                  {pagedRows.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">Sonuç yok. Aramayı veya filtreyi değiştirin.</p>
                  ) : (
                    <Table className="min-w-[800px]">
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="min-w-[220px]">Araç</TableHead>
                          <TableHead className="whitespace-nowrap">Plaka</TableHead>
                          <TableHead>Durum</TableHead>
                          <TableHead className="min-w-[120px]">Yakıt / Vites</TableHead>
                          <TableHead className="text-right whitespace-nowrap">Günlük</TableHead>
                          <TableHead className="w-[100px] text-right">İşlem</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedRows.map(({ v, status }) => {
                          const cc = v.countryCode?.toUpperCase();
                          const countryMeta = cc ? countryByCode.get(cc) : undefined;
                          const rowAccent = countryMeta?.colorCode ?? (cc ? "#94a3b8" : undefined);
                          const cover = vehicleCoverUrl(v);
                          return (
                            <TableRow
                              key={v.id}
                              role="link"
                              tabIndex={0}
                              aria-label={`${v.plate} ${v.brand} ${v.model}, detay`}
                              className="cursor-pointer"
                              onClick={() => router.push(`/vehicles/${v.id}`)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  router.push(`/vehicles/${v.id}`);
                                }
                              }}
                            >
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md bg-muted md:h-16 md:w-24">
                                    {cover ? (
                                      <>
                                        {/* eslint-disable-next-line @next/next/no-img-element -- data URL + harici demo URL */}
                                        <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" />
                                      </>
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                                        —
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-foreground">
                                      {v.brand} {v.model}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                      {v.year}
                                      {cc ? ` · ${countryMeta?.name ?? cc}` : ""}
                                    </p>
                                    {cc ? (
                                      <span className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                        <span
                                          className="h-3 w-3 shrink-0 rounded border border-border/60"
                                          style={{ backgroundColor: rowAccent }}
                                          aria-hidden
                                        />
                                        <span className="font-mono">{cc}</span>
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-sm font-medium">{v.plate}</TableCell>
                              <TableCell>{statusBadge(status)}</TableCell>
                              <TableCell className="text-xs text-muted-foreground md:text-sm">
                                <p className="text-foreground">{v.fuelType ?? "—"}</p>
                                <p>{v.transmissionType ?? "—"}</p>
                              </TableCell>
                              <TableCell className="text-right text-sm font-semibold tabular-nums text-foreground">
                                {v.rentalDailyPrice != null
                                  ? `€${v.rentalDailyPrice.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
                                  : "—"}
                                <span className="ml-1 text-[11px] font-normal text-muted-foreground">/DAY</span>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/vehicles/${v.id}`);
                                  }}
                                >
                                  <SquarePen className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}

                  <div className="flex flex-col gap-2 border-t border-border/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <p className="text-xs text-muted-foreground">
                      Showing {(safePage - 1) * PAGE_SIZE + (pagedRows.length ? 1 : 0)}-
                      {(safePage - 1) * PAGE_SIZE + pagedRows.length} of {filtered.length} vehicles
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={safePage <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      {Array.from({ length: Math.min(totalPages, 3) }, (_, i) => {
                        const p = i + 1;
                        return (
                          <Button
                            key={p}
                            type="button"
                            variant={p === safePage ? "default" : "outline"}
                            size="sm"
                            className={cn("h-8 min-w-8 px-2", p === safePage && "shadow-sm")}
                            onClick={() => setPage(p)}
                          >
                            {p}
                          </Button>
                        );
                      })}
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={safePage >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
  );
}
