"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { addDays, addMonths, addYears, differenceInCalendarDays, eachDayOfInterval, format, isSameDay, parseISO, startOfDay, startOfMonth } from "date-fns";
import { tr } from "date-fns/locale";
import { DayPicker, type DateRange } from "react-day-picker";
import { toast } from "@/components/ui/sonner";
import { RentalFormOptionsLists } from "@/components/rental-form/rental-form-options-lists";
import { QuickAddReservationExtraDialog } from "@/components/rental-form/quick-add-reservation-extra-dialog";
import { VehicleOptionsTemplatesDialog } from "@/components/rental-form/vehicle-options-templates-dialog";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  BriefcaseBusiness,
  CarFront,
  CalendarDays,
  Car,
  ChevronDown,
  CheckCircle2,
  Fuel,
  KeyRound,
  MapPin,
  PackagePlus,
  Settings2,
  ScrollText,
  Sparkles,
  User,
  UserCircle2,
  UserPlus,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HandoverReturnMultiCombobox } from "@/components/vehicles/handover-return-multi-combobox";
import { VehicleDetailListingGallery } from "@/components/vehicles/vehicle-detail-listing-gallery";
import { VehicleImageSlotsRemoteEditor } from "@/components/vehicles/vehicle-image-slots-remote-editor";
import {
  heldRangeBackdropModifiersFromRange,
  RentAvailabilityCalendar,
} from "@/components/rent-calendar/rent-availability-calendar";
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
  fetchReservationExtraOptionTemplatesFromRentApi,
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
  resolveVehicleFleetUiStatus,
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

import "@/components/rent-calendar/rent-calendar.css";
import "react-day-picker/style.css";

type Props = {
  vehicle: Vehicle;
  /** Tam sayfa yeni kiralama: `/vehicles/[id]/new-rent` — `vehicleNewRentHref` ile link. */
  rentalFormAsPage?: boolean;
};

type AdditionalDriverDraft = {
  fullName: string;
  driverLicenseImageDataUrl: string;
};

type ReportRange = "1w" | "1m" | "6m" | "1y";
type RentalFormStep = 1 | 2 | 3 | 4 | 5;
type MobileVehicleTab = "summary" | "technical" | "history";
const COUNTRY_NONE = "__none__";
const SPECS_FUEL_NONE = "__fuel_none__";
const SPECS_TRANS_NONE = "__trans_none__";
const SPECS_BODY_NONE = "__body_none__";
const RENTAL_STEP_META: { step: RentalFormStep; label: string }[] = [
  { step: 1, label: "Tarih" },
  { step: 2, label: "İletişim" },
  { step: 3, label: "Belgeler" },
  { step: 4, label: "Opsiyonlar" },
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
    driverLicenseImageDataUrl: "",
  };
}

function vehicleRentalCommissionSnapshot(
  vehicle: Vehicle,
  pickStart: string,
  pickEnd: string,
): { amount: number; flow: "collect" | "pay"; company: string | undefined } {
  const flow: "collect" | "pay" = vehicle.external ? "pay" : "collect";
  const company = vehicle.externalCompany?.trim() ? vehicle.externalCompany.trim() : undefined;
  if (!vehicle.commissionEnabled || vehicle.commissionRatePercent == null || vehicle.rentalDailyPrice == null) {
    return { amount: 0, flow, company };
  }
  const a = pickStart.trim();
  const b = pickEnd.trim();
  if (!a || !b) return { amount: 0, flow, company };
  try {
    const rentalDays = Math.max(1, differenceInCalendarDays(parseISO(b), parseISO(a)) + 1);
    const gross = rentalDays * vehicle.rentalDailyPrice;
    const amount = Math.round(((gross * vehicle.commissionRatePercent) / 100) * 100) / 100;
    return { amount, flow, company };
  } catch {
    return { amount: 0, flow, company };
  }
}

function formatVehicleCommissionSummary(snapshot: ReturnType<typeof vehicleRentalCommissionSnapshot>): string {
  if (snapshot.amount <= 0) {
    return "Bu kiralama için araçtan hesaplanan komisyon kalemi yok.";
  }
  const dir = snapshot.flow === "pay" ? "gider · ödenecek" : "gelir · alınacak";
  const amt = snapshot.amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const firm = snapshot.company ? ` · ${snapshot.company}` : "";
  return `${amt} ₺ · ${dir}${firm}`;
}

