"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { tr } from "date-fns/locale";
import { toast } from "sonner";
import { ArrowLeft, CalendarDays, ChevronDown, ScrollText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { VehicleImageGallery } from "@/components/vehicles/vehicle-image-gallery";
import { RentAvailabilityCalendar } from "@/components/rent-calendar/rent-availability-calendar";
import { RentCalendarLegend } from "@/components/rent-calendar/rent-calendar-legend";
import { RentalLogEntries } from "@/components/rental-logs/rental-log-entries";
import { RentalLogFiltersBar } from "@/components/rental-logs/rental-log-filters-bar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFleetSessions } from "@/hooks/use-fleet-sessions";
import {
  bookedDatesForVehicle,
  dateRangesOverlap,
  formatDay,
  sessionsForVehicle,
  vehicleFleetStatus,
} from "@/lib/fleet-utils";
import {
  emptyRentalLogFilters,
  filterRentalLogSessions,
  sortSessionsByLogTimeDesc,
  type RentalLogFilterValues,
} from "@/lib/rental-log-filters";
import type { RentalSession, Vehicle } from "@/lib/mock-fleet";
import { sessionCreatedAt } from "@/lib/rental-metadata";
import { hasVehicleGalleryImages } from "@/lib/vehicle-images";
import { cn } from "@/lib/utils";

type Props = {
  vehicle: Vehicle;
};

export function VehicleDetailClient({ vehicle }: Props) {
  const { allSessions, addSession } = useFleetSessions();
  const today = useMemo(() => new Date(), []);
  const status = vehicleFleetStatus(vehicle, allSessions, today);
  const booked = useMemo(() => bookedDatesForVehicle(allSessions, vehicle.id), [allSessions, vehicle.id]);
  const sessions = useMemo(() => sessionsForVehicle(allSessions, vehicle.id), [allSessions, vehicle.id]);
  const rentalLogs = useMemo(
    () => [...sessions].sort((a, b) => sessionCreatedAt(b).localeCompare(sessionCreatedAt(a))),
    [sessions],
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [pickStart, setPickStart] = useState<string>("");
  const [pickEnd, setPickEnd] = useState<string>("");
  const [fullName, setFullName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [passportNo, setPassportNo] = useState("");
  const [phone, setPhone] = useState("");
  const [logsOpen, setLogsOpen] = useState(false);
  const [logFilters, setLogFilters] = useState<RentalLogFilterValues>(emptyRentalLogFilters());

  const filteredRentalLogs = useMemo(() => {
    return sortSessionsByLogTimeDesc(filterRentalLogSessions(rentalLogs, logFilters));
  }, [rentalLogs, logFilters]);

  const openForDay = (day: Date) => {
    if (vehicle.maintenance) {
      toast.error("Bu araç bakımda; kiralama oluşturulamaz.");
      return;
    }
    const d = formatDay(day);
    setPickStart(d);
    setPickEnd(d);
    setDialogOpen(true);
  };

  const handleDayClick = (date: Date, modifiers: Record<string, boolean>) => {
    if (vehicle.maintenance) return;
    if (modifiers.booked) {
      toast.message("Bu gün zaten dolu", { description: "Müsait bir güne tıklayın." });
      return;
    }
    openForDay(date);
  };

  const submitRental = () => {
    const start = pickStart.trim();
    const end = pickEnd.trim();
    if (!fullName.trim() || !nationalId.trim() || !passportNo.trim() || !phone.trim()) {
      toast.error("Tüm alanları doldurun.");
      return;
    }
    if (!start || !end || end < start) {
      toast.error("Bitiş tarihi başlangıçtan önce olamaz.");
      return;
    }
    const clash = allSessions.some(
      (s) =>
        s.vehicleId === vehicle.id && dateRangesOverlap(start, end, s.startDate, s.endDate),
    );
    if (clash) {
      toast.error("Seçilen aralıkta başka bir kiralama var.");
      return;
    }
    const session: RentalSession = {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `r-${Date.now()}`,
      vehicleId: vehicle.id,
      startDate: start,
      endDate: end,
      createdAt: new Date().toISOString(),
      customer: {
        fullName: fullName.trim(),
        nationalId: nationalId.trim(),
        passportNo: passportNo.trim(),
        phone: phone.trim(),
      },
      photos: [],
      accidentReports: [],
    };
    addSession(session);
    toast.success("Kiralama kaydı oluşturuldu (demo, tarayıcıda saklanıyor).");
    setDialogOpen(false);
    setFullName("");
    setNationalId("");
    setPassportNo("");
    setPhone("");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1 px-2" asChild>
          <Link href="/vehicles">
            <ArrowLeft className="h-4 w-4" />
            Liste
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold tracking-tight">Araç detayı</h1>
          <p className="text-xs text-muted-foreground">
            {vehicle.brand} {vehicle.model} · <span className="font-mono">{vehicle.plate}</span>
          </p>
        </div>
        {status === "maintenance" ? (
          <Badge variant="muted">Bakım</Badge>
        ) : status === "rented" ? (
          <Badge variant="warning">Bugün kirada</Badge>
        ) : (
          <Badge variant="success">Müsait</Badge>
        )}
      </div>

      <Card className="glow-card">
        <CardHeader className="py-3 pb-2">
          <CardTitle className="text-sm">Araç bilgileri</CardTitle>
          <CardDescription className="text-xs">Plaka, marka, model ve filo durumu.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Plaka</p>
            <p className="font-mono text-sm font-semibold">{vehicle.plate}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Marka</p>
            <p className="text-sm font-medium">{vehicle.brand}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Model</p>
            <p className="text-sm font-medium">{vehicle.model}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Model yılı</p>
            <p className="text-sm font-medium tabular-nums">{vehicle.year}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Araç kayıt no</p>
            <p className="font-mono text-xs text-muted-foreground">{vehicle.id}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Bakım</p>
            <p className="text-sm font-medium">{vehicle.maintenance ? "Evet — kiralanamaz" : "Hayır"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Bugünkü durum</p>
            <p className="text-sm font-medium">
              {status === "maintenance" ? "Bakımda" : status === "rented" ? "Kirada" : "Müsait"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Toplam kiralama</p>
            <p className="text-sm font-medium tabular-nums">{sessions.length} kayıt</p>
          </div>
        </CardContent>
      </Card>

      <Card className="glow-card">
        <CardHeader className="py-3 sm:py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <CalendarDays className="h-5 w-5 shrink-0" />
                Müsaitlik takvimi
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Müsait güne tıklayarak kiralama oluşturun. Dar ekranda takvim yatay kaydırılabilir.
              </CardDescription>
            </div>
            {!vehicle.maintenance && (
              <Button size="sm" variant="heroOutline" className="h-8 w-full text-xs sm:w-auto" onClick={() => openForDay(new Date())}>
                Bugün için oluştur
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-4 pt-0 sm:px-2">
          <div className="rounded-xl border border-border/70 bg-gradient-to-b from-card to-muted/20 shadow-sm">
            <RentAvailabilityCalendar
              locale={tr}
              booked={booked}
              disabled={vehicle.maintenance ? () => true : undefined}
              onDayClick={handleDayClick}
            />
            <div className="px-3 sm:px-5">
              <RentCalendarLegend />
            </div>
          </div>
          {vehicle.maintenance && (
            <p className="mt-3 px-3 text-center text-xs text-destructive sm:px-0 sm:text-left">Bakım modunda takvim kilitli.</p>
          )}
        </CardContent>
      </Card>

      {hasVehicleGalleryImages(vehicle.images) && (
        <Card className="glow-card">
          <CardHeader className="py-3 pb-2">
            <CardTitle className="text-sm">Araç görselleri</CardTitle>
            <CardDescription className="text-xs">Kayıt sırasında yüklenen açı fotoğrafları.</CardDescription>
          </CardHeader>
          <CardContent>
            <VehicleImageGallery images={vehicle.images} />
          </CardContent>
        </Card>
      )}

      <Collapsible open={logsOpen} onOpenChange={setLogsOpen}>
        <Card className="glow-card overflow-hidden">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 sm:px-6 sm:py-4"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ScrollText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  Kiralama günlüğü
                </div>
                <p className="text-xs text-muted-foreground">
                  Varsayılan olarak kapalı. Açarak kayıtları görüntüleyin; bir satıra tıklayınca yalnızca o kiralamaya ait yorum, fotoğraf ve kaza
                  bildirimleri sekmelerde açılır. Müşteri ve tarih ile süzebilirsiniz. Toplam{" "}
                  <span className="font-medium text-foreground">{sessions.length}</span> kayıt.
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Müşteri özetleri:{" "}
                  <Link href="/customers" className="font-medium text-primary underline-offset-2 hover:underline" onClick={(e) => e.stopPropagation()}>
                    Customers
                  </Link>
                  {" · "}
                  Tüm kiralamalar:{" "}
                  <Link href="/logs" className="font-medium text-primary underline-offset-2 hover:underline" onClick={(e) => e.stopPropagation()}>
                    Kiralamalar
                  </Link>
                </p>
              </div>
              <ChevronDown className={cn("mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-transform", logsOpen && "rotate-180")} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="border-t border-border/60 px-4 pb-4 pt-4 sm:px-6">
              {rentalLogs.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">Henüz kiralama günlük kaydı yok.</p>
              ) : (
                <>
                  <RentalLogFiltersBar values={logFilters} onChange={setLogFilters} />
                  <RentalLogEntries sessions={filteredRentalLogs} expandableDetails />
                </>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni kiralama</DialogTitle>
            <DialogDescription>
              {vehicle.plate} — {vehicle.brand} {vehicle.model}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="start">Başlangıç</Label>
                <Input id="start" type="date" value={pickStart} onChange={(e) => setPickStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="end">Bitiş</Label>
                <Input id="end" type="date" value={pickEnd} onChange={(e) => setPickEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="fn">İsim soyisim</Label>
              <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ad Soyad" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tc">Vatandaşlık no (TC)</Label>
              <Input id="tc" value={nationalId} onChange={(e) => setNationalId(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pp">Pasaport no</Label>
              <Input id="pp" value={passportNo} onChange={(e) => setPassportNo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tel">Cep telefonu</Label>
              <Input id="tel" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+90 …" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
              İptal
            </Button>
            <Button size="sm" variant="hero" onClick={submitRental}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
