"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { startOfDay } from "date-fns";
import {
  ArrowDownUp,
  BarChart3,
  BatteryCharging,
  CarFront,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Fuel,
  ListFilter,
  ListChecks,
  Plus,
  PlusCircle,
  Search,
  SquarePen,
  Wrench,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { AddEntityLink } from "@/components/ui/add-entity-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListingPanel, ListingTableWell, ListingToolbar } from "@/components/ui/listing-panel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCountries } from "@/hooks/use-countries";
import { useFleetSessions } from "@/hooks/use-fleet-sessions";
import { useFleetVehicles } from "@/hooks/use-fleet-vehicles";
import { resolveVehicleFleetUiStatus, type FleetStatus } from "@/lib/fleet-utils";
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

function stableHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function vehiclePseudoMileageKm(v: Vehicle): number {
  return 3000 + (stableHash(v.id) % 45000);
}

function vehiclePseudoFuelPct(v: Vehicle): number {
  return 12 + (stableHash(`${v.id}:fuel`) % 87);
}

function isElectricFuelType(ft?: string): boolean {
  if (!ft) return false;
  const s = ft.toLowerCase();
  return s.includes("elektrik") || s.includes("electric") || s.includes("ev") || s.includes("tesla");
}

function fleetStatusBadgeClass(status: FleetStatus): string {
  switch (status) {
    case "available":
      return "border border-primary/35 bg-primary/12 text-primary";
    case "rented":
      return "border border-blue-200 bg-blue-100 text-blue-700";
    case "maintenance":
      return "border border-amber-200 bg-amber-100 text-amber-700";
    default:
      return "border border-border bg-muted text-muted-foreground";
  }
}

