"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { addDays, addMonths, addYears, differenceInCalendarDays, eachDayOfInterval, format, parseISO, startOfDay, startOfMonth } from "date-fns";
import { tr } from "date-fns/locale";
import { DayPicker, type DateRange } from "react-day-picker";
import { toast } from "@/components/ui/sonner";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  CarFront,
  CalendarDays,
  History,
  KeyRound,
  PackagePlus,
  ScrollText,
  User,
  UserCircle2,
  UserPlus,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HandoverReturnMultiCombobox } from "@/components/vehicles/handover-return-multi-combobox";
import { VehicleDetailListingGallery } from "@/components/vehicles/vehicle-detail-listing-gallery";
import { VehicleImageSlotsRemoteEditor } from "@/components/vehicles/vehicle-image-slots-remote-editor";
import { RentAvailabilityCalendar } from "@/components/rent-calendar/rent-availability-calendar";
import { RentCalendarLegend } from "@/components/rent-calendar/rent-calendar-legend";
import { RentalLogEntries } from "@/components/rental-logs/rental-log-entries";
import { RentalLogFiltersBar } from "@/components/rental-logs/rental-log-filters-bar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageSourceInput } from "@/components/ui/image-source-input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCountries } from "@/hooks/use-countries";
import { useFleetSessions } from "@/hooks/use-fleet-sessions";
import { useFleetVehicles } from "@/hooks/use-fleet-vehicles";
import {
  fetchHandoverLocationsFromRentApi,
  fetchRentalsFromRentApi,
  fetchRentalRequestsFromRentApi,
  fetchVehicleBodyStylesFromRentApi,
  fetchVehicleCalendarOccupancyFromRentApi,
  fetchVehicleFuelTypesFromRentApi,
  fetchVehicleTransmissionTypesFromRentApi,
  getRentApiErrorMessage,
  type HandoverLocationApiRow,
  type VehicleBodyStyleRow,
} from "@/lib/rent-api";
import { rentKeys } from "@/lib/rent-query-keys";
import {
  bookedDatesForVehicle,
  bookedDatesFromOccupancyRanges,
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
import { validateRentalStepInput } from "@/lib/rental-step-validation";
import type { CustomerKind, Vehicle } from "@/lib/mock-fleet";
import { CustomerPickerDialog } from "@/components/customers/customer-picker-dialog";
import { useCustomerDirectoryRows } from "@/hooks/use-customer-directory-rows";
import { useCustomerRecordStates } from "@/hooks/use-customer-record-states";
import { addManualCustomer } from "@/lib/manual-customers";
import { splitPhoneToCountryAndLocal } from "@/lib/customer-phone-split";
import { sessionCreatedAt, type CustomerAggregateRow } from "@/lib/rental-metadata";
import { mergeVehicleImagesWithDemo } from "@/lib/vehicle-images";
import { rentalCountsForCalendar } from "@/lib/rental-status";
import { PHONE_COUNTRY_CODES } from "@/lib/phone-country-codes";
import { cn } from "@/lib/utils";

import "react-day-picker/style.css";

type Props = {
  vehicle: Vehicle;
  /** Tam sayfa kiralama başlat (popup yok); `/vehicles/[id]/kiralama` rotası */
  rentalFormAsPage?: boolean;
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
type RentalFormStep = 1 | 2 | 3 | 4 | 5;
const COUNTRY_NONE = "__none__";
const SPECS_FUEL_NONE = "__fuel_none__";
const SPECS_TRANS_NONE = "__trans_none__";
const SPECS_BODY_NONE = "__body_none__";
const RENTAL_STEP_META: { step: RentalFormStep; label: string }[] = [
  { step: 1, label: "Tarih" },
  { step: 2, label: "İletişim" },
  { step: 3, label: "Belgeler" },
  { step: 4, label: "Ek sürücü" },
  { step: 5, label: "Özet" },
];

function isBeforeToday(date: Date): boolean {
  return startOfDay(date).getTime() < startOfDay(new Date()).getTime();
}

function sortVehicleCatalogRows(rows: VehicleBodyStyleRow[]): VehicleBodyStyleRow[] {
  return [...rows].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.labelTr.localeCompare(b.labelTr, "tr"),
  );
}

/** Araçta kayıtlı kod katalogda yoksa veya boşsa `none` döner (Select değeri tutarlı kalsın). */
function catalogCodeIfKnown(
  stored: string | undefined,
  rows: VehicleBodyStyleRow[],
  noneToken: string,
): string {
  const s = (stored ?? "").trim();
  if (!s) return noneToken;
  const hit = rows.find((r) => r.code.toLowerCase() === s.toLowerCase());
  return hit ? hit.code : noneToken;
}

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

export function VehicleDetailClient({ vehicle, rentalFormAsPage = false }: Props) {
  const router = useRouter();
  const { allSessions, createRental } = useFleetSessions();
  const { data: customerRecordStates } = useCustomerRecordStates();
  const customerDirectoryRows = useCustomerDirectoryRows(allSessions, customerRecordStates);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const { updateVehicle, deleteVehicle } = useFleetVehicles();
  const { countryByCode, countries } = useCountries();
  const today = useMemo(() => new Date(), []);
  const occupancyWindow = useMemo(() => {
    const from = format(startOfDay(addMonths(today, -6)), "yyyy-MM-dd");
    const to = format(startOfDay(addMonths(today, 24)), "yyyy-MM-dd");
    return { from, to };
  }, [today]);
  const { data: occupancyData } = useQuery({
    queryKey: rentKeys.vehicleCalendarOccupancy(vehicle.id, occupancyWindow.from, occupancyWindow.to),
    queryFn: () =>
      fetchVehicleCalendarOccupancyFromRentApi(vehicle.id, occupancyWindow.from, occupancyWindow.to),
  });
  const { data: rentalRequests = [] } = useQuery({
    queryKey: rentKeys.rentalRequests(),
    queryFn: () => fetchRentalRequestsFromRentApi(),
  });
  const { data: vehicleRentalSessions, isPending: vehicleRentalsPending } = useQuery({
    queryKey: rentKeys.rentalsByVehicle(vehicle.id),
    queryFn: () => fetchRentalsFromRentApi({ vehicleId: vehicle.id }),
  });
  const countryMeta = useMemo(() => {
    const cc = vehicle.countryCode?.toUpperCase();
    return cc ? countryByCode.get(cc) : undefined;
  }, [vehicle.countryCode, countryByCode]);
  const status = vehicleFleetStatus(vehicle, allSessions, today, rentalRequests);
  const booked = useMemo(() => {
    if (occupancyData?.ranges != null) {
      return bookedDatesFromOccupancyRanges(occupancyData.ranges);
    }
    return bookedDatesForVehicle(allSessions, vehicle.id);
  }, [occupancyData, allSessions, vehicle.id]);
  /** Günlük: önce bu araç için `GET /rentals?vehicleId=`; yüklenene kadar genel listeden süzüm. */
  const sessionsForThisVehicle = useMemo(() => {
    if (vehicleRentalSessions !== undefined) return vehicleRentalSessions;
    return sessionsForVehicle(allSessions, vehicle.id);
  }, [vehicleRentalSessions, allSessions, vehicle.id]);

  const vehicleRequestLogRows = useMemo(() => {
    return rentalRequests
      .filter((r) => (r.vehicleId ?? "") === vehicle.id && (r.status === "pending" || r.status === "approved"))
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }, [rentalRequests, vehicle.id]);

  const rentalLogs = useMemo(
    () => [...sessionsForThisVehicle].sort((a, b) => sessionCreatedAt(b).localeCompare(sessionCreatedAt(a))),
    [sessionsForThisVehicle],
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [rentalStep, setRentalStep] = useState<RentalFormStep>(1);
  const [maxRentalStepReached, setMaxRentalStepReached] = useState<RentalFormStep>(1);
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
  /** Kiralama ile birlikte yerel müşteri listesine (tarayıcı) kayıt */
  const [saveNewCustomerProfile, setSaveNewCustomerProfile] = useState(false);
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerBirthDate, setNewCustomerBirthDate] = useState("");
  const [newCustomerKind, setNewCustomerKind] = useState<CustomerKind>("individual");
  const [logFilters, setLogFilters] = useState<RentalLogFilterValues>(emptyRentalLogFilters());
  const [reportRange, setReportRange] = useState<ReportRange>("6m");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteVehicleOpen, setDeleteVehicleOpen] = useState(false);
  const [deletingVehicle, setDeletingVehicle] = useState(false);
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
  const [editHighlightsText, setEditHighlightsText] = useState("");
  const [editPickupHandoverId, setEditPickupHandoverId] = useState("");
  const [editReturnHandoverIds, setEditReturnHandoverIds] = useState<string[]>([]);
  const [editPickupHandoverRows, setEditPickupHandoverRows] = useState<HandoverLocationApiRow[]>([]);
  const [editReturnHandoverRows, setEditReturnHandoverRows] = useState<HandoverLocationApiRow[]>([]);
  const [editFuelType, setEditFuelType] = useState(SPECS_FUEL_NONE);
  const [editTransmissionType, setEditTransmissionType] = useState(SPECS_TRANS_NONE);
  const [editBodyStyleCode, setEditBodyStyleCode] = useState(SPECS_BODY_NONE);
  const [editSeats, setEditSeats] = useState("");
  const [editLuggage, setEditLuggage] = useState("");
  const [bodyStyleOptions, setBodyStyleOptions] = useState<VehicleBodyStyleRow[]>([]);
  const [fuelTypeOptions, setFuelTypeOptions] = useState<VehicleBodyStyleRow[]>([]);
  const [transmissionTypeOptions, setTransmissionTypeOptions] = useState<VehicleBodyStyleRow[]>([]);
  const editHighlightsFieldId = useId();

  useEffect(() => {
    if (!editOpen) return;
    setEditHighlightsText((vehicle.highlights ?? []).join("\n"));
  }, [editOpen, vehicle]);

  useEffect(() => {
    if (!editOpen) return;
    setEditFuelType(SPECS_FUEL_NONE);
    setEditTransmissionType(SPECS_TRANS_NONE);
    setEditBodyStyleCode(SPECS_BODY_NONE);
    setEditSeats(vehicle.seats != null ? String(vehicle.seats) : "");
    setEditLuggage(vehicle.luggage != null ? String(vehicle.luggage) : "");
    let cancelled = false;
    void Promise.all([
      fetchVehicleBodyStylesFromRentApi(),
      fetchVehicleFuelTypesFromRentApi(),
      fetchVehicleTransmissionTypesFromRentApi(),
    ]).then(([bodyRows, fuelRows, transRows]) => {
      if (cancelled) return;
      const bodies = sortVehicleCatalogRows(bodyRows);
      const fuels = sortVehicleCatalogRows(fuelRows);
      const trans = sortVehicleCatalogRows(transRows);
      setBodyStyleOptions(bodies);
      setFuelTypeOptions(fuels);
      setTransmissionTypeOptions(trans);
      setEditFuelType(catalogCodeIfKnown(vehicle.fuelType, fuels, SPECS_FUEL_NONE));
      setEditTransmissionType(catalogCodeIfKnown(vehicle.transmissionType, trans, SPECS_TRANS_NONE));
      const b = (vehicle.bodyStyleCode ?? "").trim();
      if (!b) {
        setEditBodyStyleCode(SPECS_BODY_NONE);
        return;
      }
      setEditBodyStyleCode(catalogCodeIfKnown(b, bodies, SPECS_BODY_NONE));
    });
    return () => {
      cancelled = true;
    };
  }, [editOpen, vehicle]);

  useEffect(() => {
    if (!editOpen) return;
    setEditPickupHandoverId(vehicle.defaultPickupHandoverLocation?.id ?? "");
    const fromList = vehicle.returnHandoverLocations?.map((x) => x.id) ?? [];
    setEditReturnHandoverIds(
      fromList.length > 0
        ? fromList
        : vehicle.defaultReturnHandoverLocation?.id
          ? [vehicle.defaultReturnHandoverLocation.id]
          : [],
    );
    void fetchHandoverLocationsFromRentApi("PICKUP").then((rows) =>
      setEditPickupHandoverRows(rows.filter((r) => r.active !== false)),
    );
    void fetchHandoverLocationsFromRentApi("RETURN").then((rows) =>
      setEditReturnHandoverRows(rows.filter((r) => r.active !== false)),
    );
  }, [editOpen, vehicle]);

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
    const filtered = sessionsForThisVehicle.filter((s) => {
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
  }, [sessionsForThisVehicle, today, reportRange, vehicle.rentalDailyPrice, vehicle.commissionEnabled, vehicle.commissionRatePercent]);

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
      { label: "Toplam kiralama", value: <span className="tabular-nums">{sessionsForThisVehicle.length} kayıt</span> },
    ],
    [vehicle, countryMeta, status, sessionsForThisVehicle.length],
  );

  const galleryImages = useMemo(() => mergeVehicleImagesWithDemo(vehicle.images, vehicle.id), [vehicle.images, vehicle.id]);
  const statusLabel = status === "maintenance" ? "Bakımda" : status === "rented" ? "Kirada" : "Müsait";
  const statusClass =
    status === "maintenance"
      ? "border-amber-200 bg-amber-100 text-amber-800"
      : status === "rented"
        ? "border-sky-200 bg-sky-100 text-sky-800"
        : "border-emerald-200 bg-emerald-100 text-emerald-800";
  const dailyPriceLabel =
    vehicle.rentalDailyPrice != null ? `${vehicle.rentalDailyPrice.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ₺` : "—";
  const visualSeed = useMemo(() => {
    let n = 0;
    for (let i = 0; i < vehicle.id.length; i += 1) n = (n * 31 + vehicle.id.charCodeAt(i)) | 0;
    return Math.abs(n);
  }, [vehicle.id]);
  const batteryPct = 45 + (visualSeed % 50);
  const batteryMiles = Math.round(batteryPct * 3.8);
  const totalRangeMiles = 320 + (visualSeed % 120);
  const odometerMiles = 6000 + (visualSeed % 56000);
  const tyrePsi = (33 + ((visualSeed % 70) / 10)).toFixed(1);
  const tyreHealthPct = 82 + (visualSeed % 14);
  const brakeHealthPct = 76 + (visualSeed % 18);
  const heroImage =
    galleryImages.front ??
    galleryImages.left ??
    galleryImages.right ??
    galleryImages.rear ??
    galleryImages.interiorDash ??
    galleryImages.interiorRear;
  const lastRental = rentalLogs[0];
  const lastRentalActor = lastRental?.customer?.fullName?.trim() || lastRental?.customer?.email?.trim() || "Müşteri";
  const lastRentalWhen = lastRental?.createdAt
    ? format(parseISO(lastRental.createdAt), "d MMM HH:mm", { locale: tr })
    : lastRental
      ? `${lastRental.startDate} → ${lastRental.endDate}`
      : "Kayıt bulunamadı";
  const lastRentalInitials = useMemo(() => {
    const parts = lastRentalActor.split(" ").filter(Boolean);
    if (parts.length === 0) return "NA";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }, [lastRentalActor]);

  const initNewRentalFormForDay = useCallback(
    (day: Date) => {
      const d = formatDay(day);
      setPickStart(d);
      setPickEnd("");
      setDateRangeOpen(false);
      setCommissionAmount(estimateCommissionAmount(d, ""));
      setCommissionFlow(vehicle.external ? "pay" : "collect");
      setCommissionCompany(vehicle.externalCompany ?? "");
      setPassportImageDataUrl("");
      setDriverLicenseImageDataUrl("");
      setPhoneCountryCode("+90");
      setPhoneLocal("");
      setDriverLicenseNo("");
      setAdditionalDrivers([]);
      setSaveNewCustomerProfile(false);
      setNewCustomerEmail("");
      setNewCustomerBirthDate("");
      setNewCustomerKind("individual");
      setRentalStep(1);
      setMaxRentalStepReached(1);
    },
    [vehicle.external, vehicle.externalCompany, estimateCommissionAmount],
  );

  const openForDay = useCallback(
    (day: Date) => {
      if (vehicle.maintenance) {
        toast.error("Bu araç bakımda; kiralama oluşturulamaz.");
        return;
      }
      if (isBeforeToday(day)) {
        toast.error("Geçmiş tarih için kiralama oluşturulamaz.");
        return;
      }
      initNewRentalFormForDay(day);
      setDialogOpen(true);
    },
    [vehicle.maintenance, initNewRentalFormForDay],
  );

  useEffect(() => {
    if (!rentalFormAsPage) return;
    if (vehicle.maintenance) {
      toast.error("Bu araç bakımda; kiralama oluşturulamaz.");
      router.replace(`/vehicles/${vehicle.id}`);
      return;
    }
    initNewRentalFormForDay(new Date());
  }, [rentalFormAsPage, vehicle.maintenance, vehicle.id, router, initNewRentalFormForDay]);

  useEffect(() => {
    if (!saveNewCustomerProfile) setNewCustomerKind("individual");
  }, [saveNewCustomerProfile]);

  useEffect(() => {
    if ((!dialogOpen && !rentalFormAsPage) || !vehicle.commissionEnabled) return;
    setCommissionAmount(estimateCommissionAmount(pickStart, pickEnd));
  }, [dialogOpen, rentalFormAsPage, vehicle.commissionEnabled, pickStart, pickEnd, estimateCommissionAmount]);

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

  const applyCustomerFromDirectory = (row: CustomerAggregateRow) => {
    const c = row.customer;
    setFullName(c.fullName);
    setNationalId((c.nationalId ?? "").trim());
    setPassportNo((c.passportNo ?? "").trim());
    setDriverLicenseNo((c.driverLicenseNo ?? "").trim());
    const { code, local } = splitPhoneToCountryAndLocal(c.phone);
    setPhoneCountryCode(code);
    setPhoneLocal(local);
    setPassportImageDataUrl((c.passportImageDataUrl ?? "").trim());
    setDriverLicenseImageDataUrl((c.driverLicenseImageDataUrl ?? "").trim());
    setNewCustomerEmail((c.email ?? "").trim());
    setNewCustomerBirthDate((c.birthDate ?? "").trim().slice(0, 10));
    if (!(c.passportNo ?? "").trim()) {
      toast.message("Pasaport no eksik", { description: "Seçilen kayıtta yoksa formdan tamamlayın." });
    }
    toast.success(`${c.fullName} bilgileri forma yüklendi.`);
  };

  const handleDayClick = (date: Date, modifiers: Record<string, boolean>) => {
    if (vehicle.maintenance) return;
    if (isBeforeToday(date)) {
      toast.message("Geçmiş gün seçilemez", { description: "Kiralama başlangıcı bugün veya sonrası olmalıdır." });
      return;
    }
    if (modifiers.booked) {
      toast.message("Bu gün zaten dolu", { description: "Müsait bir güne tıklayın." });
      return;
    }
    openForDay(date);
  };

  const validateRentalStep = useCallback(
    (step: RentalFormStep): string | null => {
      return validateRentalStepInput({
        step,
        pickStart,
        pickEnd,
        fullName,
        phoneLocal,
        saveNewCustomerProfile,
        newCustomerEmail,
        driverLicenseImageDataUrl,
        passportImageDataUrl,
        additionalDrivers,
      });
    },
    [
      pickStart,
      pickEnd,
      fullName,
      phoneLocal,
      saveNewCustomerProfile,
      newCustomerEmail,
      driverLicenseImageDataUrl,
      passportImageDataUrl,
      additionalDrivers,
    ],
  );

  const goNextRentalStep = useCallback(() => {
    const err = validateRentalStep(rentalStep);
    if (err) {
      toast.error(err);
      return false;
    }
    if (rentalStep < 5) {
      const next = (rentalStep + 1) as RentalFormStep;
      setRentalStep(next);
      setMaxRentalStepReached((prev) => (next > prev ? next : prev));
    }
    return true;
  }, [rentalStep, validateRentalStep]);

  const goPrevRentalStep = useCallback(() => {
    if (rentalStep <= 1) return;
    setRentalStep((prev) => (prev > 1 ? ((prev - 1) as RentalFormStep) : prev));
  }, [rentalStep]);

  const submitRental = async () => {
    const start = pickStart.trim();
    const end = pickEnd.trim();
    const phone = `${phoneCountryCode} ${phoneLocal}`.trim();
    const email = newCustomerEmail.trim();
    if (!fullName.trim() || !phoneLocal.trim()) {
      toast.error("İsim ve telefon zorunludur.");
      return;
    }
    if (saveNewCustomerProfile && !email) {
      toast.error("Yeni müşteri kaydı için e-posta zorunludur.");
      return;
    }
    if (saveNewCustomerProfile && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Geçerli bir e-posta adresi girin.");
      return;
    }
    if (!driverLicenseImageDataUrl || !passportImageDataUrl) {
      toast.error("Ehliyet ve pasaport görselleri zorunlu.");
      return;
    }
    if (!start || !end) {
      toast.error("Başlangıç ve bitiş tarihlerini takvimden seçin.");
      return;
    }
    if (end < start) {
      toast.error("Bitiş tarihi başlangıçtan önce olamaz.");
      return;
    }
    if (start < formatDay(new Date())) {
      toast.error("Kiralama başlangıç tarihi bugünden önce olamaz.");
      return;
    }
    const commissionRaw = commissionAmount.replace(",", ".").trim();
    let commission = 0;
    if (commissionRaw !== "") {
      const n = Number.parseFloat(commissionRaw);
      if (!Number.isFinite(n) || n < 0) {
        toast.error("Komisyon tutarı geçerli bir sayı olmalıdır.");
        return;
      }
      commission = n;
    }
    if (commissionFlow === "pay" && commission > 0 && !commissionCompany.trim()) {
      toast.error("Komisyon ödenecek firmayı girin.");
      return;
    }
    for (const d of additionalDrivers) {
      if (!d.fullName.trim() || !d.birthDate || !d.driverLicenseImageDataUrl || !d.passportImageDataUrl) {
        toast.error("Ek sürücü için isim, doğum tarihi ve iki belge fotoğrafı zorunludur.");
        return;
      }
    }
    const conflict = sessionsForThisVehicle.find(
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
    const requestConflict = rentalRequests.find(
      (r) =>
        (r.vehicleId ?? "") === vehicle.id &&
        (r.status === "pending" || r.status === "approved") &&
        dateRangesOverlap(start, end, r.startDate, r.endDate),
    );
    if (requestConflict) {
      toast.error(
        `Bu tarihlerde bu araç için bekleyen veya onaylı bir talep var (${requestConflict.referenceNo}). Talepler sayfasından kontrol edin.`,
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
          passportNo: passportNo.trim() || "",
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
          driverLicenseNo: d.driverLicenseNo.trim() || "",
          passportNo: d.passportNo.trim() || "",
          driverLicenseImageDataUrl: d.driverLicenseImageDataUrl,
          passportImageDataUrl: d.passportImageDataUrl,
        })),
        status: "active",
      });
      if (saveNewCustomerProfile) {
        addManualCustomer({
          fullName: fullName.trim(),
          nationalId: nationalId.trim() || "",
          passportNo: passportNo.trim(),
          phone,
          email,
          birthDate: newCustomerBirthDate.trim() || undefined,
          driverLicenseNo: driverLicenseNo.trim() || undefined,
          passportImageDataUrl: passportImageDataUrl || undefined,
          driverLicenseImageDataUrl: driverLicenseImageDataUrl || undefined,
          kind: newCustomerKind,
        });
      }
      toast.success(
        saveNewCustomerProfile
          ? "Kiralama oluşturuldu; müşteri müşteri listesine kaydedildi."
          : "Kiralama kaydı oluşturuldu.",
      );
      if (rentalFormAsPage) {
        router.push("/logs");
        return;
      }
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
      setSaveNewCustomerProfile(false);
      setNewCustomerEmail("");
      setNewCustomerBirthDate("");
      setNewCustomerKind("individual");
      setRentalStep(1);
      setMaxRentalStepReached(1);
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
    if (!editPickupHandoverId.trim()) {
      toast.error("Alış noktası seçin.");
      return;
    }
    const seatsParsed =
      editSeats.trim() === "" ? undefined : Number.parseInt(editSeats.trim(), 10);
    if (editSeats.trim() !== "" && (!Number.isFinite(seatsParsed) || seatsParsed! < 1 || seatsParsed! > 20)) {
      toast.error("Koltuk sayısı 1–20 arası veya boş olmalıdır.");
      return;
    }
    const luggageParsed =
      editLuggage.trim() === "" ? undefined : Number.parseInt(editLuggage.trim(), 10);
    if (editLuggage.trim() !== "" && (!Number.isFinite(luggageParsed) || luggageParsed! < 0)) {
      toast.error("Bagaj (valiz) için geçerli bir sayı girin veya boş bırakın.");
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

    const highlightsPayload = editHighlightsText
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, 30);

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
        defaultPickupHandoverLocationId: editPickupHandoverId.trim(),
        returnHandoverLocationIds: editReturnHandoverIds,
        highlights: highlightsPayload,
        fuelType: editFuelType === SPECS_FUEL_NONE ? "" : editFuelType,
        transmissionType: editTransmissionType === SPECS_TRANS_NONE ? "" : editTransmissionType,
        bodyStyleCode: editBodyStyleCode === SPECS_BODY_NONE ? "" : editBodyStyleCode,
        ...(seatsParsed !== undefined ? { seats: seatsParsed } : {}),
        ...(luggageParsed !== undefined ? { luggage: luggageParsed } : {}),
      });
      toast.success("Araç bilgileri güncellendi.");
      setEditOpen(false);
    } catch (e) {
      toast.error(getRentApiErrorMessage(e));
    } finally {
      setSavingVehicle(false);
    }
  };

  const confirmDeleteVehicle = async () => {
    setDeletingVehicle(true);
    try {
      await deleteVehicle(vehicle.id);
      toast.success(`${vehicle.plate} silindi.`);
      setDeleteVehicleOpen(false);
      router.push("/vehicles");
    } catch (e) {
      toast.error(getRentApiErrorMessage(e));
    } finally {
      setDeletingVehicle(false);
    }
  };

  const handleRentalPrimaryAction = useCallback(() => {
    if (rentalStep < 5) {
      void goNextRentalStep();
      return;
    }
    void submitRental();
  }, [rentalStep, goNextRentalStep, submitRental]);

  const handleRentalSecondaryAction = useCallback(() => {
    if (rentalStep > 1) {
      goPrevRentalStep();
      return;
    }
    if (rentalFormAsPage) {
      router.push("/logs");
      return;
    }
    setDialogOpen(false);
  }, [rentalStep, goPrevRentalStep, rentalFormAsPage, router]);

  const rentalFormGrid = (
    <div className="grid gap-3 py-1">
      <div className="overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
        <div className="flex min-w-min gap-1.5">
          {RENTAL_STEP_META.map(({ step, label }) => {
            const active = rentalStep === step;
            const done = step < rentalStep;
            const reachable = step <= maxRentalStepReached;
            return (
              <button
                key={`rental-step-${step}`}
                type="button"
                disabled={!reachable}
                onClick={() => reachable && setRentalStep(step)}
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  active && "border-primary bg-primary text-primary-foreground",
                  done && !active && "border-emerald-500/40 bg-emerald-500/10 text-emerald-900",
                  !active && !done && reachable && "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50",
                  !reachable && "cursor-not-allowed border-border/50 opacity-40",
                )}
              >
                <span className="tabular-nums">{step}</span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {rentalStep === 1 && (
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
      )}

      {rentalStep === 2 && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Müşteri</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCustomerPickerOpen(true)}
                className="flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-lg border border-border/80 bg-background px-2 py-2.5 text-center shadow-sm transition hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <UserCircle2 className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="text-[11px] font-semibold leading-tight text-foreground">Kayıtlı müşteri seç</span>
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={saveNewCustomerProfile}
                onClick={() => setSaveNewCustomerProfile((s) => !s)}
                className={cn(
                  "flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2.5 text-center shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  saveNewCustomerProfile
                    ? "border-emerald-500/50 bg-emerald-500/10 dark:border-emerald-400/40 dark:bg-emerald-500/15"
                    : "border-border/80 bg-muted/15 hover:border-border hover:bg-muted/30",
                )}
              >
                <UserPlus className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="text-[11px] font-semibold leading-tight text-foreground">Yeni Müşteri Kaydet</span>
              </button>
            </div>
          </div>
          {saveNewCustomerProfile && (
            <div className="space-y-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5 dark:border-emerald-500/25 dark:bg-emerald-500/10">
              <div className="space-y-1.5">
                <Label className="text-xs">Müşteri türü</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCustomerKind("individual")}
                    className={cn(
                      "flex min-h-[3rem] items-center justify-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      newCustomerKind === "individual"
                        ? "border-emerald-500/50 bg-emerald-500/15 dark:border-emerald-400/40"
                        : "border-border/70 bg-background/80 hover:bg-muted/40",
                    )}
                  >
                    <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    Bireysel
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCustomerKind("corporate")}
                    className={cn(
                      "flex min-h-[3rem] items-center justify-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      newCustomerKind === "corporate"
                        ? "border-emerald-500/50 bg-emerald-500/15 dark:border-emerald-400/40"
                        : "border-border/70 bg-background/80 hover:bg-muted/40",
                    )}
                  >
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    Kurumsal
                  </button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="new-cust-email" className="text-xs">
                    E-posta *
                  </Label>
                  <Input
                    id="new-cust-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={newCustomerEmail}
                    onChange={(e) => setNewCustomerEmail(e.target.value)}
                    placeholder="ornek@email.com"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-cust-birth" className="text-xs">
                    Doğum tarihi
                  </Label>
                  <Input
                    id="new-cust-birth"
                    type="date"
                    value={newCustomerBirthDate}
                    onChange={(e) => setNewCustomerBirthDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="fn">{saveNewCustomerProfile && newCustomerKind === "corporate" ? "Firma / unvan" : "İsim soyisim"}</Label>
            <Input
              id="fn"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={saveNewCustomerProfile && newCustomerKind === "corporate" ? "Örn: ABC Lojistik A.Ş." : "Ad Soyad"}
            />
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
        </>
      )}

      {rentalStep === 3 && (
        <>
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
        </>
      )}

      {rentalStep === 4 && (
        <>
          <div className="space-y-1">
            <Label htmlFor="commission">Komisyon tutarı</Label>
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
        </>
      )}

      {rentalStep === 5 && (
        <div className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-3 text-xs">
          <p>
            <span className="font-medium">Araç:</span> {vehicle.plate} — {vehicle.brand} {vehicle.model}
          </p>
          <p>
            <span className="font-medium">Tarihler:</span> {pickStart || "—"} → {pickEnd || "—"}
          </p>
          <p>
            <span className="font-medium">Müşteri:</span> {fullName || "—"}
          </p>
          <p>
            <span className="font-medium">Telefon:</span> {phoneCountryCode} {phoneLocal || "—"}
          </p>
          <p>
            <span className="font-medium">Ek sürücü:</span> {additionalDrivers.length > 0 ? "Var" : "Yok"}
          </p>
          <p>
            <span className="font-medium">Komisyon:</span> {commissionAmount || "0"}
          </p>
        </div>
      )}
    </div>
  );

  if (rentalFormAsPage) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-1 sm:px-0">
        <Card className="glow-card overflow-hidden">
          <CardHeader className="space-y-1 pb-2 pt-4">
            <CardTitle className="text-base">Yeni kiralama</CardTitle>
            <CardDescription className="text-xs">
              {vehicle.plate} — {vehicle.brand} {vehicle.model}
            </CardDescription>
          </CardHeader>
          <CardContent className="max-h-[min(72vh,calc(100dvh-12rem))] overflow-y-auto px-4 pb-2 pt-0 sm:px-6">
            {rentalFormGrid}
          </CardContent>
          <CardFooter className="flex flex-col-reverse gap-2 border-t border-border/60 bg-muted/10 px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
            <Button type="button" variant="outline" size="sm" className="h-9 w-full text-xs sm:w-auto" onClick={handleRentalSecondaryAction}>
              {rentalStep > 1 ? "Geri" : "İptal"}
            </Button>
            <Button type="button" size="sm" variant="hero" className="h-9 w-full text-xs sm:w-auto" onClick={handleRentalPrimaryAction}>
              {rentalStep < 5 ? "İleri" : "Kaydet"}
            </Button>
          </CardFooter>
        </Card>
        <CustomerPickerDialog
          open={customerPickerOpen}
          onOpenChange={setCustomerPickerOpen}
          rows={customerDirectoryRows}
          onPick={applyCustomerFromDirectory}
        />
      </div>
    );
  }

  return (
    <div className="bg-background pb-44 md:pb-10">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-4 md:max-w-7xl md:space-y-5 md:px-0 md:py-0">
      <section className="grid grid-cols-1 gap-4 md:hidden">
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
          <div className="aspect-[16/10] w-full">
            {heroImage ? (
              <img src={heroImage} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">Görsel yok</div>
            )}
          </div>
          <div className="absolute left-4 top-4">
            <span className={cn("inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold shadow", statusClass, "bg-white/90")}>
              <span className="h-2 w-2 rounded-full bg-current" />
              {statusLabel}
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent p-4">
            <h2 className="truncate text-2xl font-bold text-white">
              {vehicle.brand} {vehicle.model}
            </h2>
            <p className="font-mono text-xs text-white/90">{vehicle.plate}</p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Premium Fleet</p>
            <h3 className="text-3xl font-bold text-slate-900">{vehicle.brand} {vehicle.model}</h3>
            <p className="text-sm text-slate-500">{vehicle.year} • {countryMeta?.name ?? "Bölge bilgisi yok"} • {vehicle.plate}</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-center shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Mileage</p>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-900">{odometerMiles.toLocaleString("tr-TR")} km</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-center shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Battery</p>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-900">{batteryPct}%</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-center shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Daily</p>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-900">{dailyPriceLabel}</p>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-900">Recent Activity</h4>
              <span className="text-[11px] text-primary">Live</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sky-600">
                <KeyRound className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900">Last Check-out</p>
                <p className="text-[11px] text-slate-500">{lastRentalActor} • {lastRentalWhen}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900">Service Due</p>
                <p className="text-[11px] text-slate-500">{status === "maintenance" ? "Bakım modunda" : "Yaklaşık 1,200 mil içinde"}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex overflow-x-auto border-b border-slate-200 md:hidden">
        <button type="button" className="whitespace-nowrap border-b-2 border-primary px-5 py-3 text-xs font-semibold uppercase tracking-wide text-primary">
          Specs
        </button>
        <button type="button" className="whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          History
        </button>
        <button type="button" className="whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Maintenance
        </button>
        <button type="button" className="whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Documents
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 md:hidden">
        <Button type="button" size="sm" variant="outline" className="h-11 w-full gap-1.5 text-xs sm:h-10 sm:text-sm" asChild>
          <Link href={`/vehicles/${vehicle.id}/options`}>
            <PackagePlus className="h-3.5 w-3.5" />
            Opsiyon ekle
          </Link>
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-11 w-full gap-1.5 text-xs sm:h-10 sm:text-sm" onClick={() => setEditOpen(true)}>
          Araç güncelle
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-11 w-full gap-1.5 text-xs sm:h-10 sm:text-sm"
          disabled={vehicle.maintenance}
          onClick={() => openForDay(new Date())}
        >
          <KeyRound className="h-3.5 w-3.5" />
          Kiralama başlat
        </Button>
      </div>

      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 md:hidden">
        <div className="min-w-[170px] rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] text-slate-500">Total Range</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">{totalRangeMiles} mi</p>
        </div>
        <div className="min-w-[170px] rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] text-slate-500">Tyre PSI</p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-slate-900">{tyrePsi}</p>
        </div>
        <div className="min-w-[170px] rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] text-slate-500">Fleet Health</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">{status === "maintenance" ? "Service" : "Optimal"}</p>
        </div>
      </div>

      <div className="space-y-4 md:hidden">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Technical Specifications</h3>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Transmission</p>
              <p className="mt-1 text-sm text-slate-900">{vehicle.transmissionType || "Auto"}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Fuel Type</p>
              <p className="mt-1 text-sm text-slate-900">{vehicle.fuelType || "Electric"}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Seats</p>
              <p className="mt-1 text-sm text-slate-900">{vehicle.seats ? `${vehicle.seats} Seats` : "5 Seats"}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">License Plate</p>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-900">{vehicle.plate}</p>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-base font-semibold text-slate-900">Recent Rental</h3>
            <Link href="/logs" className="text-xs font-semibold text-primary">
              View All
            </Link>
          </div>
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-slate-800">
                {lastRentalInitials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{lastRentalActor}</p>
                <p className="text-xs text-slate-500">{lastRentalWhen}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900">{dailyPriceLabel}</p>
              <p className="text-[11px] text-emerald-600">{lastRental ? "Completed" : "No record"}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-primary p-4 text-white shadow-lg">
          <h4 className="mb-3 text-base font-semibold">Location Overview</h4>
          <div className="relative mb-3 h-40 overflow-hidden rounded-lg">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuC5EEmKzovqUuI2VTPJL0wOLvh2cQ1e6lHIOVblgDTbxa2lWqEbNaUSQq74aCpawqBrA6TaQzzTEFWKNPC123SzQvwnlfvRHyuVntvPqQLQ1d7nMnUEU7OZPEKYDuRJwXQrj6OYAuEDmPGba_IqdBVF5kPOj6NdKCS5Cn7cfSiwlQuDKVt-HkJgsrgo1Px5aoFbwFuT9gp0FusBOON2OLsDexcUhOw-ZgcLw-HV_oOkCRWUWkncZcfHkI4H29Zi5InBubCe9BUxyg"
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
          <p className="text-xs text-white/90">{countryMeta?.name ?? "Terminal 3 Garage"} • {vehicle.plate}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h4 className="mb-3 text-base font-semibold text-slate-900">Asset Health</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Tires</span>
              <span className="font-medium text-slate-900">{tyreHealthPct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-emerald-400" style={{ width: `${tyreHealthPct}%` }} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Brakes</span>
              <span className="font-medium text-slate-900">{brakeHealthPct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-emerald-400" style={{ width: `${brakeHealthPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="hidden grid-cols-1 gap-2 sm:grid-cols-3 md:grid">
        <Button type="button" size="sm" variant="outline" className="h-10 w-full gap-1.5 text-sm" asChild>
          <Link href={`/vehicles/${vehicle.id}/options`}>
            <PackagePlus className="h-3.5 w-3.5" />
            Opsiyon ekle
          </Link>
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-10 w-full gap-1.5 text-sm" onClick={() => setEditOpen(true)}>
          Araç güncelle
        </Button>
        <Button type="button" size="sm" className="h-10 w-full gap-1.5 text-sm" disabled={vehicle.maintenance} onClick={() => openForDay(new Date())}>
          <KeyRound className="h-3.5 w-3.5" />
          Kiralama başlat
        </Button>
      </div>

      <div className="hidden grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start md:grid">
        <Card className="order-1 min-w-0 overflow-hidden rounded-xl border-slate-200 shadow-sm lg:col-span-2">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm">Galeri ve medya yönetimi</CardTitle>
            <CardDescription className="text-xs">Araç görsellerini önizleyin veya güncelleyin.</CardDescription>
          </CardHeader>
          <CardContent className="pb-4 pt-0">
            <Tabs defaultValue="preview" className="w-full">
              <TabsList className="mb-3 h-9 w-full justify-start gap-1 overflow-x-auto rounded-xl bg-muted/70 p-1 sm:w-auto">
                <TabsTrigger value="preview" className="rounded-lg px-3 text-xs">
                  Önizleme
                </TabsTrigger>
                <TabsTrigger value="edit" className="rounded-lg px-3 text-xs">
                  Düzenle
                </TabsTrigger>
              </TabsList>
              <TabsContent value="preview" className="mt-0 outline-none">
                <VehicleDetailListingGallery key={vehicle.id} images={galleryImages} />
              </TabsContent>
              <TabsContent value="edit" className="mt-0 outline-none">
                <VehicleImageSlotsRemoteEditor
                  vehicleId={vehicle.id}
                  images={vehicle.images}
                  fallbackImages={galleryImages}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="order-2 min-w-0 overflow-hidden rounded-xl border-slate-200 shadow-sm">
          <CardHeader className="py-4 pb-2">
            <CardTitle className="text-sm">Araç bilgileri</CardTitle>
            <CardDescription className="text-xs">Plaka, marka, model ve operasyonel özet.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/60">
              {vehicleInfoRows.map((row) => (
                <div
                  key={`vehicle-info-${row.label}`}
                  className="grid gap-0.5 bg-background px-3 py-2.5 transition-colors hover:bg-muted/40 sm:grid-cols-[160px_1fr] sm:items-center sm:gap-3 sm:px-4"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{row.label}</p>
                  <div className="text-sm font-medium break-words">{row.value}</div>
                </div>
              ))}
            </div>
            {vehicle.highlights && vehicle.highlights.length > 0 ? (
              <div className="border-t border-border/60 px-3 py-3 sm:px-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Öne çıkanlar</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm font-medium text-foreground/90">
                  {vehicle.highlights.map((h, i) => (
                    <li key={`${i}-${h.slice(0, 24)}`}>{h}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="hidden rounded-xl border-slate-200 shadow-sm md:block">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Operasyon merkezi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Tabs defaultValue="availability" className="w-full">
            <TabsList className="h-10 w-full justify-start gap-1 overflow-x-auto rounded-xl bg-muted/70 p-1">
              <TabsTrigger value="availability" className="whitespace-nowrap gap-1 rounded-lg px-3 text-xs">
                <CalendarDays className="h-3.5 w-3.5" />
                Müsaitlik takvimi
              </TabsTrigger>
              <TabsTrigger value="report" className="whitespace-nowrap gap-1 rounded-lg px-3 text-xs">
                <BarChart3 className="h-3.5 w-3.5" />
                Rapor
              </TabsTrigger>
              <TabsTrigger value="logs" className="whitespace-nowrap gap-1 rounded-lg px-3 text-xs">
                <ScrollText className="h-3.5 w-3.5" />
                Kiralama günlüğü
              </TabsTrigger>
            </TabsList>

            <TabsContent value="availability" className="space-y-3">
              <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-3 sm:px-5">
                  <p className="text-sm font-semibold text-slate-900">Müsaitlik Takvimi</p>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Aktif</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-500" />Tamamlandı</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />Bakım</span>
                  </div>
                </div>
                <RentAvailabilityCalendar
                  locale={tr}
                  booked={booked}
                  disabled={(day) => vehicle.maintenance || isBeforeToday(day)}
                  onDayClick={handleDayClick}
                />
                <div className="border-t border-slate-100 px-3 pb-2 pt-1 sm:px-5">
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
                Kesin kiralamalar bu araç için sunucudan ayrı yüklenir; bekleyen veya onaylı talepler aşağıda listelenir. Müşteri özetleri:{" "}
                <Link href="/customers" className="font-medium text-primary underline-offset-2 hover:underline">
                  Customers
                </Link>
                {" · "}
                <Link href="/logs" className="font-medium text-primary underline-offset-2 hover:underline">
                  Tüm kiralamalar
                </Link>
                {" · "}
                <Link href="/logs?sekme=istekler" className="font-medium text-primary underline-offset-2 hover:underline">
                  Kiralama istekleri
                </Link>
              </p>
              {vehicleRentalsPending &&
              vehicleRentalSessions === undefined &&
              rentalLogs.length === 0 &&
              vehicleRequestLogRows.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">Kiralama günlüğü sunucudan yükleniyor…</p>
              ) : null}
              {vehicleRequestLogRows.length > 0 ? (
                <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-foreground">Kiralama talepleri (bu araç)</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Kesin kira kaydı oluşmadan önceki rezervasyonlar burada görünür; günlükte yalnızca{" "}
                    <span className="font-medium text-foreground">/rentals</span> listelenir.
                  </p>
                  <div className="mt-2 overflow-x-auto rounded-md border border-border/60 bg-background">
                    <Table className="min-w-[520px] text-xs">
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Referans</TableHead>
                          <TableHead>Statü</TableHead>
                          <TableHead>Müşteri · dönem</TableHead>
                          <TableHead>Oluşturulma</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vehicleRequestLogRows.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-mono text-[11px] font-semibold">{r.referenceNo}</TableCell>
                            <TableCell>
                              <Badge variant={r.status === "approved" ? "success" : "warning"} className="text-[10px]">
                                {r.status === "approved" ? "Onaylı" : "Beklemede"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-[11px] text-muted-foreground">
                              <span className="text-foreground">{r.customer.fullName}</span>
                              {" · "}
                              <span className="font-mono">{r.startDate}</span> → <span className="font-mono">{r.endDate}</span>
                            </TableCell>
                            <TableCell className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                              {r.createdAt ? format(parseISO(r.createdAt), "d MMM yyyy HH:mm", { locale: tr }) : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : null}
              {rentalLogs.length === 0 && vehicleRequestLogRows.length === 0 && !vehicleRentalsPending ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Bu araç için henüz kesin kiralama veya bekleyen/onaylı talep görünmüyor.
                </p>
              ) : null}
              {rentalLogs.length > 0 ? (
                <>
                  <RentalLogFiltersBar values={logFilters} onChange={setLogFilters} />
                  <RentalLogEntries sessions={filteredRentalLogs} expandableDetails />
                </>
              ) : vehicleRequestLogRows.length > 0 && !vehicleRentalsPending ? (
                <p className="text-[11px] text-muted-foreground">
                  Kesin kiralama satırı yok. Talep onaylandıktan sonra kira oluşturulduğunda burada listelenir.
                </p>
              ) : null}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card className="hidden rounded-xl border-destructive/35 bg-gradient-to-b from-destructive/[0.06] to-destructive/[0.02] shadow-sm md:block">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            Tehlikeli bölge
          </CardTitle>
          <CardDescription className="text-xs text-destructive/85">
            Bu aracı silmek kalıcıdır; plaka <span className="font-mono">{vehicle.plate}</span> ile ilişkili kayıtlar etkilenebilir.
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-4 pt-0">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="h-9 w-full text-xs sm:w-auto"
            onClick={() => setDeleteVehicleOpen(true)}
          >
            Aracı sil
          </Button>
        </CardContent>
      </Card>

        </div>

        <div className="fixed bottom-16 left-0 z-40 flex w-full items-center justify-around border-t border-slate-200 bg-white/85 px-4 py-3 backdrop-blur md:hidden">
          <Button type="button" variant="outline" className="mr-2 h-11 flex-1 text-xs" onClick={() => setEditOpen(true)}>
            Edit Details
          </Button>
          <Button
            type="button"
            className="ml-2 h-11 flex-[1.5] text-xs"
            disabled={vehicle.maintenance}
            onClick={() => openForDay(new Date())}
          >
            Book Now
          </Button>
        </div>

        <nav className="fixed bottom-0 left-0 z-40 flex w-full items-center justify-around border-t border-slate-200 bg-white/90 px-3 py-2 backdrop-blur md:hidden">
          <button type="button" className="flex flex-col items-center justify-center rounded-xl bg-blue-50 px-3 py-1 text-blue-600">
            <CarFront className="h-4 w-4" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Fleet</span>
          </button>
          <button type="button" className="flex flex-col items-center justify-center px-3 py-1 text-slate-400">
            <History className="h-4 w-4" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">History</span>
          </button>
          <button type="button" className="flex flex-col items-center justify-center px-3 py-1 text-slate-400">
            <BarChart3 className="h-4 w-4" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Stats</span>
          </button>
          <button type="button" className="flex flex-col items-center justify-center px-3 py-1 text-slate-400">
            <Bell className="h-4 w-4" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Alerts</span>
          </button>
        </nav>

      <Dialog open={deleteVehicleOpen} onOpenChange={(open) => !deletingVehicle && setDeleteVehicleOpen(open)}>
        <DialogContent className="max-w-md rounded-2xl border border-border/60 bg-card/95 shadow-xl">
          <DialogHeader>
            <DialogTitle>Araç silinsin mi?</DialogTitle>
            <DialogDescription className="text-xs">
              <span className="font-mono">{vehicle.plate}</span> kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="destructive" size="sm" onClick={() => void confirmDeleteVehicle()} disabled={deletingVehicle}>
              {deletingVehicle ? "Siliniyor…" : "Evet, sil"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setDeleteVehicleOpen(false)} disabled={deletingVehicle}>
              Vazgeç
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <div className="space-y-1">
              <Label htmlFor="vd-edit-fleet-op" className="text-xs">
                Filo durumu
              </Label>
              <Select
                value={editMaintenance ? "maintenance" : "available"}
                onValueChange={(v) => setEditMaintenance(v === "maintenance")}
              >
                <SelectTrigger id="vd-edit-fleet-op" className="h-9 w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Müsait</SelectItem>
                  <SelectItem value="maintenance">Bakımda</SelectItem>
                  <SelectItem value="rented" disabled>
                    Kirada (kiralama veya taleple oluşur)
                  </SelectItem>
                </SelectContent>
              </Select>
              {status === "rented" && !editMaintenance ? (
                <p className="text-[11px] text-muted-foreground">Kirada rozeti etkin kiralama veya talebe göre gösterilir.</p>
              ) : null}
            </div>
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
            <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Araç özellikleri
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Yakıt, vites ve gövde tipi listelerden; bagaj sayısını elle girin (ör. 5 valiz).
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Yakıt türü</Label>
                  <Select value={editFuelType} onValueChange={setEditFuelType}>
                    <SelectTrigger className="h-9 w-full text-xs">
                      <SelectValue placeholder="Seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SPECS_FUEL_NONE}>Seçilmedi</SelectItem>
                      {fuelTypeOptions.map((o) => (
                        <SelectItem key={o.id || o.code} value={o.code}>
                          {o.labelTr || o.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Vites türü</Label>
                  <Select value={editTransmissionType} onValueChange={setEditTransmissionType}>
                    <SelectTrigger className="h-9 w-full text-xs">
                      <SelectValue placeholder="Seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SPECS_TRANS_NONE}>Seçilmedi</SelectItem>
                      {transmissionTypeOptions.map((o) => (
                        <SelectItem key={o.id || o.code} value={o.code}>
                          {o.labelTr || o.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Araç türü</Label>
                  <Select value={editBodyStyleCode} onValueChange={setEditBodyStyleCode}>
                    <SelectTrigger className="h-9 w-full text-xs">
                      <SelectValue placeholder="Seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SPECS_BODY_NONE}>Seçilmedi</SelectItem>
                      {bodyStyleOptions.map((o) => (
                        <SelectItem key={o.code} value={o.code}>
                          {o.labelTr || o.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Koltuk sayısı</Label>
                  <Input
                    className="h-9 text-xs"
                    inputMode="numeric"
                    placeholder="Örn. 5"
                    value={editSeats}
                    onChange={(e) => setEditSeats(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Bagaj (valiz sayısı)</Label>
                  <Input
                    className="h-9 text-xs"
                    inputMode="numeric"
                    placeholder="Örn. 5"
                    value={editLuggage}
                    onChange={(e) => setEditLuggage(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Ülke</Label>
              <Select value={editCountryCode} onValueChange={setEditCountryCode}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Ülke seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={COUNTRY_NONE}>Atanmadı</SelectItem>
                  {countries.map((c) => (
                    <SelectItem key={c.id} value={c.code}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm border border-border/60"
                          style={{ backgroundColor: c.colorCode }}
                          aria-hidden
                        />
                        {c.name} ({c.code})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Alış noktası</Label>
              <Select value={editPickupHandoverId || undefined} onValueChange={setEditPickupHandoverId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="PICKUP seçin" />
                </SelectTrigger>
                <SelectContent>
                  {editPickupHandoverRows.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Teslim noktaları</Label>
              <p className="text-[11px] text-muted-foreground">
                Açılır listede arayıp birden fazla işaretleyebilirsiniz. Hiçbiri yoksa bu araç için teslim kısıtı kalkar.
              </p>
              <HandoverReturnMultiCombobox
                locations={editReturnHandoverRows}
                value={editReturnHandoverIds}
                onChange={setEditReturnHandoverIds}
                placeholder="Teslim noktası seçin…"
                emptyMessage="Önce ayarlardan RETURN noktası tanımlayın"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={editHighlightsFieldId}>Öne çıkanlar (opsiyonel)</Label>
              <textarea
                id={editHighlightsFieldId}
                value={editHighlightsText}
                onChange={(e) => setEditHighlightsText(e.target.value)}
                placeholder={"Her satır bir madde (en fazla 30).\nBoş bırakırsanız listeden kaldırılır."}
                rows={4}
                className="flex min-h-[88px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
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
          {rentalFormGrid}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={handleRentalSecondaryAction}>
              {rentalStep > 1 ? "Geri" : "İptal"}
            </Button>
            <Button size="sm" variant="hero" onClick={handleRentalPrimaryAction}>
              {rentalStep < 5 ? "İleri" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CustomerPickerDialog
        open={customerPickerOpen}
        onOpenChange={setCustomerPickerOpen}
        rows={customerDirectoryRows}
        onPick={applyCustomerFromDirectory}
      />
    </div>
  );
}
