"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { startOfDay } from "date-fns";
import { LayoutGrid, List, Search } from "lucide-react";

import { toast } from "@/components/ui/sonner";
import { RentalLogsFleetMetrics } from "@/components/rental-logs/shared/rental-logs-fleet-metrics";
import {
  PAGE_SIZE,
  rentalDayCount,
  sessionNetTotal,
  sessionStatus,
  vehicleMatchesSearch,
} from "@/components/rental-logs/shared/rental-logs-helpers";
import { RentalStartVehicleGalleryResponsive } from "@/components/rental-logs/shared/rental-start-vehicle-gallery";
import { RentalLogsHubMenuMobile } from "@/components/rental-logs/mobile/rental-logs-hub-menu";
import { RentalLogsListToolbarMobile } from "@/components/rental-logs/mobile/rental-logs-list-toolbar";
import { RentalLogsNewRentalFabMobile } from "@/components/rental-logs/mobile/rental-logs-new-rental-fab";
import { RentalLogsSessionCardsMobile } from "@/components/rental-logs/mobile/rental-logs-session-cards";
import { RentalStartVehicleRowsMobile } from "@/components/rental-logs/mobile/rental-start-vehicle-rows";
import { RentalLogsFilterPanelDesktop } from "@/components/rental-logs/desktop/rental-logs-filter-panel";
import { RentalLogsHubMenuDesktop } from "@/components/rental-logs/desktop/rental-logs-hub-menu";
import { RentalLogsPageHeaderDesktop } from "@/components/rental-logs/desktop/rental-logs-page-header";
import { RentalLogsSessionPaginationDesktop } from "@/components/rental-logs/desktop/rental-logs-session-pagination";
import { RentalLogsSessionTableDesktop } from "@/components/rental-logs/desktop/rental-logs-session-table";
import { RentalStartVehicleTableDesktop } from "@/components/rental-logs/desktop/rental-start-vehicle-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListingPanel, ListingTableWell } from "@/components/ui/listing-panel";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useFleetSessions } from "@/hooks/use-fleet-sessions";
import { useFleetVehicles } from "@/hooks/use-fleet-vehicles";
import { resolveVehicleFleetUiStatus } from "@/lib/fleet-utils";
import { vehicleNewRentHref } from "@/lib/vehicle-new-rent-route";
import {
  emptyRentalLogFilters,
  filterRentalLogSessions,
  sortSessionsByLogTimeDesc,
  type RentalLogFilterValues,
} from "@/lib/rental-log-filters";
import { fetchRentalsFromRentApi, getRentApiErrorMessage } from "@/lib/rent-api";
import { rentKeys } from "@/lib/rent-query-keys";
import { vehiclePlate } from "@/lib/rental-metadata";
import { RENTAL_STATUS_LABEL } from "@/lib/rental-status";
import { RequestsClient } from "../requests/requests-client";

type VehicleStartView = "gallery" | "list";

type LogTab = "logs" | "start" | "requests" | "menu";