function formatTryAmount(amount: number): string {
  return amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function greenInsuranceFeeDisplayTry(): number {
  const n = Number(process.env.NEXT_PUBLIC_GREEN_INSURANCE_FEE);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function normalizeRentalPickupRangeSelection(range: DateRange | undefined): {
  pickStart: string;
  pickEnd: string;
  coercedSameDayToNextDay: boolean;
} {
  if (!range?.from) {
    return { pickStart: "", pickEnd: "", coercedSameDayToNextDay: false };
  }
  const pickStart = format(range.from, "yyyy-MM-dd");
  if (!range.to) {
    return { pickStart, pickEnd: "", coercedSameDayToNextDay: false };
  }
  let pickEnd = format(range.to, "yyyy-MM-dd");
  if (pickEnd <= pickStart) {
    pickEnd = format(addDays(parseISO(pickStart), 1), "yyyy-MM-dd");
    return { pickStart, pickEnd, coercedSameDayToNextDay: true };
  }
  return { pickStart, pickEnd, coercedSameDayToNextDay: false };
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
  const { data: reservationExtraTemplates = [], isPending: reservationExtrasPending } = useQuery({
    queryKey: rentKeys.reservationExtraOptionTemplates(false),
    queryFn: () => fetchReservationExtraOptionTemplatesFromRentApi({ includeInactive: false }),
  });
  const { data: vehicleRentalSessions, isPending: vehicleRentalsPending } = useQuery({
    queryKey: rentKeys.rentalsByVehicle(vehicle.id),
    queryFn: () => fetchRentalsFromRentApi({ vehicleId: vehicle.id }),
  });
  const countryMeta = useMemo(() => {
    const cc = vehicle.countryCode?.toUpperCase();
    return cc ? countryByCode.get(cc) : undefined;
  }, [vehicle.countryCode, countryByCode]);
  const status = resolveVehicleFleetUiStatus(vehicle, allSessions, today, rentalRequests);
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
  const [rentalVehiclePanelOpen, setRentalVehiclePanelOpen] = useState(false);
  const [pickStart, setPickStart] = useState<string>("");
  const [pickEnd, setPickEnd] = useState<string>("");
  const [rentalDateSummaryLock, setRentalDateSummaryLock] = useState<{ start: string; end: string } | null>(null);
  const rentalPickRangeRef = useRef<{ start: string; end: string }>({ start: "", end: "" });
  const [fullName, setFullName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [passportNo, setPassportNo] = useState("");
  const [driverLicenseNo, setDriverLicenseNo] = useState("");
  const [passportImageDataUrl, setPassportImageDataUrl] = useState("");
  const [driverLicenseImageDataUrl, setDriverLicenseImageDataUrl] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+90");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [additionalDrivers, setAdditionalDrivers] = useState<AdditionalDriverDraft[]>([]);
  const [selectedRentExtraIds, setSelectedRentExtraIds] = useState<string[]>([]);
  const [selectedVehicleOptIds, setSelectedVehicleOptIds] = useState<string[]>([]);
  const [quickRentExtraOpen, setQuickRentExtraOpen] = useState(false);
  const [vehicleOptsDialogOpen, setVehicleOptsDialogOpen] = useState(false);
  const [rentalOutsideCountryTravel, setRentalOutsideCountryTravel] = useState(false);
  const [rentalInternalNote, setRentalInternalNote] = useState("");
  /** Kiralama ile birlikte yerel müşteri listesine (tarayıcı) kayıt */
  const [saveNewCustomerProfile, setSaveNewCustomerProfile] = useState(false);
  const [customerEmail, setCustomerEmail] = useState("");
  const [newCustomerBirthDate, setNewCustomerBirthDate] = useState("");
  const [newCustomerKind, setNewCustomerKind] = useState<CustomerKind>("individual");
  const [logFilters, setLogFilters] = useState<RentalLogFilterValues>(emptyRentalLogFilters());
  const [reportRange, setReportRange] = useState<ReportRange>("6m");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteVehicleOpen, setDeleteVehicleOpen] = useState(false);
  const [deletingVehicle, setDeletingVehicle] = useState(false);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [mobileVehicleTab, setMobileVehicleTab] = useState<MobileVehicleTab>("summary");
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

  const rentalCalendarPendingPickup = useMemo(() => {
    const s = pickStart.trim();
    if (!s || pickEnd.trim()) return undefined;
    try {
      const d = parseISO(s);
      return Number.isNaN(d.getTime()) ? undefined : d;
    } catch {
      return undefined;
    }
  }, [pickStart, pickEnd]);

  useEffect(() => {
    rentalPickRangeRef.current = { start: pickStart, end: pickEnd };
  }, [pickStart, pickEnd]);

  const summaryPickStart = rentalDateSummaryLock?.start ?? pickStart;
  const summaryPickEnd = rentalDateSummaryLock?.end ?? pickEnd;

  const rentalBackdropHeldRange = useMemo<DateRange | undefined>(() => {
    if (!rentalDateSummaryLock) return undefined;
    try {
      return {
        from: parseISO(rentalDateSummaryLock.start),
        to: parseISO(rentalDateSummaryLock.end),
      };
    } catch {
      return undefined;
    }
  }, [rentalDateSummaryLock]);

  const rentalHeldBackdropModifiers = useMemo(() => heldRangeBackdropModifiersFromRange(rentalBackdropHeldRange), [rentalBackdropHeldRange]);

  const applyRentCalendarSelection = useCallback((range: DateRange | undefined) => {
    if (!range?.from) {
      setRentalDateSummaryLock(null);
      setPickStart("");
      setPickEnd("");
      return { coercedSameDayToNextDay: false, selectionComplete: false };
    }
    const prevStart = rentalPickRangeRef.current.start.trim();
    const prevEnd = rentalPickRangeRef.current.end.trim();
    const normalized = normalizeRentalPickupRangeSelection(range);
    if (prevStart && prevEnd && normalized.pickStart && !normalized.pickEnd) {
      setRentalDateSummaryLock({ start: prevStart, end: prevEnd });
      setPickStart(normalized.pickStart);
      setPickEnd("");
      return { coercedSameDayToNextDay: false, selectionComplete: false };
    }
    setRentalDateSummaryLock(null);
    setPickStart(normalized.pickStart);
    setPickEnd(normalized.pickEnd);
    return {
      coercedSameDayToNextDay: normalized.coercedSameDayToNextDay,
      selectionComplete: Boolean(normalized.pickStart.trim() && normalized.pickEnd.trim()),
    };
  }, []);

  useEffect(() => {
    if (pickEnd.trim()) return;
    if (!rentalDateSummaryLock) return;
    const shouldRevert = rentalFormAsPage ? !dateRangeOpen : !dialogOpen || !dateRangeOpen;
    if (!shouldRevert) return;
    setPickStart(rentalDateSummaryLock.start);
    setPickEnd(rentalDateSummaryLock.end);
    setRentalDateSummaryLock(null);
  }, [pickEnd, rentalDateSummaryLock, dateRangeOpen, dialogOpen, rentalFormAsPage]);

  const rentalCommissionSnapshot = useMemo(() => vehicleRentalCommissionSnapshot(vehicle, pickStart, pickEnd), [vehicle, pickStart, pickEnd]);

  const vehicleOptionRowsForRent = useMemo(
    () => (vehicle.optionDefinitions ?? []).filter((d) => d.active !== false),
    [vehicle.optionDefinitions],
  );

  const rentalSummaryDays = useMemo(() => {
    const a = pickStart.trim();
    const b = pickEnd.trim();
    if (!a || !b) return 0;
    try {
      return Math.max(1, differenceInCalendarDays(parseISO(b), parseISO(a)) + 1);
    } catch {
      return 0;
    }
  }, [pickStart, pickEnd]);

  const rentalSummaryBaseAmount = useMemo(() => {
    const daily = vehicle.rentalDailyPrice;
    if (daily == null || !Number.isFinite(daily) || rentalSummaryDays < 1) return undefined;
    return rentalSummaryDays * daily;
  }, [vehicle.rentalDailyPrice, rentalSummaryDays]);

  const rentalSummaryOptionLines = useMemo(() => {
    type SummaryOptLine = { key: string; category: string; title: string; subtitle: string; amount: number };
    const lines: SummaryOptLine[] = [];
    const daysLabel = rentalSummaryDays > 0 ? String(rentalSummaryDays) : "—";
    for (const id of selectedRentExtraIds) {
      const row = reservationExtraTemplates.find((r) => r.id === id);
      if (!row) continue;
      lines.push({
        key: `re-${id}`,
        category: "Kiralama opsiyonu",
        title: row.title,
        subtitle: `${daysLabel} günlük döneme uygulanır · kiralama başına tek tutar`,
        amount: Number(row.price) || 0,
      });
    }
    for (const id of selectedVehicleOptIds) {
      const row = vehicleOptionRowsForRent.find((r) => r.id === id);
      if (!row) continue;
      lines.push({
        key: `vo-${id}`,
        category: "Araç opsiyonu",
        title: row.title,
        subtitle: `${daysLabel} günlük döneme uygulanır · kiralama başına tek tutar`,
        amount: Number(row.price) || 0,
      });
    }
    return lines;
  }, [reservationExtraTemplates, rentalSummaryDays, selectedRentExtraIds, selectedVehicleOptIds, vehicleOptionRowsForRent]);

  const rentalSummaryGross = useMemo(() => {
    const opts = rentalSummaryOptionLines.reduce((s, x) => s + x.amount, 0);
    const base = rentalSummaryBaseAmount;
    let sub: number | undefined;
    if (base != null) sub = base + opts;
    else if (opts > 0) sub = opts;
    else sub = undefined;
    const greenTry = rentalOutsideCountryTravel ? greenInsuranceFeeDisplayTry() : 0;
    if (greenTry <= 0) return sub;
    return (sub ?? 0) + greenTry;
  }, [rentalOutsideCountryTravel, rentalSummaryBaseAmount, rentalSummaryOptionLines]);

  const rentalSummaryGreenInsuranceTry = rentalOutsideCountryTravel ? greenInsuranceFeeDisplayTry() : 0;

  const rentalSummaryCommissionSigned = useMemo(() => {
    const c = rentalCommissionSnapshot;
    if (c.amount <= 0 || !Number.isFinite(c.amount)) return 0;
    return c.flow === "pay" ? -c.amount : c.amount;
  }, [rentalCommissionSnapshot]);

  const rentalSummaryNet = useMemo(() => {
    if (rentalSummaryGross === undefined) return undefined;
    return rentalSummaryGross + rentalSummaryCommissionSigned;
  }, [rentalSummaryCommissionSigned, rentalSummaryGross]);

  const toggleRentExtra = useCallback((id: string) => {
    setSelectedRentExtraIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const toggleVehicleOptDef = useCallback((id: string) => {
    setSelectedVehicleOptIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

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
        : "border-primary/35 bg-primary/12 text-primary";
  const dailyPriceLabel =
    vehicle.rentalDailyPrice != null ? `${vehicle.rentalDailyPrice.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ₺` : "—";
  const defaultPickupLoc = vehicle.defaultPickupHandoverLocation ?? null;
  const defaultPickupNameShown = defaultPickupLoc?.name?.trim() ?? "";
  const visualSeed = useMemo(() => {
    let n = 0;
    for (let i = 0; i < vehicle.id.length; i += 1) n = (n * 31 + vehicle.id.charCodeAt(i)) | 0;
    return Math.abs(n);
  }, [vehicle.id]);
  const batteryPct = 45 + (visualSeed % 50);
  const batteryMiles = Math.round(batteryPct * 3.8);
  const heroImage =
    galleryImages.front ??
    galleryImages.left ??
    galleryImages.right ??
    galleryImages.rear ??
    galleryImages.interiorDash ??
    galleryImages.interiorRear;

  const initNewRentalFormForDay = useCallback(
    (day: Date) => {
      const d = formatDay(day);
      setPickStart(d);
      setPickEnd("");
      setRentalDateSummaryLock(null);
      setDateRangeOpen(false);
      setPassportImageDataUrl("");
      setDriverLicenseImageDataUrl("");
      setPhoneCountryCode("+90");
      setPhoneLocal("");
      setDriverLicenseNo("");
      setAdditionalDrivers([]);
      setSaveNewCustomerProfile(false);
      setCustomerEmail("");
      setNewCustomerBirthDate("");
      setNewCustomerKind("individual");
      setRentalStep(1);
      setMaxRentalStepReached(1);
      setSelectedRentExtraIds([]);
      setSelectedVehicleOptIds([]);
      setRentalOutsideCountryTravel(false);
      setRentalInternalNote("");
    },
    [],
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
    setCustomerEmail((c.email ?? "").trim());
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
        customerBirthDate: newCustomerBirthDate,
        phoneLocal,
        customerEmail,
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
      customerEmail,
      newCustomerBirthDate,
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
    const email = customerEmail.trim();
    if (!fullName.trim() || !phoneLocal.trim()) {
      toast.error("İsim ve telefon zorunludur.");
      return;
    }
    if (!email) {
      toast.error("E-posta zorunludur.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Geçerli bir e-posta adresi girin.");
      return;
    }
    const birthTrim = newCustomerBirthDate.trim();
    if (!birthTrim) {
      toast.error("Doğum tarihi zorunludur.");
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
    if (end <= start) {
      toast.error("Dönüş tarihi çıkıştan sonra bir gün veya daha geç olmalıdır.");
      return;
    }
    if (start < formatDay(new Date())) {
      toast.error("Kiralama başlangıç tarihi bugünden önce olamaz.");
      return;
    }
    const comm = rentalCommissionSnapshot;
    if (comm.flow === "pay" && comm.amount > 0 && !comm.company) {
      toast.error("Komisyon için araç kaydında harici firma adı eksik; araç düzenleyerek firma girin.");
      return;
    }
    for (const d of additionalDrivers) {
      if (!d.fullName.trim() || !d.driverLicenseImageDataUrl) {
        toast.error("Ek sürücü için isim soyisim ve ehliyet fotoğrafı zorunludur.");
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
          email,
          birthDate: birthTrim,
          driverLicenseNo: driverLicenseNo.trim() || undefined,
          driverLicenseImageDataUrl,
          passportImageDataUrl,
        },
        outsideCountryTravel: rentalOutsideCountryTravel,
        ...(rentalInternalNote.trim() ? { note: rentalInternalNote.trim() } : {}),
        additionalDrivers:
          additionalDrivers.length > 0
            ? additionalDrivers.map((d) => ({
                fullName: d.fullName.trim(),
                driverLicenseImageDataUrl: d.driverLicenseImageDataUrl,
              }))
            : undefined,
        status: "active",
        ...(selectedRentExtraIds.length > 0 ? { reservationExtraOptionTemplateIds: selectedRentExtraIds } : {}),
        ...(selectedVehicleOptIds.length > 0 ? { vehicleOptionDefinitionIds: selectedVehicleOptIds } : {}),
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
      setAdditionalDrivers([]);
      setSaveNewCustomerProfile(false);
      setCustomerEmail("");
      setNewCustomerBirthDate("");
      setNewCustomerKind("individual");
      setRentalStep(1);
      setMaxRentalStepReached(1);
      setSelectedRentExtraIds([]);
      setSelectedVehicleOptIds([]);
      setRentalOutsideCountryTravel(false);
      setRentalInternalNote("");
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

  const rentalDateSelectionBlock = rentalFormAsPage ? (
    <div className="space-y-3">
      <button
        type="button"
        className="group relative grid w-full gap-3 rounded-lg border border-border/70 bg-muted/30 p-3 text-left transition-colors hover:border-primary/35 hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:grid-cols-2"
        aria-expanded={dateRangeOpen}
        aria-label={dateRangeOpen ? "Takvimi kapat" : "Takvimi aç, tarih seç"}
        onClick={() => setDateRangeOpen((v) => !v)}
      >
        <CalendarDays
          className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground/60 transition-colors group-hover:text-primary/80 sm:right-4 sm:top-3.5"
          aria-hidden
        />
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Çıkış tarihi</p>
          <p className="mt-1 font-mono text-base font-semibold tabular-nums text-foreground sm:text-lg">
            {summaryPickStart.trim() ? format(parseISO(summaryPickStart), "d MMM yyyy", { locale: tr }) : "—"}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Dönüş tarihi</p>
          <p className="mt-1 font-mono text-base font-semibold tabular-nums text-foreground sm:text-lg">
            {summaryPickEnd.trim() ? format(parseISO(summaryPickEnd), "d MMM yyyy", { locale: tr }) : "—"}
          </p>
        </div>
        {summaryPickStart.trim() && summaryPickEnd.trim() ? (
          <>
            <div className="rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-2.5 text-sm sm:col-span-2">
              <p className="text-muted-foreground">Seçilen süre</p>
              <p className="font-semibold text-primary">
                {(() => {
                  try {
                    const n =
                      differenceInCalendarDays(parseISO(summaryPickEnd), parseISO(summaryPickStart)) + 1;
                    return n > 0 ? `${n} günlük kiralama` : "Bitiş tarihini seçin";
                  } catch {
                    return "—";
                  }
                })()}
              </p>
            </div>
            {rentalDateSummaryLock ? (
              <p className="text-[11px] text-muted-foreground sm:col-span-2">
                Üstteki tarihler seçim tamamlanana dek korunur; takvimde yeni çıkışa ardından dönüş gününe tıklayın.
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground sm:col-span-2">
                Baştan seçmek için takvimde önce çıkış, sonra dönüş gününe tıklayın (çıkış yalnızken gün çerçevelenir).
              </p>
            )}
          </>
        ) : (
          <p className="pr-8 text-xs text-muted-foreground sm:col-span-2">
            Bu alandan takvimi açıp çıkış ardından dönüş gününü seçin. Dolu günlere tıklanamaz.
          </p>
        )}
      </button>
      {dateRangeOpen ? (
        <div className="rounded-lg border border-border/50 bg-card/80">
          <div className="flex justify-center px-2 py-2 sm:py-3">
            <RentAvailabilityCalendar
              mode="range"
              compact
              locale={tr}
              booked={booked}
              selected={selectedDateRange}
              pendingPickupAnchor={rentalCalendarPendingPickup}
              heldRangeBackdrop={rentalBackdropHeldRange}
              disabled={{ before: startOfDay(new Date()) }}
              defaultMonth={
                selectedDateRange?.from
                  ? selectedDateRange.from
                  : pickStart
                    ? parseISO(pickStart)
                    : new Date()
              }
              numberOfMonths={1}
              onSelect={(range) => {
                const { coercedSameDayToNextDay, selectionComplete } = applyRentCalendarSelection(range);
                if (coercedSameDayToNextDay) {
                  toast.message("Dönüş en az bir gün sonra olmalı", {
                    description: "Çıkış ve dönüş aynı gün seçilemez; dönüş bir sonraki güne ayarlandı.",
                  });
                }
                const rawComplete = Boolean(range?.from && range?.to);
                if (selectionComplete || rawComplete) setDateRangeOpen(false);
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border/50 px-3 py-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-2 font-medium">
              <span className="h-2.5 w-2.5 shrink-0 rounded-md bg-primary" aria-hidden /> Seçilen günler
            </span>
            <span className="inline-flex items-center gap-2 font-medium">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-md border border-destructive/50 bg-[hsl(var(--destructive)/0.14)]"
                aria-hidden />{" "}
              Dolu veya seçilemez
            </span>
          </div>
          <div className="flex justify-end border-t border-border/50 px-2 py-2">
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setDateRangeOpen(false)}>
              Kapat
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  ) : (
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
        {summaryPickStart.trim() && summaryPickEnd.trim()
          ? `${summaryPickStart} - ${summaryPickEnd}`
          : "Başlangıç ve bitiş seçin"}
      </Button>
      {dateRangeOpen && (
        <div className="rounded-md border border-border/70 bg-background p-1.5">
          <DayPicker
            mode="range"
            locale={tr}
            className={cn("rent-calendar-skin")}
            resetOnSelect
            modifiers={{
              ...rentalHeldBackdropModifiers.modifiers,
              ...(rentalCalendarPendingPickup
                ? {
                    rent_pickup_pending: (day: Date) => isSameDay(day, rentalCalendarPendingPickup),
                  }
                : {}),
            }}
            modifiersClassNames={{
              ...rentalHeldBackdropModifiers.modifiersClassNames,
              ...(rentalCalendarPendingPickup ? { rent_pickup_pending: "rent-cal-pickup-pending" } : {}),
            }}
            selected={selectedDateRange}
            onSelect={(range) => {
              const { coercedSameDayToNextDay } = applyRentCalendarSelection(range);
              if (coercedSameDayToNextDay) {
                toast.message("Dönüş en az bir gün sonra olmalı", {
                  description: "Çıkış ve dönüş aynı gün seçilemez; dönüş bir sonraki güne ayarlandı.",
                });
              }
            }}
            numberOfMonths={1}
            classNames={{
              months: "text-[11px]",
              caption_label: "text-xs font-medium",
              weekday: "text-[11px] font-semibold text-foreground/90",
              day: "h-7 w-7 p-0",
              day_button:
                "h-7 w-7 rounded-md text-[11px] transition-colors hover:bg-muted aria-selected:bg-primary aria-selected:text-primary-foreground aria-selected:font-semibold",
              selected: "bg-primary text-primary-foreground hover:bg-primary",
              range_start: "rounded-md bg-primary text-primary-foreground",
              range_end: "rounded-md bg-primary text-primary-foreground",
              range_middle: "rounded-md bg-primary/20 text-foreground dark:bg-primary/25",
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
  );

  const rentalFormCompactStepIndicators = (
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
                done && !active && "border-primary/40 bg-primary/10 text-foreground dark:text-muted-foreground",
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
  );

  const rentalFormProgressStepIndicators = (
    <div className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/88 dark:border-border/50">
      <div className="mx-auto w-full max-w-[120rem] px-3 py-2 lg:px-8 lg:py-2.5">
        <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground lg:mb-2.5">
          Yeni kiralama
        </p>
        <div className="flex w-full min-w-0 items-start justify-center px-0.5">
          {RENTAL_STEP_META.map(({ step, label }, idx) => {
            const active = rentalStep === step;
            const done = step < rentalStep;
            const reachable = step <= maxRentalStepReached;
            return (
              <Fragment key={`rental-prog-${step}`}>
                <div className="flex min-w-0 flex-1 basis-0 flex-col items-center px-[2px] sm:px-1">
                  <button
                    type="button"
                    disabled={!reachable}
                    aria-current={active ? "step" : undefined}
                    title={label}
                    onClick={() => reachable && setRentalStep(step)}
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold tabular-nums shadow-sm transition-all duration-300",
                      active &&
                        "scale-[1.06] border-primary bg-primary text-primary-foreground ring-[3px] ring-primary/20",
                      done &&
                        !active &&
                        "border-primary bg-primary text-primary-foreground dark:border-primary dark:bg-primary/90 dark:text-primary-foreground",
                      !active && !done && reachable && "border-border bg-background text-muted-foreground hover:bg-muted",
                      !reachable && "cursor-not-allowed border-border/60 bg-muted/40 text-muted-foreground opacity-45",
                    )}
                  >
                    {step}
                  </button>
                  <span
                    className={cn(
                      "mt-2 w-full max-w-[min(100%,6.5rem)] break-words px-px text-center text-[10px] font-semibold leading-snug tracking-tight sm:max-w-[7.75rem] sm:text-[11px]",
                      rentalStep === step ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {label}
                  </span>
                </div>
                {idx < RENTAL_STEP_META.length - 1 ? (
                  <div className="relative mr-0.5 mt-[14px] h-6 min-h-0 min-w-[10px] flex-1 basis-10 px-px sm:basis-14">
                    <div className="absolute left-0 right-0 top-1 h-2 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                        style={{ width: rentalStep > step ? "100%" : "0%" }}
                      />
                    </div>
                  </div>
                ) : null}
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );

  const rentalFormStepPanels = (
    <>
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
                    ? "border-primary/50 bg-primary/10 dark:border-primary/40 dark:bg-primary/15"
                    : "border-border/80 bg-muted/15 hover:border-border hover:bg-muted/30",
                )}
              >
                <UserPlus className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="text-[11px] font-semibold leading-tight text-foreground">Yeni Müşteri Kaydet</span>
              </button>
            </div>
          </div>
          {saveNewCustomerProfile && (
            <div className="space-y-2 rounded-lg border border-primary/25 bg-primary/[0.04] p-2.5 dark:border-primary/30 dark:bg-primary/10">
              <div className="space-y-1.5">
                <Label className="text-xs">Müşteri türü</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCustomerKind("individual")}
                    className={cn(
                      "flex min-h-[3rem] items-center justify-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      newCustomerKind === "individual"
                        ? "border-primary/50 bg-primary/15 dark:border-primary/40"
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
                        ? "border-primary/50 bg-primary/15 dark:border-primary/40"
                        : "border-border/70 bg-background/80 hover:bg-muted/40",
                    )}
                  >
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    Kurumsal
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="rental-cust-birth">Doğum tarihi *</Label>
            <Input
              id="rental-cust-birth"
              type="date"
              value={newCustomerBirthDate}
              onChange={(e) => setNewCustomerBirthDate(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rental-cust-email">E-posta *</Label>
            <Input
              id="rental-cust-email"
              type="email"
              autoComplete="email"
              required
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="ornek@email.com"
            />
          </div>
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
              previewDataUrl={passportImageDataUrl || undefined}
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
              previewDataUrl={driverLicenseImageDataUrl || undefined}
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
          <p className="text-xs font-semibold tracking-tight text-foreground">Opsiyonlar</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Kiralamaya bağlı kalemler ve araç opsiyonları. İsterseniz ek sürücü ekleyebilirsiniz; yalnızca isim soyisim ve ehliyet
            fotoğrafı yeterlidir.
          </p>
          <RentalFormOptionsLists
            reservationExtras={reservationExtraTemplates}
            reservationExtrasLoading={reservationExtrasPending}
            vehicleOptionDefs={vehicleOptionRowsForRent}
            selectedReservationExtraIds={selectedRentExtraIds}
            onToggleReservationExtra={toggleRentExtra}
            selectedVehicleOptionDefIds={selectedVehicleOptIds}
            onToggleVehicleOptionDef={toggleVehicleOptDef}
            onOpenAddRentalOption={() => setQuickRentExtraOpen(true)}
            onOpenAddVehicleOption={() => setVehicleOptsDialogOpen(true)}
            vehicleOptionsApplyHref={`/vehicles/${vehicle.id}/options`}
          />
          <div className="mt-4 space-y-3 rounded-lg border border-border/70 bg-card/35 p-3 sm:p-4">
            <p className="text-sm font-semibold text-foreground">Talep formuyla aynı alanlar</p>
            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-input"
                checked={rentalOutsideCountryTravel}
                onChange={(e) => setRentalOutsideCountryTravel(e.target.checked)}
              />
              <span className="min-w-0">
                <span className="font-medium text-foreground">Yurt dışı çıkış</span>
                {greenInsuranceFeeDisplayTry() > 0 ? (
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                    Yeşil sigorta için yaklaşık {formatTryAmount(greenInsuranceFeeDisplayTry())} ₺; kesin tutar rent-service ile
                    netleşir.
                  </span>
                ) : (
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                    İşaretliyse sistem yeşil sigorta kalemini uygular.
                  </span>
                )}
              </span>
            </label>
            <div className="space-y-1">
              <Label htmlFor="rental-internal-note">Not</Label>
              <textarea
                id="rental-internal-note"
                value={rentalInternalNote}
                onChange={(e) => setRentalInternalNote(e.target.value)}
                rows={3}
                className={cn(
                  "min-h-[4.5rem] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm",
                  "ring-offset-background placeholder:text-muted-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                )}
                placeholder="İsteğe bağlı · operasyon veya müşteri notu"
              />
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-lg border border-border/70 bg-card/35">
            <div className="flex items-start justify-between gap-2 border-b border-border/60 bg-muted/20 px-3 py-2.5 sm:px-4">
              <div>
                <p className="text-sm font-semibold leading-snug">Ek sürücü</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">İsteğe bağlı · en fazla 1 kişi</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 text-xs"
                disabled={additionalDrivers.length >= 1}
                onClick={() => setAdditionalDrivers((prev) => [...prev, blankAdditionalDriver()])}
              >
                {additionalDrivers.length >= 1 ? "Limit doldu" : "Ek sürücü ekle"}
              </Button>
            </div>
            <div className="p-3 sm:p-4">
              {additionalDrivers.length === 0 ? (
                <p className="text-xs text-muted-foreground">Ek sürücü yok.</p>
              ) : (
                <div className="space-y-3">
                  {additionalDrivers.map((d, idx) => (
                    <div key={`extra-driver-${idx}`} className="rounded-md border border-border/60 bg-background/50 p-3">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <p className="text-xs font-medium">Ek sürücü</p>
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
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label>İsim soyisim</Label>
                          <Input value={d.fullName} onChange={(e) => updateAdditionalDriver(idx, "fullName", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label>Ehliyet fotoğrafı</Label>
                          <ImageSourceInput
                            previewDataUrl={d.driverLicenseImageDataUrl || undefined}
                            onPick={async (f) => {
                              try {
                                updateAdditionalDriver(idx, "driverLicenseImageDataUrl", await fileToDataUrl(f));
                              } catch {
                                toast.error("Ehliyet görseli okunamadı.");
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
        </>
      )}

      {rentalStep === 5 && (
        <div className="space-y-4 text-xs">
          <div className="space-y-3 rounded-lg border border-border/70 bg-card/40 p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Genel bilgiler</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-md border border-border/50 bg-background/60 p-3">
                <p className="text-[10px] text-muted-foreground">Araç</p>
                <p className="mt-0.5 font-medium text-foreground">
                  {vehicle.plate} · {vehicle.brand} {vehicle.model}
                </p>
              </div>
              <div className="rounded-md border border-border/50 bg-background/60 p-3">
                <p className="text-[10px] text-muted-foreground">Kiralama dönemi</p>
                <p className="mt-0.5 font-medium text-foreground">
                  {pickStart || "—"} → {pickEnd || "—"}
                </p>
                {rentalSummaryDays > 0 ? (
                  <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">Toplam {rentalSummaryDays} gün</p>
                ) : null}
              </div>
              <div className="rounded-md border border-border/50 bg-background/60 p-3 sm:col-span-2">
                <p className="text-[10px] text-muted-foreground">Müşteri</p>
                <p className="mt-0.5 font-medium text-foreground">{fullName || "—"}</p>
                <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                  {phoneCountryCode} {phoneLocal || "—"}
                </p>
              </div>
              <div className="rounded-md border border-border/50 bg-background/60 p-3 sm:col-span-2">
                <p className="text-[10px] text-muted-foreground">Doğum tarihi</p>
                <p className="mt-0.5 font-medium tabular-nums text-foreground">{newCustomerBirthDate || "—"}</p>
              </div>
              <div className="rounded-md border border-border/50 bg-background/60 p-3 sm:col-span-2">
                <p className="text-[10px] text-muted-foreground">Yurt dışı çıkış</p>
                <p className="mt-0.5 font-medium text-foreground">{rentalOutsideCountryTravel ? "Evet" : "Hayır"}</p>
              </div>
              {rentalInternalNote.trim() ? (
                <div className="rounded-md border border-border/50 bg-background/60 p-3 sm:col-span-2">
                  <p className="text-[10px] text-muted-foreground">Not</p>
                  <p className="mt-0.5 whitespace-pre-wrap font-medium leading-snug text-foreground">{rentalInternalNote.trim()}</p>
                </div>
              ) : null}
              <div className="rounded-md border border-border/50 bg-background/60 p-3 sm:col-span-2">
                <p className="text-[10px] text-muted-foreground">Ek sürücü</p>
                {additionalDrivers.length === 0 ? (
                  <p className="mt-0.5 text-muted-foreground">Yok</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {additionalDrivers.map((d, i) => (
                      <li key={`sum-ad-${i}`} className="font-medium text-foreground">
                        {d.fullName.trim() || "—"}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-card/40 p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Kalem detayı</p>
            <div className="mt-3 divide-y divide-border/50">
              {rentalSummaryBaseAmount != null && vehicle.rentalDailyPrice != null ? (
                <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">Temel kiralama</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {rentalSummaryDays} gün × {formatTryAmount(vehicle.rentalDailyPrice)} ₺ / gün
                    </p>
                  </div>
                  <p className="shrink-0 text-right tabular-nums font-semibold text-foreground sm:pt-0.5">
                    {formatTryAmount(rentalSummaryBaseAmount)} ₺
                  </p>
                </div>
              ) : (
                <div className="py-3">
                  <p className="font-medium text-foreground">Temel kiralama</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Bu araçta günlük kira fiyatı tanımlı değil; tutar satırı gösterilmiyor.
                  </p>
                </div>
              )}

              {rentalSummaryOptionLines.length === 0 ? (
                <div className="py-3 text-[11px] text-muted-foreground">Seçili opsiyon yok.</div>
              ) : (
                rentalSummaryOptionLines.map((line) => (
                  <div
                    key={line.key}
                    className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{line.category}</p>
                      <p className="mt-0.5 font-medium text-foreground">{line.title}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{line.subtitle}</p>
                    </div>
                    <p className="shrink-0 text-right tabular-nums font-semibold text-foreground sm:pt-1">
                      {formatTryAmount(line.amount)} ₺
                    </p>
                  </div>
                ))
              )}
              {rentalOutsideCountryTravel ? (
                <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">Yeşil sigorta</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Yurt dışı çıkış · tek sefer (tahmini)</p>
                  </div>
                  <p className="shrink-0 text-right tabular-nums font-semibold text-foreground sm:pt-1">
                    {rentalSummaryGreenInsuranceTry > 0 ? `${formatTryAmount(rentalSummaryGreenInsuranceTry)} ₺` : "—"}
                  </p>
                </div>
              ) : null}
            </div>
            {rentalSummaryGross != null ? (
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
                <span className="font-semibold text-foreground">Ara toplam</span>
                <span className="text-base font-bold tabular-nums text-foreground">{formatTryAmount(rentalSummaryGross)} ₺</span>
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/25 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Komisyon (tahmini)</p>
            <p className="mt-2 text-sm text-foreground">{formatVehicleCommissionSummary(rentalCommissionSnapshot)}</p>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-primary/25 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Net toplam (tahmini)</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Ara toplam ve komisyon birlikte; kesin tutar kayıt ve onay sonrası netleşir.
              </p>
            </div>
            <p className="text-right text-lg font-bold tabular-nums text-foreground sm:text-xl">
              {rentalSummaryNet != null ? `${formatTryAmount(rentalSummaryNet)} ₺` : "—"}
            </p>
          </div>
        </div>
      )}
    </>
  );

  const rentalFormGrid = (
    <div className="grid gap-3 py-1">
      {rentalFormCompactStepIndicators}
      {rentalStep === 1 && rentalDateSelectionBlock}
      {rentalFormStepPanels}
    </div>
  );

  const rentalFormPageFooterButtons = (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 w-full text-xs sm:w-auto"
        onClick={handleRentalSecondaryAction}
      >
        {rentalStep > 1 ? "Geri" : "İptal"}
      </Button>
      <Button type="button" size="sm" variant="hero" className="h-9 w-full text-xs sm:w-auto" onClick={handleRentalPrimaryAction}>
        {rentalStep < 5 ? "İleri" : "Kaydet"}
      </Button>
    </>
  );

  if (rentalFormAsPage) {
    return (
      <>
        <div className="-mx-3 -mt-3 lg:-mx-8 lg:-mt-8">
          {rentalFormProgressStepIndicators}
        </div>
        <div
          className={cn(
            "mx-auto w-full max-w-4xl space-y-4 px-3 pt-3 sm:px-4 lg:max-w-5xl lg:space-y-5 lg:pt-4",
            rentalStep === 1 ? "pb-[max(5rem,calc(2rem+env(safe-area-inset-bottom)))] lg:pb-12" : "pb-[max(7rem,calc(5.75rem+env(safe-area-inset-bottom)))] lg:pb-24",
          )}
        >
        {rentalStep === 1 ? (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm glow-card">
          <button
            type="button"
            aria-expanded={rentalVehiclePanelOpen}
            onClick={() => setRentalVehiclePanelOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/30"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                <CarFront className="h-5 w-5 text-primary" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Kiralanacak araç</p>
                <p className="truncate font-mono text-base font-semibold text-foreground">{vehicle.plate}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[vehicle.brand, vehicle.model].filter((s) => s.trim()).join(" ").trim() || "—"}
                </p>
              </div>
            </div>
            <ChevronDown
              className={cn(
                "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200",
                rentalVehiclePanelOpen ? "rotate-180" : "rotate-0",
              )}
              aria-hidden
            />
          </button>
          {rentalVehiclePanelOpen ? (
            <div className="space-y-3 border-t border-border/60 px-4 pb-4 pt-4 sm:flex sm:items-start sm:gap-4">
              <div className="relative mx-auto aspect-[4/3] w-full max-w-[220px] shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted sm:mx-0">
                {heroImage ? (
                  <img src={heroImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center px-2 text-center text-[11px] text-muted-foreground">
                    Görsel yok
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase", statusClass)}>
                    {statusLabel}
                  </span>
                  <span className="tabular-nums text-xs text-muted-foreground">Model yılı {vehicle.year}</span>
                </div>
                <p>
                  <span className="text-muted-foreground">Günlük kiralama: </span>
                  <span className="font-semibold text-foreground">{dailyPriceLabel}</span>
                </p>
                <p className="flex items-start gap-2 text-xs leading-snug text-muted-foreground">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                  <span>
                    <span className="font-medium text-foreground">Teslim alma </span>
                    {defaultPickupLoc == null ? (
                      <span className="italic opacity-90">Kayıtta teslim alma noktası yok</span>
                    ) : defaultPickupNameShown ? (
                      <span>{defaultPickupNameShown}</span>
                    ) : (
                      <span className="italic opacity-90">Konum seçili — ad bekleniyor</span>
                    )}
                  </span>
                </p>
                {vehicle.external ? (
                  <p className="text-xs text-muted-foreground">
                    Harici araç · {vehicle.externalCompany ? vehicle.externalCompany : "Firma adı kayıtta yok"}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
        ) : null}

        {rentalStep === 1 ? (
          <Card className="glow-card overflow-hidden shadow-sm">
            <CardHeader className="space-y-1 pb-2 pt-4">
              <CardTitle className="text-base">Tarih seçimi</CardTitle>
              <CardDescription className="text-xs">
                Çıkış ve dönüş tarihlerini takvimden seçin. Dönüş, çıkışla aynı gün seçilemez; en az bir sonraki gün seçilir.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 sm:px-6">{rentalDateSelectionBlock}</CardContent>
          </Card>
        ) : null}

        {rentalStep === 1 ? (
          <div role="presentation" className="relative rounded-xl border border-border/70 bg-card py-3 shadow-sm glow-card dark:border-border/50">
            <div className="flex flex-col-reverse gap-2 px-4 sm:flex-row sm:justify-end sm:gap-3 sm:px-6">{rentalFormPageFooterButtons}</div>
          </div>
        ) : null}

        {rentalStep !== 1 ? <div className="flex w-full flex-col gap-4 sm:gap-5">{rentalFormStepPanels}</div> : null}
        </div>

        {rentalStep !== 1 ? (
          <div
            role="presentation"
            className={cn(
              "fixed inset-x-0 z-[45] border-t border-border/70 bg-background/98 backdrop-blur-md supports-[backdrop-filter]:bg-background/92 dark:border-border/50",
              "bottom-[var(--app-mobile-tab-bar-offset)] shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.12)]",
              "pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-3",
              "lg:bottom-0 lg:left-[280px] lg:shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.08)]",
            )}
          >
            <div className="mx-auto flex w-full max-w-4xl flex-col-reverse gap-2 px-3 sm:flex-row sm:justify-end sm:px-4 lg:max-w-5xl">
              {rentalFormPageFooterButtons}
            </div>
          </div>
        ) : null}
        <QuickAddReservationExtraDialog
          open={quickRentExtraOpen}
          onOpenChange={setQuickRentExtraOpen}
          onCreated={(id) => setSelectedRentExtraIds((prev) => (prev.includes(id) ? prev : [...prev, id]))}
        />
        <VehicleOptionsTemplatesDialog
          vehicle={vehicle}
          open={vehicleOptsDialogOpen}
          onOpenChange={setVehicleOptsDialogOpen}
        />
        <CustomerPickerDialog
          open={customerPickerOpen}
          onOpenChange={setCustomerPickerOpen}
          rows={customerDirectoryRows}
          onPick={applyCustomerFromDirectory}
        />
      </>
    );
  }

  return (
    <div className="bg-background pb-44 lg:pb-10">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-4 lg:max-w-7xl lg:space-y-5 lg:px-0 lg:py-0">
      <section className="space-y-3 lg:hidden">
        <div className="sticky top-0 z-30 -mx-1 bg-[#f7f9fb]/95 px-1 py-1 backdrop-blur">
          <div className="rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <div className="grid grid-cols-3 gap-1 text-[11px]">
              <button
                type="button"
                onClick={() => setMobileVehicleTab("summary")}
                className={cn(
                  "rounded-lg py-2 font-semibold transition-colors",
                  mobileVehicleTab === "summary" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-slate-500",
                )}
              >
                Detaylar
              </button>
              <button
                type="button"
                onClick={() => setMobileVehicleTab("technical")}
                className={cn(
                  "rounded-lg py-2 font-semibold transition-colors",
                  mobileVehicleTab === "technical" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-slate-500",
                )}
              >
                Teknik
              </button>
              <button
                type="button"
                onClick={() => setMobileVehicleTab("history")}
                className={cn(
                  "rounded-lg py-2 font-semibold transition-colors",
                  mobileVehicleTab === "history" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-slate-500",
                )}
              >
                Gecmis
              </button>
            </div>
          </div>
        </div>

        {mobileVehicleTab === "summary" && (
          <>
            <div className="rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              <div className="relative overflow-hidden rounded-lg bg-slate-100">
                <div className="aspect-[4/3] w-full">
                  {heroImage ? (
                    <img src={heroImage} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">Gorsel yok</div>
                  )}
                </div>
                <div className="absolute right-2 top-2">
                  <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide", statusClass)}>
                    {statusLabel}
                  </span>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {[galleryImages.front, galleryImages.left, galleryImages.right].map((image, idx) => (
                  <div key={`mobile-thumb-${idx}`} className="h-14 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                    {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                ))}
                <div className="flex h-14 items-center justify-center rounded-md border border-slate-200 bg-slate-100 text-[10px] font-semibold text-slate-500">
                  +{Math.max(0, Object.values(galleryImages).filter(Boolean).length - 3)} MORE
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] uppercase tracking-[0.18em] text-primary/70">Premium Class</p>
              <h2 className="mt-1 text-2xl font-bold leading-tight text-slate-900">
                {vehicle.brand} {vehicle.model}
              </h2>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{vehicle.year}</span>
                <span className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 font-mono text-[10px] font-semibold text-indigo-700">
                  {vehicle.plate}
                </span>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl bg-indigo-700 p-4 text-white shadow-lg">
              <p className="text-[10px] uppercase tracking-wide text-indigo-100/90">Daily Rental Price</p>
              <div className="mt-1 flex items-end gap-1">
                <span className="text-4xl font-black">{dailyPriceLabel}</span>
                <span className="pb-1 text-xs text-indigo-100">/day</span>
              </div>
              <div className="mt-4 space-y-2 border-t border-white/15 pt-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-indigo-100">Commission Rate</span>
                  <span className="font-semibold text-indigo-100">
                    {vehicle.commissionEnabled && vehicle.commissionRatePercent != null ? `%${vehicle.commissionRatePercent}` : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-indigo-100">Broker Support</span>
                  <span className="font-medium">{vehicle.commissionBrokerPhone || "—"}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">System Status</p>
                <span className={cn("text-[11px] font-bold", vehicle.external ? "text-rose-600" : "text-indigo-100")}>
                  {vehicle.external ? "EXTERNAL" : "INTERNAL"}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
                <span className="text-xs font-medium text-slate-700">Maintenance Mode</span>
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full border transition-colors",
                    vehicle.maintenance ? "border-indigo-700 bg-indigo-700" : "border-slate-300 bg-slate-200",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      vehicle.maintenance ? "translate-x-6" : "translate-x-1",
                    )}
                  />
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">Logistics</h3>
              <div className="mt-3 flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">Main Hub</p>
                  <p className="text-xs font-semibold text-slate-800">{countryMeta?.name ?? "Terminal A, Neo City"}</p>
                </div>
              </div>
              <div className="mt-3 h-28 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCi4CPvT6C4wsIouMLNMeicu8GWN3H0tw9KekzHXspOg4RXTAJ9WhqNWi-ufpA9bwA3WyXrQEXOyE9qJOllYTIAv1aKoTCjBcz1FwPI29Noz0ELj3cW2gXOa2eQpPLDmRwR40rV_e5Q6vYNZ7kaBin7cza5FAQZWgctMiHSft6ODRXn5So83SrSXfP1othQ_WfX7EvSLOEex2StMW3W6MvpVkAdKzm-AXeout283LOFYJoU1H5XI9hKx3w4lNmXzDpOa6lNNdsjtg"
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-600" />
                <h3 className="text-lg font-bold text-slate-900">Highlights</h3>
              </div>
              <ul className="mt-3 space-y-2">
                {(vehicle.highlights?.length ? vehicle.highlights : ["Adaptive Air Suspension", "Panoramic Glass Roof", "Premium Interior"]).map(
                  (item) => (
                    <li key={item} className="flex items-center gap-2 text-xs text-slate-700">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      <span>{item}</span>
                    </li>
                  ),
                )}
              </ul>
            </div>
          </>
        )}

        {mobileVehicleTab === "technical" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">Vehicle Details</h3>
              <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
                EV Performance
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <Zap className="mb-2 h-4 w-4 text-indigo-600" />
                <p className="text-[10px] uppercase tracking-widest text-slate-400">Engine</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{vehicle.engine || `${batteryMiles} km Electric`}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <Fuel className="mb-2 h-4 w-4 text-indigo-600" />
                <p className="text-[10px] uppercase tracking-widest text-slate-400">Fuel Type</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{vehicle.fuelType || "Electric (BEV)"}</p>
              </div>
              <div className="col-span-2 flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
                <div className="rounded-lg bg-indigo-600 p-2 text-white">
                  <Settings2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">Transmission</p>
                  <p className="text-sm font-bold text-indigo-700">{vehicle.transmissionType || "2-Speed Automatic"}</p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <Car className="mb-2 h-4 w-4 text-indigo-600" />
                <p className="text-[10px] uppercase tracking-widest text-slate-400">Body Style</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{vehicle.bodyStyleLabel || "Sedan / Sportback"}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <User className="mb-2 h-4 w-4 text-indigo-600" />
                <p className="text-[10px] uppercase tracking-widest text-slate-400">Seats</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{vehicle.seats ? `${vehicle.seats} Adults` : "4 Adults"}</p>
              </div>
              <div className="col-span-2 flex items-center justify-between rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <BriefcaseBusiness className="h-4 w-4 text-indigo-600" />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-400">Cargo Capacity</p>
                    <p className="text-sm font-semibold text-slate-900">{vehicle.luggage ? `${vehicle.luggage} bags` : "366L + 84L (Frunk)"}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <p className="text-[10px] uppercase tracking-widest text-slate-400">Model Year</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{vehicle.year}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <p className="text-[10px] uppercase tracking-widest text-slate-400">License Plate</p>
                <p className="mt-1 font-mono text-sm font-bold tracking-widest text-slate-900">{vehicle.plate}</p>
              </div>
            </div>
          </div>
        )}

        {mobileVehicleTab === "history" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">Kiralama Gecmisi</h3>
              <p className="mt-1 text-xs text-slate-500">Bu araca ait tum kiralama kayitlari</p>
            </div>
            {rentalLogs.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500 shadow-sm">Bu arac icin gecmis kayit yok.</div>
            ) : (
              rentalLogs.map((row) => (
                <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{row.customer?.fullName || row.customer?.email || "Musteri"}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {row.startDate} - {row.endDate}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        row.status === "completed"
                          ? "bg-primary/12 text-primary"
                          : row.status === "cancelled"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-sky-100 text-sky-700",
                      )}
                    >
                      {row.status === "completed" ? "Tamamlandi" : row.status === "cancelled" ? "Iptal" : "Aktif"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      <div className="hidden gap-2 lg:grid lg:grid-cols-3">
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

      <div className="hidden gap-6 lg:grid lg:grid-cols-3 lg:items-start">
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

      <Card className="hidden rounded-xl border-slate-200 shadow-sm lg:block">
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
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" />Aktif</span>
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
                                    className={cn("h-2 rounded", positive ? "bg-primary" : "bg-rose-500")}
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

      <Card className="hidden rounded-xl border-destructive/35 bg-gradient-to-b from-destructive/[0.06] to-destructive/[0.02] shadow-sm lg:block">
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

        <div className="fixed bottom-16 left-0 z-40 flex w-full items-center justify-around border-t border-slate-200 bg-white/90 px-3 py-2.5 backdrop-blur lg:hidden">
          <Button type="button" variant="outline" className="mr-2 h-10 flex-1 rounded-md border-slate-300 text-[11px] font-semibold" asChild>
            <Link href={`/vehicles/${vehicle.id}/options`}>
              Download PDF Report
            </Link>
          </Button>
          <Button
            type="button"
            className="ml-2 h-10 flex-[1.2] rounded-md bg-indigo-700 text-[11px] font-semibold hover:bg-indigo-800"
            onClick={() => setEditOpen(true)}
          >
            Edit Vehicle Details
          </Button>
        </div>

        <nav className="fixed bottom-0 left-0 z-40 flex w-full items-center justify-around border-t border-slate-200 bg-white/90 px-3 py-2 backdrop-blur lg:hidden">
          <button type="button" className="flex flex-col items-center justify-center rounded-xl bg-blue-50 px-3 py-1 text-blue-600">
            <CarFront className="h-4 w-4" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Fleet</span>
          </button>
          <button type="button" className="flex flex-col items-center justify-center px-3 py-1 text-slate-400">
            <CalendarDays className="h-4 w-4" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Booking</span>
          </button>
          <button type="button" className="flex flex-col items-center justify-center px-3 py-1 text-slate-400">
            <BarChart3 className="h-4 w-4" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Data</span>
          </button>
          <button type="button" className="flex flex-col items-center justify-center px-3 py-1 text-slate-400">
            <User className="h-4 w-4" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Profile</span>
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

      <QuickAddReservationExtraDialog
        open={quickRentExtraOpen}
        onOpenChange={setQuickRentExtraOpen}
        onCreated={(id) => setSelectedRentExtraIds((prev) => (prev.includes(id) ? prev : [...prev, id]))}
      />
      <VehicleOptionsTemplatesDialog
        vehicle={vehicle}
        open={vehicleOptsDialogOpen}
        onOpenChange={setVehicleOptsDialogOpen}
      />

      <CustomerPickerDialog
        open={customerPickerOpen}
        onOpenChange={setCustomerPickerOpen}
        rows={customerDirectoryRows}
        onPick={applyCustomerFromDirectory}
      />
    </div>
  );
}