export function VehiclesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [sortBy, setSortBy] = useState<"mileage" | "year">("mileage");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const PAGE_SIZE = 8;
  const showMobileList = searchParams.get("sekme") === "liste";

  const today = startOfDay(new Date());

  const rows = useMemo(() => {
    return allVehicles.map((v) => {
      const status = resolveVehicleFleetUiStatus(v, allSessions, today, rentalRequests);
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

  const sortedRows = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      if (sortBy === "year") {
        const cmp = a.v.year - b.v.year;
        return sortDir === "asc" ? cmp : -cmp;
      }
      const cmp = vehiclePseudoMileageKm(a.v) - vehiclePseudoMileageKm(b.v);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortBy, sortDir]);

  const isQuickFilterActive = (s: "all" | FleetStatus) => {
    if (s === "all") return categoryFilter === "all" && statusFilter === "all";
    return (categoryFilter === "all" && statusFilter === s) || (categoryFilter === s && statusFilter === "all");
  };

  const applyQuickFilter = (s: "all" | FleetStatus) => {
    if (s === "all") {
      setCategoryFilter("all");
      setStatusFilter("all");
    } else {
      setCategoryFilter("all");
      setStatusFilter(s);
    }
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return sortedRows.slice(start, start + PAGE_SIZE);
  }, [sortedRows, safePage]);

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

  const toggleSortMileage = () => {
    if (sortBy === "mileage") setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy("mileage");
      setSortDir("desc");
    }
    setPage(1);
  };

  const toggleSortYear = () => {
    if (sortBy === "year") setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy("year");
      setSortDir("desc");
    }
    setPage(1);
  };

  return (
    <>
      <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
        <SheetContent side="right" className="flex w-[min(100vw,20rem)] flex-col gap-0 border-l bg-background p-0">
          <SheetHeader className="border-b border-border px-4 py-4 text-left">
            <p className="text-base font-semibold">Filtreler</p>
            <p className="text-xs text-muted-foreground">Kategori ve durum</p>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Kategori</p>
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
                  <SelectItem value="all">Tümü</SelectItem>
                  <SelectItem value="available">Müsait</SelectItem>
                  <SelectItem value="rented">Kirada</SelectItem>
                  <SelectItem value="maintenance">Bakım</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Durum</p>
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
                  <SelectItem value="all">Tümü</SelectItem>
                  <SelectItem value="available">Müsait</SelectItem>
                  <SelectItem value="rented">Kirada</SelectItem>
                  <SelectItem value="maintenance">Bakım</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              className="h-10 gap-2 bg-[#006591] text-white hover:bg-[#005580]"
              onClick={() => {
                void handleExport();
                setFilterSheetOpen(false);
              }}
            >
              <Download className="h-4 w-4" />
              Excel dışa aktar
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <div className="mx-auto max-w-[92rem] space-y-4 lg:space-y-5">
      <div className={cn("mx-auto w-full max-w-md space-y-4 px-4 pt-1 lg:hidden", showMobileList && "hidden")}>
        <div className="px-1">
          <p className="text-[11px] uppercase tracking-[0.12em] text-primary">Operations</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">Vehicle Management</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className="aspect-square rounded-xl border border-border bg-card p-3 transition-colors hover:bg-tertiary/30 active:scale-95"
            onClick={() => router.push("/vehicles?sekme=liste")}
          >
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                <CarFront className="h-7 w-7" />
              </div>
              <span className="text-center text-sm font-semibold text-foreground">View Vehicles</span>
            </div>
          </button>
          <button
            type="button"
            className="aspect-square rounded-xl border border-border bg-card p-3 transition-colors hover:bg-tertiary/30 active:scale-95"
            onClick={() => {
              void queryClient.prefetchQuery({
                queryKey: rentKeys.vehicleFormCatalog(),
                queryFn: fetchVehicleFormCatalogFromRentApi,
              });
              router.push("/vehicles/new");
            }}
          >
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/25 text-secondary-foreground">
                <PlusCircle className="h-7 w-7" />
              </div>
              <span className="text-center text-sm font-semibold text-foreground">Register New Vehicle</span>
            </div>
          </button>
          <button
            type="button"
            className="aspect-square rounded-xl border border-border bg-card p-3 transition-colors hover:bg-tertiary/30 active:scale-95"
            onClick={() => router.push("/settings/options/vehicle")}
          >
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-tertiary text-tertiary-foreground">
                <Wrench className="h-7 w-7" />
              </div>
              <span className="text-center text-sm font-semibold text-foreground">Additional Services</span>
            </div>
          </button>
          <button
            type="button"
            className="aspect-square rounded-xl border border-border bg-card p-3 transition-colors hover:bg-tertiary/30 active:scale-95"
            onClick={() => router.push("/settings/vehicle-catalog")}
          >
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                <ListChecks className="h-7 w-7" />
              </div>
              <span className="text-center text-sm font-semibold text-foreground">Vehicle Features</span>
            </div>
          </button>
          <button
            type="button"
            className="aspect-square rounded-xl border border-border bg-card p-3 transition-colors hover:bg-tertiary/30 active:scale-95"
            onClick={() => router.push("/logs")}
          >
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <ClipboardList className="h-7 w-7" />
              </div>
              <span className="text-center text-sm font-semibold text-foreground">Maintenance Log</span>
            </div>
          </button>
          <button
            type="button"
            className="aspect-square rounded-xl border border-border bg-card p-3 transition-colors hover:bg-tertiary/30 active:scale-95"
            onClick={() => router.push("/reports")}
          >
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/25 text-secondary-foreground">
                <BarChart3 className="h-7 w-7" />
              </div>
              <span className="text-center text-sm font-semibold text-foreground">Analytics</span>
            </div>
          </button>
        </div>
      </div>

      <div className={cn("mx-auto w-full max-w-md space-y-4 px-4 pt-1 lg:hidden", !showMobileList && "hidden")}>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <Input
                placeholder="Araç ara…"
                className="h-12 rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm shadow-sm ring-[#0ea5e9]/30 placeholder:text-slate-400 focus-visible:border-[#0ea5e9] focus-visible:ring-2"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                aria-label="Araç ara"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-12 w-12 shrink-0 rounded-xl border-slate-200 bg-white shadow-sm active:scale-95"
              aria-label="Filtreler"
              onClick={() => setFilterSheetOpen(true)}
            >
              <ListFilter className="h-5 w-5 text-[#006591]" />
            </Button>
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(
              [
                { key: "all" as const, label: "Tümü" },
                { key: "available" as const, label: "Müsait" },
                { key: "rented" as const, label: "Kirada" },
                { key: "maintenance" as const, label: "Bakım" },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => applyQuickFilter(key)}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-full px-5 py-2 text-xs font-medium tracking-wide transition active:scale-95",
                  isQuickFilterActive(key)
                    ? "bg-[#006591] font-semibold text-white shadow-md"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between border-b border-slate-200 px-1 py-2">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
            {filtered.length} araç bulundu
          </span>
          <div className="flex gap-4">
            <button
              type="button"
              className={cn(
                "flex items-center gap-1 text-xs font-medium transition active:opacity-70",
                sortBy === "mileage" ? "text-[#006591]" : "text-slate-500",
              )}
              onClick={toggleSortMileage}
            >
              <span>Kilometreye göre</span>
              <ArrowDownUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={cn(
                "flex items-center gap-1 text-xs font-medium transition active:opacity-70",
                sortBy === "year" ? "text-[#006591]" : "text-slate-500",
              )}
              onClick={toggleSortYear}
            >
              <span>Yıl</span>
            </button>
          </div>
        </div>
      </div>

      <div className="hidden flex-col gap-3 lg:flex lg:flex-row lg:items-end lg:justify-between">
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

      <ListingPanel className={cn("lg:block", !showMobileList && "hidden")}>
        <ListingToolbar className="hidden lg:block">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.3fr_0.8fr_0.8fr_auto] lg:items-end">
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
                  {filtered.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">Sonuç yok. Aramayı veya filtreyi değiştirin.</p>
                  ) : (
                    <>
                      <div className="space-y-3 px-4 pb-8 pt-1 lg:hidden">
                        {pagedRows.map(({ v, status }) => {
                          const cover = vehicleCoverUrl(v);
                          const pct = vehiclePseudoFuelPct(v);
                          const mileageKm = vehiclePseudoMileageKm(v);
                          const FuelIcon = isElectricFuelType(v.fuelType) ? BatteryCharging : Fuel;
                          const statusUpper =
                            status === "available" ? "MÜSAİT" : status === "rented" ? "KİRADA" : "BAKIM";
                          return (
                            <button
                              key={`m-${v.id}`}
                              type="button"
                              className="flex w-full gap-4 rounded-xl border border-slate-100 bg-white p-3 text-left shadow-sm transition duration-200 hover:shadow-md active:scale-[0.99]"
                              onClick={() => router.push(`/vehicles/${v.id}`)}
                            >
                              <div className="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                                {cover ? (
                                  <>
                                    {/* eslint-disable-next-line @next/next/no-img-element -- data URL + harici demo URL */}
                                    <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" />
                                  </>
                                ) : (
                                  <span className="text-xs text-slate-400">—</span>
                                )}
                              </div>
                              <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-base font-semibold leading-tight text-slate-900">
                                      {v.brand} {v.model}
                                    </p>
                                    <p className="mt-0.5 font-mono text-xs tabular-nums text-slate-500">{v.plate}</p>
                                  </div>
                                  <span
                                    className={cn(
                                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                                      fleetStatusBadgeClass(status),
                                    )}
                                  >
                                    {statusUpper}
                                  </span>
                                </div>
                                <div className="mt-2 flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <FuelIcon className="h-4 w-4 shrink-0 text-[#006591]" aria-hidden />
                                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                                      <div
                                        className="h-full rounded-full bg-[#006591]"
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                    <span className="text-[11px] font-medium tabular-nums text-slate-600">{pct}%</span>
                                  </div>
                                  <span className="text-[11px] tabular-nums text-slate-400">
                                    {mileageKm.toLocaleString("tr-TR")} km
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <div className="hidden lg:block">
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
                                      <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md bg-muted lg:h-16 lg:w-24">
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
                                  <TableCell className="text-xs text-muted-foreground lg:text-sm">
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
                      </div>
                    </>
                  )}

                  {filtered.length > 0 ? (
                    <div className="flex flex-col gap-2 border-t border-border/80 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-5">
                      <p className="text-xs text-muted-foreground">
                        <span className="lg:hidden">
                          {(safePage - 1) * PAGE_SIZE + (pagedRows.length ? 1 : 0)}-
                          {(safePage - 1) * PAGE_SIZE + pagedRows.length} / {filtered.length} araç
                        </span>
                        <span className="hidden lg:inline">
                          Showing {(safePage - 1) * PAGE_SIZE + (pagedRows.length ? 1 : 0)}-
                          {(safePage - 1) * PAGE_SIZE + pagedRows.length} of {filtered.length} vehicles
                        </span>
                      </p>
                      <div className="flex items-center justify-center gap-1 lg:justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-full lg:h-8 lg:w-8 lg:rounded-md"
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
                              variant="outline"
                              size="sm"
                              className={cn(
                                "h-9 min-w-9 px-2 rounded-full lg:h-8 lg:min-w-8 lg:rounded-md",
                                p === safePage &&
                                  "border-sky-500 bg-sky-500 text-white shadow-sm hover:bg-sky-600 hover:text-white",
                              )}
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
                          className="h-9 w-9 rounded-full lg:h-8 lg:w-8 lg:rounded-md"
                          disabled={safePage >= totalPages}
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </ListingTableWell>
      </ListingPanel>

      <Button
        type="button"
        className="fixed bottom-20 right-6 z-40 hidden h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-primary text-primary-foreground shadow-lg transition-transform hover:bg-primary/90 active:scale-95 lg:hidden"
        aria-label="Yeni araç"
        onClick={() => {
          void queryClient.prefetchQuery({
            queryKey: rentKeys.vehicleFormCatalog(),
            queryFn: fetchVehicleFormCatalogFromRentApi,
          });
          router.push("/vehicles/new");
        }}
      >
        <Plus className="h-7 w-7" />
      </Button>
      </div>
    </>
  );
}