export function RentalLogsClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sekme = searchParams.get("sekme");
  const logTab: LogTab =
    pathname === "/logs/requests" || sekme === "istekler"
      ? "requests"
      : pathname === "/logs/start" || sekme === "baslat"
        ? "start"
        : pathname === "/logs/list" || sekme === "liste"
          ? "logs"
          : "menu";

  const navigateLogTab = (next: LogTab) => {
    if (next === "requests") router.push("/logs/requests", { scroll: false });
    else if (next === "start") router.push("/logs/start", { scroll: false });
    else if (next === "logs") router.push("/logs/list", { scroll: false });
    else router.push("/logs", { scroll: false });
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
      const st = resolveVehicleFleetUiStatus(v, fleetSessions, today);
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
    router.push(vehicleNewRentHref(vehicleId));
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
      const net = sessionNetTotal(s, v);
      const est = net != null ? Math.round(net * 100) / 100 : "";
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

  const openSessionDetail = (sessionId: string) => {
    router.push(`/rentals/${sessionId}`);
  };

  const applyMobileCustomerSearch = (value: string) => {
    setDraftFilters((f) => ({ ...f, customerQuery: value }));
    setFilters((f) => ({ ...f, customerQuery: value }));
  };

  const applyMobileStatus = (status: RentalLogFilterValues["status"]) => {
    setDraftFilters((f) => ({ ...f, status }));
    setFilters((f) => ({ ...f, status }));
  };

  return (
    <div className="mx-auto max-w-[92rem] space-y-8">
      <RentalLogsPageHeaderDesktop onExport={() => void handleExport()} onNewRental={() => navigateLogTab("start")} />

      <Tabs value={logTab} onValueChange={(v) => navigateLogTab(v as LogTab)} className="w-full">
        {logTab === "menu" ? <RentalLogsHubMenuMobile logTab={logTab} onNavigate={(t) => navigateLogTab(t)} /> : null}

        <TabsContent value="logs" className="mt-5">
          <div className="space-y-5">
            <RentalLogsListToolbarMobile
              customerQuery={draftFilters.customerQuery}
              activeStatus={filters.status}
              onCustomerQueryChange={applyMobileCustomerSearch}
              onStatusChange={applyMobileStatus}
            />
            <RentalLogsFilterPanelDesktop
              draftFilters={draftFilters}
              setDraftFilters={setDraftFilters}
              onApply={() => setFilters(draftFilters)}
              statusLine={statusLine}
            />
            <ListingPanel className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <ListingTableWell className="rounded-none border-0">
                {sessionsLoading && allSessions.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">Kiralamalar yükleniyor…</p>
                ) : filteredSessions.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">Filtreye uygun kiralama yok.</p>
                ) : (
                  <>
                    <RentalLogsSessionCardsMobile sessions={pagedSessions} vehiclesById={vehiclesById} onOpenSession={openSessionDetail} />
                    <RentalLogsSessionTableDesktop
                      sessions={pagedSessions}
                      vehiclesById={vehiclesById}
                      onOpenSession={openSessionDetail}
                    />
                    <RentalLogsSessionPaginationDesktop
                      totalFiltered={filteredSessions.length}
                      safePage={safePage}
                      totalPages={totalPages}
                      onPrev={() => setPage((p) => Math.max(1, p - 1))}
                      onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
                    />
                  </>
                )}
              </ListingTableWell>
            </ListingPanel>
            <RentalLogsNewRentalFabMobile onClick={() => navigateLogTab("start")} />
          </div>

          <RentalLogsFleetMetrics metrics={fleetMetrics} />
        </TabsContent>

        <TabsContent value="menu" className="mt-5">
          <RentalLogsHubMenuDesktop
            onNavigateList={() => navigateLogTab("logs")}
            onNavigateStart={() => navigateLogTab("start")}
            onNavigateRequests={() => navigateLogTab("requests")}
          />
        </TabsContent>

        <TabsContent value="requests" className="mt-5">
          <RequestsClient embedded />
        </TabsContent>

        <TabsContent value="start" className="mt-5 space-y-4">
          <ListingPanel>
            <ListingTableWell className="p-4 lg:p-5">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
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
                <div className="flex shrink-0 rounded-lg border border-border/70 bg-muted/30 p-0.5" role="group" aria-label="Görünüm">
                  <Button
                    type="button"
                    variant={vehicleStartView === "gallery" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-8 flex-1 gap-1.5 px-2.5 text-xs lg:flex-initial"
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
                    className="h-8 flex-1 gap-1.5 px-2.5 text-xs lg:flex-initial"
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
                  <>
                    <RentalStartVehicleRowsMobile vehicles={vehiclesForStartTab} onSelectVehicle={openRentalForVehicle} />
                    <RentalStartVehicleTableDesktop vehicles={vehiclesForStartTab} onSelectVehicle={openRentalForVehicle} />
                  </>
                )
              ) : (
                <RentalStartVehicleGalleryResponsive
                  vehicles={vehiclesForStartTab}
                  allVehiclesEmpty={allVehicles.length === 0}
                  onSelectVehicle={openRentalForVehicle}
                />
              )}
            </ListingTableWell>
          </ListingPanel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
