"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays, addMonths, addYears, differenceInCalendarDays, eachDayOfInterval, format, parseISO, startOfDay, startOfMonth } from "date-fns";
import { tr } from "date-fns/locale";
import { DayPicker, type DateRange } from "react-day-picker";
import { toast } from "sonner";
import { BarChart3, CalendarDays, KeyRound, ScrollText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VehicleDetailListingGallery } from "@/components/vehicles/vehicle-detail-listing-gallery";
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
import { ImageSourceInput } from "@/components/ui/image-source-input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCountries } from "@/hooks/use-countries";
import { useFleetSessions } from "@/hooks/use-fleet-sessions";
import { useFleetVehicles } from "@/hooks/use-fleet-vehicles";
import { getRentApiErrorMessage } from "@/lib/rent-api";
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
import { mergeVehicleImagesWithDemo } from "@/lib/vehicle-images";
import { rentalCountsForCalendar } from "@/lib/rental-status";
import { PHONE_COUNTRY_CODES } from "@/lib/phone-country-codes";
import { cn } from "@/lib/utils";

import "react-day-picker/style.css";

type Props = {
  vehicle: Vehicle;
  /** Kiralamalar sayfasından `?yeniKiralama=1` ile gelindiğinde kiralama iletişim kutusunu açar */
  autoOpenNewRental?: boolean;
};

type AdditionalDriverDraft = {
  fullName: string;
  birthDate: string;
  driverLicenseNo: string;
  passportNo: string;
  driverLicenseImageDataUrl: string;
  passportImageDataUrl: string;
};

type ReportRange = "1w" | "1m" | "6m" | "1y";
const COUNTRY_NONE = "__none__";

function blankAdditionalDriver(): AdditionalDriverDraft {
  return {
    fullName: "",
    birthDate: "",
    driverLicenseNo: "",
    passportNo: "",
    driverLicenseImageDataUrl: "",
    passportImageDataUrl: "",
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Dosya okunamadı"));
    reader.readAsDataURL(file);
  });
}

