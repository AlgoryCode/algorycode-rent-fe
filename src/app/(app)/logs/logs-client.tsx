"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RentalLogEntries } from "@/components/rental-logs/rental-log-entries";
import { RentalLogFiltersBar } from "@/components/rental-logs/rental-log-filters-bar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFleetVehicles } from "@/hooks/use-fleet-vehicles";
import {
  emptyRentalLogFilters,
  filterRentalLogSessions,
  sortSessionsByLogTimeDesc,
  type RentalLogFilterValues,
} from "@/lib/rental-log-filters";
import { fetchRentalsFromRentApi, getRentApiErrorMessage } from "@/lib/rent-api";
import { rentKeys } from "@/lib/rent-query-keys";
import { vehiclePlate } from "@/lib/rental-metadata";

export function RentalLogsClient() {
  const router = useRouter();
  const { allVehicles } = useFleetVehicles();
  const [draftFilters, setDraftFilters] = useState<RentalLogFilterValues>(emptyRentalLogFilters);
  const [filters, setFilters] = useState<RentalLogFilterValues>(emptyRentalLogFilters);
  const [newRentalOpen, setNewRentalOpen] = useState(false);
  const [pickedVehicleId, setPickedVehicleId] = useState<string>("");

  const vehiclesById = useMemo(() => new Map(allVehicles.map((v) => [v.id, v])), [allVehicles]);

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

  const goToNewRental = () => {
    if (!pickedVehicleId) {
      toast.error("Araç seçin.");
      return;
    }
    const v = allVehicles.find((x) => x.id === pickedVehicleId);
    if (!v) {
      toast.error("Araç bulunamadı.");
      return;
    }
    if (v.maintenance) {
      toast.error("Bu araç bakımda; kiralama oluşturulamaz.");
      return;
    }
    setNewRentalOpen(false);
    setPickedVehicleId("");
    router.push(`/vehicles/${pickedVehicleId}?yeniKiralama=1`);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <CalendarDays className="h-5 w-5 text-primary" />
            Kiralamalar
          </h1>
          <p className="text-xs text-muted-foreground">
            Tüm araçlar için kiralama günlük kayıtları. Müşteri veya tarih ile süzebilir, plakaya göre daraltabilirsiniz.
          </p>
        </div>
        <Button type="button" size="sm" className="h-8 shrink-0 gap-1.5 text-xs" onClick={() => setNewRentalOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Yeni kiralama oluştur
        </Button>
      </div>

      <Dialog open={newRentalOpen} onOpenChange={setNewRentalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Yeni kiralama</DialogTitle>
            <DialogDescription className="text-xs">
              Kiralama kaydı eklemek için araç seçin; araç detayında form açılacaktır.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Araç</Label>
            <Select value={pickedVehicleId || undefined} onValueChange={setPickedVehicleId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Plaka seçin…" />
              </SelectTrigger>
              <SelectContent>
                {allVehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id} disabled={Boolean(v.maintenance)}>
                    {v.plate} — {v.brand} {v.model}
                    {v.maintenance ? " (bakım)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={() => setNewRentalOpen(false)}>
              Vazgeç
            </Button>
            <Button type="button" size="sm" className="h-9 text-xs" onClick={goToNewRental}>
              Devam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="glow-card">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Kiralama günlüğü</CardTitle>
          <CardDescription className="text-xs">
            {sessionsLoading
              ? "Yükleniyor..."
              : sessionsError
                ? getRentApiErrorMessage(sessionsError)
                : `${filteredSessions.length} kayıt gösteriliyor · toplam ${allSessions.length} seans.`}{" "}
            Müşteri özetleri için{" "}
            <Link href="/customers" className="font-medium text-primary underline-offset-2 hover:underline">
              Customers
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
    </div>
  );
}