export function VehicleDetailClient({ vehicle, autoOpenNewRental = false }: Props) {
  const router = useRouter();
  const autoOpenedRef = useRef(false);
  const { allSessions, createRental } = useFleetSessions();
  const { updateVehicle } = useFleetVehicles();
  const { countryByCode, countries } = useCountries();
  const today = useMemo(() => new Date(), []);
  const countryMeta = useMemo(() => {
    const cc = vehicle.countryCode?.toUpperCase();
    return cc ? countryByCode.get(cc) : undefined;
  }, [vehicle.countryCode, countryByCode]);
  const status = vehicleFleetStatus(vehicle, allSessions, today);
  const booked = useMemo(() => bookedDatesForVehicle(allSessions, vehicle.id), [allSessions, vehicle.id]);
  const sessions = useMemo(() => sessionsForVehicle(allSessions, vehicle.id), [allSessions, vehicle.id]);
  const rentalLogs = useMemo(
    () => [...sessions].sort((a, b) => sessionCreatedAt(b).localeCompare(sessionCreatedAt(a))),
    [sessions],
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [pickStart, setPickStart] = useState<string>("");
  const [pickEnd, setPickEnd] = useState<string>("");
  const [fullName, setFullName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [passportNo, setPassportNo] = useState("");
  const [driverLicenseNo, setDriverLicenseNo] = useState("");
  const [passportImageDataUrl, setPassportImageDataUrl] = useState("");
  const [driverLicenseImageDataUrl, setDriverLicenseImageDataUrl] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+90");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [commissionAmount, setCommissionAmount] = useState("");
  const [commissionFlow, setCommissionFlow] = useState<"collect" | "pay">(vehicle.external ? "pay" : "collect");
  const [commissionCompany, setCommissionCompany] = useState(vehicle.externalCompany ?? "");
  const [additionalDrivers, setAdditionalDrivers] = useState<AdditionalDriverDraft[]>([]);
  const [logFilters, setLogFilters] = useState<RentalLogFilterValues>(emptyRentalLogFilters());
  const [reportRange, setReportRange] = useState<ReportRange>("6m");
  const [editOpen, setEditOpen] = useState(false);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [editPlate, setEditPlate] = useState(vehicle.plate);
  const [editBrand, setEditBrand] = useState(vehicle.brand);
  const [editModel, setEditModel] = useState(vehicle.model);
  const [editYear, setEditYear] = useState(String(vehicle.year));
  const [editMaintenance, setEditMaintenance] = useState(Boolean(vehicle.maintenance));
  const [editExternal, setEditExternal] = useState(Boolean(vehicle.external));
  const [editExternalCompany, setEditExternalCompany] = useState(vehicle.externalCompany ?? "");
  const [editCommissionRate, setEditCommissionRate] = useState(
    vehicle.commissionRatePercent != null ? String(vehicle.commissionRatePercent) : "",
  );
  const [editCommissionPhone, setEditCommissionPhone] = useState(vehicle.commissionBrokerPhone ?? "");
  const [editRentalPrice, setEditRentalPrice] = useState(
    vehicle.rentalDailyPrice != null ? String(vehicle.rentalDailyPrice) : "",
  );
  const [editCountryCode, setEditCountryCode] = useState<string>(vehicle.countryCode ?? COUNTRY_NONE);

  const filteredRentalLogs = useMemo(() => {
    return sortSessionsByLogTimeDesc(filterRentalLogSessions(rentalLogs, logFilters));
  }, [rentalLogs, logFilters]);

  const selectedDateRange = useMemo<DateRange | undefined>(() => {
    if (!pickStart && !pickEnd) return undefined;
    return {
      from: pickStart ? parseISO(pickStart) : undefined,
      to: pickEnd ? parseISO(pickEnd) : undefined,
    };
  }, [pickStart, pickEnd]);

  const estimateCommissionAmount = useCallback(
    (start: string, end: string) => {
      if (!vehicle.commissionEnabled || vehicle.commissionRatePercent == null || vehicle.rentalDailyPrice == null) {
        return "";
      }
      if (!start || !end) return "";
      try {
        const startDate = parseISO(start);
        const endDate = parseISO(end);
        const rentalDays = Math.max(1, differenceInCalendarDays(endDate, startDate) + 1);
        const gross = rentalDays * vehicle.rentalDailyPrice;
        const commission = (gross * vehicle.commissionRatePercent) / 100;
        return commission.toFixed(2);
      } catch {
        return "";
      }
    },
    [vehicle.commissionEnabled, vehicle.commissionRatePercent, vehicle.rentalDailyPrice],
  );

  const reportStats = useMemo(() => {
    const nowDay = startOfDay(today);
    const rangeMeta =
      reportRange === "1w"
        ? { daily: true, label: "son 1 hafta", rangeStart: addDays(nowDay, -6) }
        : reportRange === "1m"
          ? { daily: true, label: "son 1 ay", rangeStart: addMonths(nowDay, -1) }
          : reportRange === "1y"
            ? { daily: false, bucketCount: 12, label: "son 1 yıl", rangeStart: addYears(nowDay, -1) }
            : { daily: false, bucketCount: 6, label: "son 6 ay", rangeStart: addMonths(nowDay, -6) };

    const rangeStart = startOfDay(rangeMeta.rangeStart);
    const monthBucketCount: number = rangeMeta.daily ? 0 : (rangeMeta.bucketCount ?? 6);
    const bucketDefs = rangeMeta.daily
      ? eachDayOfInterval({ start: rangeStart, end: nowDay }).map((d) => ({
          key: format(d, "yyyy-MM-dd"),
          label: format(d, "dd MMM", { locale: tr }),
          at: d,
        }))
      : Array.from({ length: monthBucketCount }, (_, idx) => {
          const monthAnchor = startOfMonth(nowDay);
          const d = addMonths(monthAnchor, idx - (monthBucketCount - 1));
          return {
            key: format(d, "yyyy-MM"),
            label: format(d, "MMM yy", { locale: tr }),
            at: d,
          };
        });
    const filtered = sessions.filter((s) => {
      const d = startOfDay(new Date(s.createdAt ?? `${s.startDate}T00:00:00.000Z`));
      return d.getTime() >= rangeStart.getTime();
    });

    const total = filtered.length;
    const completed = filtered.filter((s) => (s.status ?? "active") === "completed").length;
    const cancelled = filtered.filter((s) => (s.status ?? "active") === "cancelled").length;
    const active = filtered.filter((s) => {
      const st = s.status ?? "active";
      return st === "active" || st === "pending";
    }).length;
    const buckets = new Map<string, { net: number; count: number; gross: number; commission: number }>();
    let totalGrossRevenue = 0;
    let totalCommission = 0;
    for (const s of filtered) {
      const startDate = parseISO(s.startDate);
      const endDate = parseISO(s.endDate);
      const rentalDays = Math.max(1, differenceInCalendarDays(endDate, startDate) + 1);
      const gross = rentalDays * Number(vehicle.rentalDailyPrice ?? 0);
      const commission =
        vehicle.commissionEnabled && vehicle.commissionRatePercent != null ? (gross * Number(vehicle.commissionRatePercent)) / 100 : 0;
      const net = gross - commission;
      totalGrossRevenue += gross;
      totalCommission += commission;
      const sourceDate = new Date(s.createdAt ?? `${s.startDate}T00:00:00.000Z`);
      const key = rangeMeta.daily ? format(sourceDate, "yyyy-MM-dd") : format(sourceDate, "yyyy-MM");
      const prev = buckets.get(key) ?? { net: 0, count: 0, gross: 0, commission: 0 };
      buckets.set(key, {
        net: prev.net + net,
        count: prev.count + 1,
        gross: prev.gross + gross,
        commission: prev.commission + commission,
      });
    }
    const monthlyRows = bucketDefs.map((b) => {
      const row = buckets.get(b.key) ?? { net: 0, count: 0, gross: 0, commission: 0 };
      return { key: b.key, label: b.label, ...row };
    });
    const maxNetAbs = Math.max(1, ...monthlyRows.map((r) => Math.abs(r.net)));
    const maxCount = Math.max(1, ...monthlyRows.map((r) => r.count));
    const totalProfit = totalGrossRevenue - totalCommission;
    return {
      total,
      completed,
      cancelled,
      active,
      totalGrossRevenue,
      totalCommission,
      totalProfit,
      monthlyRows,
      maxNetAbs,
      maxCount,
      rangeLabel: rangeMeta.label,
    };
  }, [sessions, today, reportRange, vehicle.rentalDailyPrice, vehicle.commissionEnabled, vehicle.commissionRatePercent]);

  const vehicleInfoRows = useMemo(
    () => [
      { label: "Plaka", value: <span className="font-mono font-semibold">{vehicle.plate}</span> },
      { label: "Marka", value: vehicle.brand },
      { label: "Model", value: vehicle.model },
      { label: "Model yılı", value: <span className="tabular-nums">{vehicle.year}</span> },
      {
        label: "Ülke",
        value: countryMeta ? (
          <span className="inline-flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm border border-border/60"
              style={{ backgroundColor: countryMeta.colorCode }}
              aria-hidden
            />
            {countryMeta.name} ({countryMeta.code})
          </span>
        ) : (
          "—"
        ),
      },
      { label: "Araç kayıt no", value: <span className="font-mono text-xs">{vehicle.id}</span> },
      { label: "Bakım", value: vehicle.maintenance ? "Evet — kiralanamaz" : "Hayır" },
      {
        label: "Bugünkü durum",
        value:
          status === "maintenance" ? (
            <Badge variant="muted">Bakımda</Badge>
          ) : status === "rented" ? (
            <Badge variant="warning">Kirada</Badge>
          ) : (
            <Badge variant="success">Müsait</Badge>
          ),
      },
      { label: "Harici araç", value: vehicle.external ? "Evet" : "Hayır" },
      {
        label: "Günlük kiralama fiyatı",
        value: vehicle.rentalDailyPrice != null ? vehicle.rentalDailyPrice.toLocaleString("tr-TR", { maximumFractionDigits: 2 }) : "—",
      },
      { label: "Komisyon", value: vehicle.commissionEnabled ? "Var" : "Yok" },
      {
        label: "Komisyon oranı",
        value: vehicle.commissionEnabled && vehicle.commissionRatePercent != null ? `%${vehicle.commissionRatePercent}` : "—",
      },
      {
        label: "Komisyoncu",
        value: vehicle.commissionEnabled ? vehicle.commissionBrokerFullName || "—" : "—",
      },
      {
        label: "Komisyoncu telefonu",
        value: vehicle.commissionEnabled ? vehicle.commissionBrokerPhone || "—" : "—",
      },
      ...(vehicle.externalCompany ? [{ label: "Harici firma", value: vehicle.externalCompany }] : []),
      { label: "Toplam kiralama", value: <span className="tabular-nums">{sessions.length} kayıt</span> },
    ],
    [vehicle, countryMeta, status, sessions.length],
  );

  const galleryImages = useMemo(() => mergeVehicleImagesWithDemo(vehicle.images, vehicle.id), [vehicle.images, vehicle.id]);

  const openForDay = useCallback(
    (day: Date) => {
      if (vehicle.maintenance) {
        toast.error("Bu araç bakımda; kiralama oluşturulamaz.");
        return;
      }
      const d = formatDay(day);
      setPickStart(d);
      setPickEnd(d);
      setDateRangeOpen(false);
      setCommissionAmount(estimateCommissionAmount(d, d));
      setCommissionFlow(vehicle.external ? "pay" : "collect");
      setCommissionCompany(vehicle.externalCompany ?? "");
      setPassportImageDataUrl("");
      setDriverLicenseImageDataUrl("");
      setPhoneCountryCode("+90");
      setPhoneLocal("");
      setDriverLicenseNo("");
      setAdditionalDrivers([]);
      setDialogOpen(true);
    },
    [vehicle.maintenance, vehicle.external, vehicle.externalCompany, estimateCommissionAmount],
  );

  useEffect(() => {
    if (!autoOpenNewRental || autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    if (vehicle.maintenance) {
      toast.error("Bu araç bakımda; kiralama oluşturulamaz.");
      router.replace(`/vehicles/${vehicle.id}`, { scroll: false });
      return;
    }
    openForDay(new Date());
    router.replace(`/vehicles/${vehicle.id}`, { scroll: false });
  }, [autoOpenNewRental, vehicle.id, vehicle.maintenance, openForDay, router]);

  useEffect(() => {
    if (!dialogOpen || !vehicle.commissionEnabled) return;
    setCommissionAmount(estimateCommissionAmount(pickStart, pickEnd));
  }, [dialogOpen, vehicle.commissionEnabled, pickStart, pickEnd, estimateCommissionAmount]);

  useEffect(() => {
    setEditPlate(vehicle.plate);
    setEditBrand(vehicle.brand);
    setEditModel(vehicle.model);
    setEditYear(String(vehicle.year));
    setEditMaintenance(Boolean(vehicle.maintenance));
    setEditExternal(Boolean(vehicle.external));
    setEditExternalCompany(vehicle.externalCompany ?? "");
    setEditCommissionRate(vehicle.commissionRatePercent != null ? String(vehicle.commissionRatePercent) : "");
    setEditCommissionPhone(vehicle.commissionBrokerPhone ?? "");
    setEditRentalPrice(vehicle.rentalDailyPrice != null ? String(vehicle.rentalDailyPrice) : "");
    setEditCountryCode(vehicle.countryCode ?? COUNTRY_NONE);
  }, [vehicle]);

  const updateAdditionalDriver = <K extends keyof AdditionalDriverDraft>(idx: number, key: K, value: AdditionalDriverDraft[K]) => {
    setAdditionalDrivers((prev) => prev.map((d, i) => (i === idx ? { ...d, [key]: value } : d)));
  };

  const handleDayClick = (date: Date, modifiers: Record<string, boolean>) => {
    if (vehicle.maintenance) return;
    if (modifiers.booked) {
      toast.message("Bu gün zaten dolu", { description: "Müsait bir güne tıklayın." });
      return;
    }
    openForDay(date);
  };

  const submitRental = async () => {
    const start = pickStart.trim();
    const end = pickEnd.trim();
    const phone = `${phoneCountryCode} ${phoneLocal}`.trim();
    if (!fullName.trim() || !passportNo.trim() || !driverLicenseNo.trim() || !phoneLocal.trim()) {
      toast.error("Tüm alanları doldurun.");
      return;
    }
    if (!driverLicenseImageDataUrl || !passportImageDataUrl) {
      toast.error("Ehliyet ve pasaport görselleri zorunlu.");
      return;
    }
    if (!start || !end || end < start) {
      toast.error("Bitiş tarihi başlangıçtan önce olamaz.");
      return;
    }
    const commission = Number.parseFloat(commissionAmount.replace(",", "."));
    if (!Number.isFinite(commission) || commission <= 0) {
      toast.error("Komisyon tutarı zorunlu ve sıfırdan büyük olmalı.");
      return;
    }
    if (commissionFlow === "pay" && !commissionCompany.trim()) {
      toast.error("Komisyon ödenecek firmayı girin.");
      return;
    }
    for (const d of additionalDrivers) {
      if (
        !d.fullName.trim() ||
        !d.birthDate ||
        !d.driverLicenseNo.trim() ||
        !d.passportNo.trim() ||
        !d.driverLicenseImageDataUrl ||
        !d.passportImageDataUrl
      ) {
        toast.error("Ek sürücü alanlarının tamamını doldurun ve iki belge fotoğrafını yükleyin.");
        return;
      }
    }
    const conflict = allSessions.find(
      (s) =>
        rentalCountsForCalendar(s) &&
        s.vehicleId === vehicle.id &&
        dateRangesOverlap(start, end, s.startDate, s.endDate),
    );
    if (conflict) {
      toast.error(
        `Bu araç ${conflict.startDate} - ${conflict.endDate} arasında kirada (${conflict.customer.fullName}).`,
      );
      return;
    }
    try {
      await createRental({
        vehicleId: vehicle.id,
        startDate: start,
        endDate: end,
        customer: {
          fullName: fullName.trim(),
          nationalId: nationalId.trim(),
          passportNo: passportNo.trim(),
          phone,
          driverLicenseNo: driverLicenseNo.trim() || undefined,
          driverLicenseImageDataUrl,
          passportImageDataUrl,
        },
        commissionAmount: commission,
        commissionFlow,
        commissionCompany: commissionCompany.trim() || undefined,
        additionalDrivers: additionalDrivers.map((d) => ({
          fullName: d.fullName.trim(),
          birthDate: d.birthDate,
          driverLicenseNo: d.driverLicenseNo.trim(),
          passportNo: d.passportNo.trim(),
          driverLicenseImageDataUrl: d.driverLicenseImageDataUrl,
          passportImageDataUrl: d.passportImageDataUrl,
        })),
        status: "active",
      });
      toast.success("Kiralama kaydı oluşturuldu.");
      setDialogOpen(false);
      setFullName("");
      setNationalId("");
      setPassportNo("");
      setDriverLicenseNo("");
      setPhoneCountryCode("+90");
      setPhoneLocal("");
      setPassportImageDataUrl("");
      setDriverLicenseImageDataUrl("");
      setCommissionAmount("");
      setCommissionFlow(vehicle.external ? "pay" : "collect");
      setCommissionCompany(vehicle.externalCompany ?? "");
      setAdditionalDrivers([]);
    } catch (e) {
      toast.error(getRentApiErrorMessage(e));
    }
  };

  const submitVehicleUpdate = async () => {
    const plate = editPlate.trim().toUpperCase();
    const brand = editBrand.trim();
    const model = editModel.trim();
    const year = Number.parseInt(editYear, 10);
    const rentalPrice = Number.parseFloat(editRentalPrice.replace(",", "."));
    const commissionRate = Number.parseFloat(editCommissionRate.replace(",", "."));

    if (!plate || !brand || !model || !Number.isFinite(year)) {
      toast.error("Plaka, marka, model ve yıl zorunlu.");
      return;
    }
    if (!Number.isFinite(rentalPrice) || rentalPrice <= 0) {
      toast.error("Günlük kiralama fiyatı sıfırdan büyük olmalı.");
      return;
    }
    if (editExternal) {
      if (!editExternalCompany.trim()) {
        toast.error("Harici araçta firma adı zorunlu.");
        return;
      }
      if (!Number.isFinite(commissionRate) || commissionRate <= 0 || commissionRate > 100) {
        toast.error("Harici araçta komisyon oranı 0-100 arası zorunlu.");
        return;
      }
    }

    setSavingVehicle(true);
    try {
      await updateVehicle(vehicle.id, {
        plate,
        brand,
        model,
        year,
        maintenance: editMaintenance,
        external: editExternal,
        externalCompany: editExternal ? editExternalCompany.trim() : "",
        commissionRatePercent: editExternal ? commissionRate : undefined,
        commissionBrokerPhone: editExternal ? editCommissionPhone.trim() : "",
        rentalDailyPrice: rentalPrice,
        countryCode: editCountryCode !== COUNTRY_NONE ? editCountryCode : "",
      });
      toast.success("Araç bilgileri güncellendi.");
      setEditOpen(false);
    } catch (e) {
      toast.error(getRentApiErrorMessage(e));
    } finally {
      setSavingVehicle(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold tracking-tight">Araç detayı</h1>
            <p className="text-xs text-muted-foreground">
              {vehicle.brand} {vehicle.model} · <span className="font-mono">{vehicle.plate}</span>
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8 w-full shrink-0 gap-1.5 text-xs sm:w-auto"
          disabled={vehicle.maintenance}
          onClick={() => openForDay(new Date())}
        >
          <KeyRound className="h-3.5 w-3.5" />
          Kiralama başlat
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start lg:gap-6">
        <Card className="glow-card order-1 min-w-0 overflow-hidden">
          <CardHeader className="pb-2 pt-3 sm:pt-4">
            <CardTitle className="text-sm">Görseller</CardTitle>
            <CardDescription className="text-xs">
              İlan görünümü: ortada ana fotoğraf, altta diğer açılar. Küçük resme tıklayarak ana görseli değiştirin.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-4 pt-0">
            <VehicleDetailListingGallery key={vehicle.id} images={galleryImages} />
          </CardContent>
        </Card>

        <Card className="glow-card order-2 min-w-0">
          <CardHeader className="py-3 pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm">Araç bilgileri</CardTitle>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditOpen(true)}>
                Araç güncelle
              </Button>
            </div>
            <CardDescription className="text-xs">Plaka, marka, model ve filo durumu.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/60">
              {vehicleInfoRows.map((row) => (
                <div
                  key={`vehicle-info-${row.label}`}
                  className={cn(
                    "grid grid-cols-[140px_1fr] items-center gap-3 bg-background px-3 py-2 transition-colors hover:bg-muted/40 sm:grid-cols-[170px_1fr] sm:px-4",
                  )}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{row.label}</p>
                  <div className="text-sm font-medium">{row.value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glow-card">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Operasyon sekmeleri</CardTitle>
          <CardDescription className="text-xs">Müsaitlik takvimi, rapor ve kiralama günlüğü.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Tabs defaultValue="availability" className="w-full">
            <TabsList className="h-9 w-full justify-start gap-1 overflow-x-auto">
              <TabsTrigger value="availability" className="gap-1 text-xs">
                <CalendarDays className="h-3.5 w-3.5" />
                Müsaitlik takvimi
              </TabsTrigger>
              <TabsTrigger value="report" className="gap-1 text-xs">
                <BarChart3 className="h-3.5 w-3.5" />
                Rapor
              </TabsTrigger>
              <TabsTrigger value="logs" className="gap-1 text-xs">
                <ScrollText className="h-3.5 w-3.5" />
                Kiralama günlüğü
              </TabsTrigger>
            </TabsList>

            <TabsContent value="availability" className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <CardDescription className="text-xs sm:text-sm">
                  Müsait güne tıklayarak kiralama oluşturun. Dar ekranda takvim yatay kaydırılabilir.
                </CardDescription>
                {!vehicle.maintenance && (
                  <Button size="sm" variant="heroOutline" className="h-8 w-full text-xs sm:w-auto" onClick={() => openForDay(new Date())}>
                    Bugün için oluştur
                  </Button>
                )}
              </div>
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
                <p className="text-center text-xs text-destructive sm:text-left">Bakım modunda takvim kilitli.</p>
              )}
            </TabsContent>

            <TabsContent value="report" className="space-y-3">
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">Rapor dönemi</p>
                <Tabs value={reportRange} onValueChange={(v) => setReportRange(v as ReportRange)} className="w-full">
                  <TabsList className="h-8 w-full justify-start gap-1 overflow-x-auto">
                    <TabsTrigger value="1w" className="text-xs">
                      Son 1 hafta
                    </TabsTrigger>
                    <TabsTrigger value="1m" className="text-xs">
                      Son 1 ay
                    </TabsTrigger>
                    <TabsTrigger value="6m" className="text-xs">
                      Son 6 ay
                    </TabsTrigger>
                    <TabsTrigger value="1y" className="text-xs">
                      Son 1 yıl
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <Tabs defaultValue="summary" className="w-full">
                <TabsList className="h-8">
                  <TabsTrigger value="summary" className="text-xs">
                    Özet
                  </TabsTrigger>
                  <TabsTrigger value="monthly" className="text-xs">
                    Aylık trend
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="summary" className="space-y-3">
                  <p className="text-[11px] text-muted-foreground">Özet veriler {reportStats.rangeLabel} için hesaplanır.</p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-md border border-border/70 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Toplam kiralama</p>
                      <p className="mt-1 text-base font-semibold tabular-nums">{reportStats.total}</p>
                    </div>
                    <div className="rounded-md border border-border/70 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Aktif / bekleyen</p>
                      <p className="mt-1 text-base font-semibold tabular-nums">{reportStats.active}</p>
                    </div>
                    <div className="rounded-md border border-border/70 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Tamamlanan</p>
                      <p className="mt-1 text-base font-semibold tabular-nums">{reportStats.completed}</p>
                    </div>
                    <div className="rounded-md border border-border/70 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">İptal</p>
                      <p className="mt-1 text-base font-semibold tabular-nums">{reportStats.cancelled}</p>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-md border border-border/70 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Brüt gelir</p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">
                        {reportStats.totalGrossRevenue.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="rounded-md border border-border/70 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Komisyon tutarı</p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">
                        {reportStats.totalCommission.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="rounded-md border border-border/70 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Toplam kar (net)</p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">
                        {reportStats.totalProfit.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="monthly" className="space-y-3">
                  {reportStats.monthlyRows.length === 0 ? (
                    <p className="py-4 text-xs text-muted-foreground">Henüz aylık trend gösterecek kayıt yok.</p>
                  ) : (
                    <>
                      <div className="rounded-md border border-border/70 p-3">
                        <p className="mb-2 text-[11px] font-medium text-muted-foreground">
                          Kiralama adedi ({reportStats.rangeLabel})
                        </p>
                        <div className="overflow-x-auto pb-1">
                          <div style={{ minWidth: `${Math.max(560, reportStats.monthlyRows.length * 28)}px` }}>
                            <div className="flex h-28 items-end gap-1.5">
                              {reportStats.monthlyRows.map((row) => {
                                const h = Math.max(8, Math.round((row.count / reportStats.maxCount) * 88));
                                return (
                                  <div key={`count-${row.key}`} className="flex w-6 shrink-0 flex-col items-center">
                                    <div
                                      className="w-full rounded-t bg-primary/80"
                                      style={{ height: `${h}px` }}
                                      title={`${row.label}: ${row.count} kiralama`}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                            <div className="mt-2 flex gap-1.5 border-t border-border/50 pt-1">
                              {reportStats.monthlyRows.map((row, idx) => {
                                const showLabel =
                                  reportStats.monthlyRows.length <= 14 ||
                                  idx === 0 ||
                                  idx === reportStats.monthlyRows.length - 1 ||
                                  idx % 4 === 0;
                                return (
                                  <div key={`label-${row.key}`} className="flex w-6 shrink-0 justify-center">
                                    <span className="text-[9px] leading-none text-muted-foreground">
                                      {showLabel ? row.label : "·"}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-md border border-border/70 p-3">
                        <p className="mb-2 text-[11px] font-medium text-muted-foreground">
                          Net kar trendi ({reportStats.rangeLabel}) (brüt gelir - komisyon)
                        </p>
                        <div className="space-y-1">
                          {reportStats.monthlyRows.map((row) => {
                            const pct = Math.max(4, Math.round((Math.abs(row.net) / reportStats.maxNetAbs) * 100));
                            const positive = row.net >= 0;
                            return (
                              <div key={`net-${row.key}`} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-medium">{row.label}</span>
                                  <span className="tabular-nums">{row.net.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="h-2 rounded bg-muted/50">
                                  <div
                                    className={cn("h-2 rounded", positive ? "bg-emerald-500" : "bg-rose-500")}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="logs" className="space-y-3">
              <p className="text-[11px] text-muted-foreground">
                Müşteri özetleri:{" "}
                <Link href="/customers" className="font-medium text-primary underline-offset-2 hover:underline">
                  Customers
                </Link>
                {" · "}
                Tüm kiralamalar:{" "}
                <Link href="/logs" className="font-medium text-primary underline-offset-2 hover:underline">
                  Kiralamalar
                </Link>
              </p>
              {rentalLogs.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">Henüz kiralama günlük kaydı yok.</p>
              ) : (
                <>
                  <RentalLogFiltersBar values={logFilters} onChange={setLogFilters} />
                  <RentalLogEntries sessions={filteredRentalLogs} expandableDetails />
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Araç güncelle</DialogTitle>
            <DialogDescription>Aracın temel bilgilerini ve durumunu güncelleyebilirsiniz.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="space-y-1">
              <Label>Plaka</Label>
              <Input value={editPlate} onChange={(e) => setEditPlate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Marka</Label>
                <Input value={editBrand} onChange={(e) => setEditBrand(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Model</Label>
                <Input value={editModel} onChange={(e) => setEditModel(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Model yılı</Label>
              <Input type="number" min={1950} max={new Date().getFullYear() + 1} value={editYear} onChange={(e) => setEditYear(e.target.value)} />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input type="checkbox" checked={editMaintenance} onChange={(e) => setEditMaintenance(e.target.checked)} className="rounded border-input" />
              Bakımda (kiralanamaz)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input type="checkbox" checked={editExternal} onChange={(e) => setEditExternal(e.target.checked)} className="rounded border-input" />
              Harici araç
            </label>
            {editExternal && (
              <>
                <div className="space-y-1">
                  <Label>Harici firma adı</Label>
                  <Input value={editExternalCompany} onChange={(e) => setEditExternalCompany(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Komisyon oranı (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={editCommissionRate}
                    onChange={(e) => setEditCommissionRate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Telefon (opsiyonel)</Label>
                  <Input value={editCommissionPhone} onChange={(e) => setEditCommissionPhone(e.target.value)} />
                </div>
              </>
            )}
            <div className="space-y-1">
              <Label>Günlük kiralama fiyatı</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={editRentalPrice}
                onChange={(e) => setEditRentalPrice(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Ülke</Label>
              <select
                value={editCountryCode}
                onChange={(e) => setEditCountryCode(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value={COUNTRY_NONE}>Atanmadı</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(false)} disabled={savingVehicle}>
              Vazgeç
            </Button>
            <Button size="sm" variant="hero" onClick={() => void submitVehicleUpdate()} disabled={savingVehicle}>
              {savingVehicle ? "Kaydediliyor..." : "Güncelle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni kiralama</DialogTitle>
            <DialogDescription>
              {vehicle.plate} — {vehicle.brand} {vehicle.model}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="space-y-1">
              <Label>Tarih aralığı</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-full justify-start gap-1.5 px-2 text-[11px]"
                onClick={() => setDateRangeOpen((v) => !v)}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                {pickStart && pickEnd ? `${pickStart} - ${pickEnd}` : "Başlangıç ve bitiş seçin"}
              </Button>
              {dateRangeOpen && (
                <div className="rounded-md border border-border/70 bg-background p-1.5">
                  <DayPicker
                    mode="range"
                    locale={tr}
                    selected={selectedDateRange}
                    onSelect={(range) => {
                      const nextStart = range?.from ? format(range.from, "yyyy-MM-dd") : "";
                      const nextEnd = range?.to ? format(range.to, "yyyy-MM-dd") : "";
                      setPickStart(nextStart);
                      setPickEnd(nextEnd);
                    }}
                    numberOfMonths={1}
                    classNames={{
                      months: "text-[11px]",
                      caption_label: "text-xs font-medium",
                      weekday: "text-[11px] font-semibold text-foreground/90",
                      day: "h-7 w-7 p-0",
                      day_button: "h-7 w-7 rounded-full text-[11px]",
                      selected: "bg-primary text-primary-foreground hover:bg-primary",
                      range_start: "bg-primary text-primary-foreground rounded-full",
                      range_end: "bg-primary text-primary-foreground rounded-full",
                      range_middle: "bg-primary/20 text-foreground",
                    }}
                  />
                  <div className="mt-1 flex justify-end border-t border-border/60 pt-2">
                    <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setDateRangeOpen(false)}>
                      Tamam
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="fn">İsim soyisim</Label>
              <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ad Soyad" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tc">Vatandaşlık no (Opsiyonel)</Label>
              <Input id="tc" value={nationalId} onChange={(e) => setNationalId(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pp">Pasaport</Label>
              <Input id="pp" value={passportNo} onChange={(e) => setPassportNo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Ehliyet</Label>
              <Input value={driverLicenseNo} onChange={(e) => setDriverLicenseNo(e.target.value)} placeholder="Belge no" />
            </div>
            <div className="space-y-1">
              <Label>Cep telefonu</Label>
              <div className="flex gap-2">
                <select
                  value={phoneCountryCode}
                  onChange={(e) => setPhoneCountryCode(e.target.value)}
                  className="h-9 w-32 rounded-md border border-input bg-background px-2 text-xs"
                >
                  {PHONE_COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <Input
                  type="tel"
                  value={phoneLocal}
                  onChange={(e) => setPhoneLocal(e.target.value)}
                  placeholder="5xx xxx xx xx"
                  className="h-9"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Pasaport fotoğrafı</Label>
              <ImageSourceInput
                onPick={async (f) => {
                  try {
                    setPassportImageDataUrl(await fileToDataUrl(f));
                  } catch {
                    toast.error("Pasaport görseli okunamadı.");
                  }
                }}
              />
            </div>
            <div className="space-y-1">
              <Label>Ehliyet fotoğrafı</Label>
              <ImageSourceInput
                onPick={async (f) => {
                  try {
                    setDriverLicenseImageDataUrl(await fileToDataUrl(f));
                  } catch {
                    toast.error("Ehliyet görseli okunamadı.");
                  }
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="commission">Komisyon tutarı (zorunlu)</Label>
              <Input
                id="commission"
                type="number"
                min={0}
                step="0.01"
                value={commissionAmount}
                onChange={(e) => setCommissionAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="commission-flow">Komisyon yönü</Label>
              <select
                id="commission-flow"
                value={commissionFlow}
                onChange={(e) => setCommissionFlow(e.target.value as "collect" | "pay")}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="collect">Komisyon alınacak (gelir)</option>
                <option value="pay">Komisyon ödenecek (gider)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="commission-company">Komisyon firması</Label>
              <Input
                id="commission-company"
                value={commissionCompany}
                onChange={(e) => setCommissionCompany(e.target.value)}
                placeholder="Örn: X Rent A Car"
              />
            </div>
            <div className="space-y-2 rounded-md border border-border/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium">Ek sürücüler</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={additionalDrivers.length >= 1}
                  onClick={() => setAdditionalDrivers((prev) => [...prev, blankAdditionalDriver()])}
                >
                  {additionalDrivers.length >= 1 ? "En fazla 1 ek sürücü" : "Ek sürücü ekle"}
                </Button>
              </div>
              {additionalDrivers.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">Ek sürücü yok.</p>
              ) : (
                <div className="space-y-3">
                  {additionalDrivers.map((d, idx) => (
                    <div key={`extra-driver-${idx}`} className="rounded-md border border-border/60 p-2">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-medium">Ek sürücü #{idx + 1}</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="h-7 px-2 text-xs"
                          onClick={() => setAdditionalDrivers((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          Kaldır
                        </Button>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="space-y-1 sm:col-span-2">
                          <Label>İsim soyisim</Label>
                          <Input value={d.fullName} onChange={(e) => updateAdditionalDriver(idx, "fullName", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label>Doğum tarihi</Label>
                          <Input type="date" value={d.birthDate} onChange={(e) => updateAdditionalDriver(idx, "birthDate", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label>Ehliyet</Label>
                          <Input
                            value={d.driverLicenseNo}
                            onChange={(e) => updateAdditionalDriver(idx, "driverLicenseNo", e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Pasaport</Label>
                          <Input value={d.passportNo} onChange={(e) => updateAdditionalDriver(idx, "passportNo", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label>Ehliyet foto</Label>
                          <ImageSourceInput
                            onPick={async (f) => {
                              try {
                                updateAdditionalDriver(idx, "driverLicenseImageDataUrl", await fileToDataUrl(f));
                              } catch {
                                toast.error("Ehliyet görseli okunamadı.");
                              }
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Pasaport foto</Label>
                          <ImageSourceInput
                            onPick={async (f) => {
                              try {
                                updateAdditionalDriver(idx, "passportImageDataUrl", await fileToDataUrl(f));
                              } catch {
                                toast.error("Pasaport görseli okunamadı.");
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
