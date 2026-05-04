"use client";

import { useQuery } from "@tanstack/react-query";
import { addMonths, differenceInCalendarDays, eachDayOfInterval, format, isSameDay, parseISO, startOfMonth } from "date-fns";
import { tr } from "date-fns/locale";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { CarFront, Search, Send } from "lucide-react";
import { toast } from "@/components/ui/sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageSourceInput } from "@/components/ui/image-source-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RentAvailabilityCalendar } from "@/components/rent-calendar/rent-availability-calendar";
import { RentCalendarLegend } from "@/components/rent-calendar/rent-calendar-legend";
import {
  bookedDatesForVehicle,
  bookedDatesFromRentalRequests,
  mergeBookedDateArrays,
} from "@/lib/fleet-utils";
import { cn } from "@/lib/utils";
import type { Vehicle } from "@/lib/mock-fleet";
import { rentKeys } from "@/lib/rent-query-keys";
import {
  createRentalRequestOnRentApi,
  fetchRentalsFromRentApi,
  fetchRentalRequestsFromRentApi,
  fetchVehiclesFromRentApi,
  getRentApiErrorMessage,
  queryRentalRequestByReferenceOnRentApi,
  type RentalRequestDto,
} from "@/lib/rent-api";
import { mergeVehicleImagesWithDemo, type VehicleImageSlot } from "@/lib/vehicle-images";

import "react-day-picker/style.css";

type FlowRoute = "choose" | "create" | "query";
type CreateStep = 2 | 3 | 4 | 5 | 6;

type DriverForm = {
  fullName: string;
  birthDate: string;
  driverLicenseNo: string;
  passportNo: string;
  driverLicenseImageDataUrl: string;
  passportImageDataUrl: string;
};

const VEHICLE_NONE = "__none__";
const CARD_COVER_ORDER: VehicleImageSlot[] = ["front", "left", "right", "rear", "interiorDash", "interiorRear"];

const GREEN_INSURANCE_DISPLAY = (() => {
  const n = Number(process.env.NEXT_PUBLIC_GREEN_INSURANCE_FEE);
  return Number.isFinite(n) && n >= 0 ? n : 75;
})();

const CREATE_STEP_META: { step: CreateStep; short: string; full: string }[] = [
  { step: 2, short: "Araç", full: "Araç ve tarihler" },
  { step: 3, short: "İletişim", full: "İletişim" },
  { step: 4, short: "Belgeler", full: "Ehliyet ve pasaport" },
  { step: 5, short: "Ek sürücü", full: "Ek sürücü" },
  { step: 6, short: "Özet", full: "Özet ve gönder" },
];

function vehicleCardCoverUrl(v: Vehicle): string | undefined {
  const merged = mergeVehicleImagesWithDemo(v.images, v.id);
  for (const key of CARD_COVER_ORDER) {
    const u = merged[key];
    if (typeof u === "string" && u.trim().length > 0) return u;
  }
  return undefined;
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

function blankDriver(): DriverForm {
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

function statusBadge(status: RentalRequestDto["status"]) {
  if (status === "approved") return <Badge variant="success">Onaylandı</Badge>;
  if (status === "rejected") return <Badge variant="destructive">Reddedildi</Badge>;
  return <Badge variant="warning">Beklemede</Badge>;
}

export function TalepClient() {
  const searchParams = useSearchParams();
  const [route, setRoute] = useState<FlowRoute>("choose");
  const [createStep, setCreateStep] = useState<CreateStep>(2);
  const [maxCreateStepReached, setMaxCreateStepReached] = useState<CreateStep>(2);

  const [vehicleSearch, setVehicleSearch] = useState("");

  const [vehicleId, setVehicleId] = useState(VEHICLE_NONE);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [passportNo, setPassportNo] = useState("");
  const [driverLicenseNo, setDriverLicenseNo] = useState("");
  const [passportImageDataUrl, setPassportImageDataUrl] = useState("");
  const [driverLicenseImageDataUrl, setDriverLicenseImageDataUrl] = useState("");
  const [outsideCountryTravel, setOutsideCountryTravel] = useState(false);
  const [note, setNote] = useState("");
  const [additionalDrivers, setAdditionalDrivers] = useState<DriverForm[]>([]);
  const [wantsAdditionalDriver, setWantsAdditionalDriver] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdRequest, setCreatedRequest] = useState<RentalRequestDto | null>(null);

  const [referenceInput, setReferenceInput] = useState("");
  const [querying, setQuerying] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [queryResult, setQueryResult] = useState<RentalRequestDto | null>(null);
  const [prefilledFromQuery, setPrefilledFromQuery] = useState(false);

  const { data: vehicles = [] } = useQuery({
    queryKey: rentKeys.vehicles(),
    queryFn: fetchVehiclesFromRentApi,
  });

  const vehiclesFiltered = useMemo(
    () => vehicles.filter((v) => vehicleMatchesSearch(v, vehicleSearch)),
    [vehicles, vehicleSearch],
  );

  const selectedVehicle = useMemo(() => {
    const targetId = queryResult?.vehicleId ?? (vehicleId !== VEHICLE_NONE ? vehicleId : undefined);
    return targetId ? vehicles.find((v) => v.id === targetId) : undefined;
  }, [vehicles, vehicleId, queryResult?.vehicleId]);

  const { data: calendarRentals = [] } = useQuery({
    queryKey: [...rentKeys.rentals(), "vehicleCalendar", vehicleId],
    queryFn: () =>
      fetchRentalsFromRentApi({
        vehicleId: vehicleId !== VEHICLE_NONE ? vehicleId : undefined,
        startDate: format(addMonths(new Date(), -6), "yyyy-MM-dd"),
        endDate: format(addMonths(new Date(), 24), "yyyy-MM-dd"),
      }),
    enabled: route === "create" && createStep === 2 && vehicleId !== VEHICLE_NONE,
  });

  const { data: calendarRentalRequests = [] } = useQuery({
    queryKey: [...rentKeys.rentalRequests(), "vehicleCalendar", vehicleId],
    queryFn: () =>
      fetchRentalRequestsFromRentApi({
        vehicleId: vehicleId !== VEHICLE_NONE ? vehicleId : undefined,
      }),
    enabled: route === "create" && createStep === 2 && vehicleId !== VEHICLE_NONE,
  });

  const bookedDates = useMemo(() => {
    if (vehicleId === VEHICLE_NONE) return [];
    const fromRentals = bookedDatesForVehicle(calendarRentals, vehicleId);
    const fromRequests = bookedDatesFromRentalRequests(calendarRentalRequests, vehicleId);
    return mergeBookedDateArrays(fromRentals, fromRequests);
  }, [calendarRentals, calendarRentalRequests, vehicleId]);

  const selectedDateRange = useMemo<DateRange | undefined>(() => {
    if (!startDate) return undefined;
    try {
      const from = parseISO(startDate);
      const to = endDate ? parseISO(endDate) : undefined;
      return { from, to };
    } catch {
      return undefined;
    }
  }, [startDate, endDate]);

  const rentalRequestPickupPendingAnchor = useMemo(() => {
    const s = startDate.trim();
    if (!s || endDate.trim()) return undefined;
    try {
      const d = parseISO(s);
      return Number.isNaN(d.getTime()) ? undefined : d;
    } catch {
      return undefined;
    }
  }, [startDate, endDate]);

  const calendarDefaultMonth = useMemo(() => {
    if (startDate) {
      try {
        return startOfMonth(parseISO(startDate));
      } catch {
        /* fallthrough */
      }
    }
    return startOfMonth(new Date());
  }, [startDate]);

  useEffect(() => {
    if (prefilledFromQuery) return;
    const qVehicleId = searchParams.get("vehicleId");
    if (qVehicleId) setVehicleId(qVehicleId);
    const qFullName = searchParams.get("fullName");
    if (qFullName) setFullName(qFullName);
    const qPhone = searchParams.get("phone");
    if (qPhone) setPhone(qPhone);
    const qEmail = searchParams.get("email");
    if (qEmail) setEmail(qEmail);
    const qBirthDate = searchParams.get("birthDate");
    if (qBirthDate) setBirthDate(qBirthDate);
    const qNationalId = searchParams.get("nationalId");
    if (qNationalId) setNationalId(qNationalId);
    const qPassportNo = searchParams.get("passportNo");
    if (qPassportNo) setPassportNo(qPassportNo);
    const qDriverLicenseNo = searchParams.get("driverLicenseNo");
    if (qDriverLicenseNo) setDriverLicenseNo(qDriverLicenseNo);
    setPrefilledFromQuery(true);
  }, [prefilledFromQuery, searchParams]);

  const updateDriver = useCallback(<K extends keyof DriverForm>(idx: number, key: K, value: DriverForm[K]) => {
    setAdditionalDrivers((prev) => prev.map((d, i) => (i === idx ? { ...d, [key]: value } : d)));
  }, []);

  const goCreate = () => {
    setRoute("create");
    setCreateStep(2);
    setMaxCreateStepReached(2);
    setFormError(null);
  };

  const goQuery = () => {
    setRoute("query");
    setFormError(null);
  };

  const goChoose = () => {
    setRoute("choose");
    setFormError(null);
  };

  const validateStep2 = useCallback((): string | null => {
    if (vehicleId === VEHICLE_NONE) return "Lütfen bir araç seçin.";
    if (!startDate || !endDate) return "Takvimden başlangıç ve bitiş tarihlerini seçin.";
    if (endDate < startDate) return "Bitiş tarihi başlangıçtan önce olamaz.";
    try {
      const from = parseISO(startDate);
      const to = parseISO(endDate);
      for (const d of eachDayOfInterval({ start: from, end: to })) {
        if (bookedDates.some((b) => isSameDay(b, d))) {
          return "Seçilen aralıkta dolu günler var; kırmızı ile işaretli günleri dışarıda bırakın.";
        }
      }
    } catch {
      return "Tarihleri kontrol edin.";
    }
    return null;
  }, [vehicleId, startDate, endDate, bookedDates]);

  const validateStep3 = useCallback((): string | null => {
    if (!fullName.trim()) return "Ad soyad girin.";
    if (!phone.trim()) return "Telefon girin.";
    if (!email.trim() || !email.includes("@")) return "Geçerli e-posta girin.";
    if (!birthDate) return "Doğum tarihi seçin.";
    return null;
  }, [fullName, phone, email, birthDate]);

  const validateStep4 = useCallback((): string | null => {
    if (!passportImageDataUrl || !driverLicenseImageDataUrl) {
      return "Pasaport ve ehliyet fotoğrafları zorunludur.";
    }
    return null;
  }, [passportImageDataUrl, driverLicenseImageDataUrl]);

  const validateStep5 = useCallback((): string | null => {
    if (!wantsAdditionalDriver) return null;
    if (additionalDrivers.length === 0) return "Ek sürücü bilgilerini doldurun veya «Ek sürücü yok» seçin.";
    const d = additionalDrivers[0];
    if (!d) return "Ek sürücü bilgilerini doldurun.";
    if (!d.fullName.trim() || !d.birthDate) return "Ek sürücü adı ve doğum tarihi zorunludur.";
    if (!d.passportImageDataUrl || !d.driverLicenseImageDataUrl) return "Ek sürücü pasaport ve ehliyet fotoğrafları zorunludur.";
    return null;
  }, [wantsAdditionalDriver, additionalDrivers]);

  const tryAdvanceCreate = () => {
    setFormError(null);
    const checks: Record<CreateStep, () => string | null> = {
      2: validateStep2,
      3: validateStep3,
      4: validateStep4,
      5: validateStep5,
      6: () => null,
    };
    const err = checks[createStep]();
    if (err) {
      setFormError(err);
      toast.error(err);
      return;
    }
    if (createStep < 6) {
      const next = (createStep + 1) as CreateStep;
      setCreateStep(next);
      setMaxCreateStepReached((m) => (next > m ? next : m));
    }
  };

  const tryGoBackCreate = () => {
    setFormError(null);
    if (createStep > 2) {
      setCreateStep((s) => (s > 2 ? ((s - 1) as CreateStep) : s));
      return;
    }
    goChoose();
  };

  const jumpToCreateStep = (target: CreateStep) => {
    if (target > maxCreateStepReached) return;
    setFormError(null);
    setCreateStep(target);
  };

  const rentalDays = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) return 0;
    try {
      return differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1;
    } catch {
      return 0;
    }
  }, [startDate, endDate]);

  const estimatedRentalSubtotal = useMemo(() => {
    const p = selectedVehicle?.rentalDailyPrice;
    if (p == null || !Number.isFinite(p) || rentalDays <= 0) return null;
    return p * rentalDays;
  }, [selectedVehicle?.rentalDailyPrice, rentalDays]);

  const greenLine = outsideCountryTravel ? GREEN_INSURANCE_DISPLAY : 0;
  const estimatedGrand =
    estimatedRentalSubtotal != null ? estimatedRentalSubtotal + greenLine : greenLine > 0 ? greenLine : null;

  const submitCreate = async () => {
    setFormError(null);
    const e2 = validateStep2();
    const e3 = validateStep3();
    const e4 = validateStep4();
    const e5 = validateStep5();
    const err = e2 ?? e3 ?? e4 ?? e5;
    if (err) {
      setFormError(err);
      toast.error(err);
      return;
    }

    setSubmitting(true);
    try {
      const created = await createRentalRequestOnRentApi({
        vehicleId: vehicleId !== VEHICLE_NONE ? vehicleId : undefined,
        startDate,
        endDate,
        outsideCountryTravel,
        note: note.trim() || undefined,
        customer: {
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          birthDate,
          nationalId: nationalId.trim() || undefined,
          passportNo: passportNo.trim() || undefined,
          driverLicenseNo: driverLicenseNo.trim() || undefined,
          passportImageDataUrl,
          driverLicenseImageDataUrl,
        },
        additionalDrivers:
          wantsAdditionalDriver && additionalDrivers.length > 0
            ? additionalDrivers.map((d) => ({
                fullName: d.fullName.trim(),
                birthDate: d.birthDate,
                driverLicenseNo: d.driverLicenseNo.trim() || undefined,
                passportNo: d.passportNo.trim() || undefined,
                driverLicenseImageDataUrl: d.driverLicenseImageDataUrl,
                passportImageDataUrl: d.passportImageDataUrl,
              }))
            : undefined,
      });
      setCreatedRequest(created);
      setReferenceInput(created.referenceNo);
      setQueryResult(created);
      setRoute("query");
      toast.success("Talebiniz alındı. Referans numaranızı not edin.");
    } catch (e) {
      setFormError(getRentApiErrorMessage(e));
      toast.error(getRentApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const submitQuery = async () => {
    const ref = referenceInput.trim();
    if (!ref) {
      setQueryError("Referans numarası girin.");
      return;
    }
    setQueryError(null);
    setQuerying(true);
    try {
      const result = await queryRentalRequestByReferenceOnRentApi(ref);
      setQueryResult(result);
    } catch (e) {
      setQueryResult(null);
      setQueryError(getRentApiErrorMessage(e));
    } finally {
      setQuerying(false);
    }
  };

  const renderStepper = () => (
    <div className="overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
      <div className="flex min-w-min gap-1.5 sm:gap-2">
        {CREATE_STEP_META.map(({ step, short }) => {
          const done = step < createStep;
          const active = step === createStep;
          const reachable = step <= maxCreateStepReached;
          return (
            <button
              key={step}
              type="button"
              disabled={!reachable}
              onClick={() => reachable && jumpToCreateStep(step)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors sm:px-3 sm:text-xs",
                active && "border-primary bg-primary text-primary-foreground",
                done && !active && "border-primary/40 bg-primary/10 text-foreground",
                !active && !done && reachable && "border-border bg-muted/40 text-muted-foreground hover:bg-muted",
                !reachable && "cursor-not-allowed border-border/50 opacity-40",
              )}
            >
              <span className="tabular-nums">{step - 1}</span>
              <span className="hidden sm:inline">{CREATE_STEP_META.find((x) => x.step === step)?.full}</span>
              <span className="sm:hidden">{short}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-3 sm:p-4">
      <Card className="glow-card">
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CarFront className="h-4 w-4" />
            Kiralama Talep Formu
          </CardTitle>
          <CardDescription className="text-xs">
            Adımları sırayla tamamlayın; ileri yalnızca zorunlu alanlar doluyken geçilir. Önceki adımlara üstteki adımlardan dönebilirsiniz.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {route === "choose" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Button type="button" className="h-auto min-h-[4.5rem] flex-col gap-1 py-4 text-sm" onClick={goCreate}>
                Talep oluşturma
                <span className="text-[11px] font-normal text-primary-foreground/80">Yeni kiralama talebi gönderin</span>
              </Button>
              <Button type="button" variant="secondary" className="h-auto min-h-[4.5rem] flex-col gap-1 py-4 text-sm" onClick={goQuery}>
                Talep sorgulama
                <span className="text-[11px] font-normal text-secondary-foreground/80">Referans numarası ile durum görüntüleyin</span>
              </Button>
            </div>
          )}

          {route === "query" && (
            <div className="space-y-4">
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={goChoose}>
                ← Talep türü seçimine dön
              </Button>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={referenceInput}
                  onChange={(e) => setReferenceInput(e.target.value)}
                  placeholder="Referans no (örn: RG-20260408-ABC123)"
                  className="h-10"
                />
                <Button className="h-10 shrink-0 gap-2 sm:w-auto" onClick={() => void submitQuery()} disabled={querying}>
                  <Search className="h-4 w-4" />
                  {querying ? "Sorgulanıyor..." : "Sorgula"}
                </Button>
              </div>
              {queryError && <p className="text-xs text-destructive">{queryError}</p>}
              {queryResult && (
                <Card className="border-border/70">
                  <CardHeader className="space-y-1 py-3">
                    <CardTitle className="text-sm">Talep sonucu</CardTitle>
                    <CardDescription className="text-xs">Referans: {queryResult.referenceNo}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">{statusBadge(queryResult.status)}</div>
                    <p>
                      Tarih: {queryResult.startDate} → {queryResult.endDate}
                    </p>
                    <p>Müşteri: {queryResult.customer.fullName}</p>
                    <p>Yurt dışı çıkış: {queryResult.outsideCountryTravel ? "Evet" : "Hayır"}</p>
                    <p>Yeşil sigorta ücreti: {queryResult.greenInsuranceFee}</p>
                    {queryResult.statusMessage && <p>Durum notu: {queryResult.statusMessage}</p>}
                    {selectedVehicle && (
                      <p>
                        Araç: {selectedVehicle.plate} — {selectedVehicle.brand} {selectedVehicle.model}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
              {createdRequest && (
                <p className="text-[11px] text-muted-foreground">
                  Son oluşturulan talep referansı: <span className="font-mono">{createdRequest.referenceNo}</span>
                </p>
              )}
            </div>
          )}

          {route === "create" && (
            <div className="space-y-4">
              {renderStepper()}
              {formError && <p className="text-xs text-destructive">{formError}</p>}

              {createStep === 2 && (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={vehicleSearch}
                      onChange={(e) => setVehicleSearch(e.target.value)}
                      placeholder="Plaka, marka veya model ile ara…"
                      className="h-10 pl-9"
                      aria-label="Araç ara"
                    />
                  </div>
                  <div className="grid max-h-[min(55vh,28rem)] grid-cols-2 gap-2 overflow-y-auto pr-0.5 sm:grid-cols-2 sm:gap-3">
                    {vehiclesFiltered.map((v) => {
                      const disabled = Boolean(v.maintenance);
                      const cover = vehicleCardCoverUrl(v);
                      const selected = vehicleId === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            if (disabled) return;
                            setVehicleId(v.id);
                            setStartDate("");
                            setEndDate("");
                          }}
                          className={cn(
                            "flex w-full flex-col overflow-hidden rounded-xl border bg-card p-0 text-left shadow-sm outline-none transition-[box-shadow,border-color]",
                            disabled && "cursor-not-allowed opacity-50",
                            selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                            !disabled && !selected && "border-border/60 hover:border-primary/40",
                          )}
                        >
                          <div className="relative aspect-[5/3] w-full shrink-0 overflow-hidden bg-muted">
                            {cover ? (
                              <div
                                className="h-full w-full bg-cover bg-center"
                                style={{ backgroundImage: `url(${JSON.stringify(cover)})` }}
                                aria-hidden
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">Görsel yok</div>
                            )}
                          </div>
                          <div className="border-t border-border/60 px-2 py-1.5">
                            <p className="truncate font-mono text-[11px] font-semibold sm:text-xs">{v.plate}</p>
                            <p className="truncate text-[9px] text-muted-foreground sm:text-[10px]">
                              {v.brand} {v.model}
                            </p>
                            {disabled ? <p className="text-[9px] text-destructive">Bakımda</p> : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {vehiclesFiltered.length === 0 && (
                    <p className="py-4 text-center text-xs text-muted-foreground">Aramanıza uyan araç yok.</p>
                  )}

                  {vehicleId !== VEHICLE_NONE && (
                    <div className="space-y-3 rounded-xl border border-border/70 bg-gradient-to-b from-card to-muted/20 shadow-sm">
                      <div className="px-3 pt-3 sm:px-5 sm:pt-4">
                        <p className="text-xs font-semibold text-foreground">Müsaitlik ve tarih seçimi</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Araç detayındaki gibi dolu günler kırmızıdır; bu günlere tıklanamaz. İki uç günü seçerek kiralama aralığınızı
                          belirleyin. Dar ekranda takvim yatay kaydırılabilir.
                        </p>
                        {startDate && endDate ? (
                          <p className="mt-2 text-xs font-medium tabular-nums text-foreground">
                            Seçilen: {startDate} → {endDate}
                          </p>
                        ) : (
                          <p className="mt-2 text-xs text-muted-foreground">Önce başlangıç, sonra bitiş gününe tıklayın.</p>
                        )}
                      </div>
                      <RentAvailabilityCalendar
                        mode="range"
                        locale={tr}
                        booked={bookedDates}
                        selected={selectedDateRange}
                        pendingPickupAnchor={rentalRequestPickupPendingAnchor}
                        defaultMonth={calendarDefaultMonth}
                        onSelect={(range) => {
                          setFormError(null);
                          if (!range?.from) {
                            setStartDate("");
                            setEndDate("");
                            return;
                          }
                          const nextStart = format(range.from, "yyyy-MM-dd");
                          const nextEnd = range.to ? format(range.to, "yyyy-MM-dd") : "";
                          setStartDate(nextStart);
                          setEndDate(nextEnd);
                        }}
                      />
                      <div className="px-3 pb-3 sm:px-5 sm:pb-4">
                        <RentCalendarLegend />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {createStep === 3 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1 sm:col-span-2">
                    <Label>Ad soyad</Label>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-10" />
                  </div>
                  <div className="space-y-1">
                    <Label>Telefon</Label>
                    <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+90 …" className="h-10" />
                  </div>
                  <div className="space-y-1">
                    <Label>E-posta</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label>Doğum tarihi</Label>
                    <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="h-10" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label>Kimlik no (opsiyonel)</Label>
                    <Input value={nationalId} onChange={(e) => setNationalId(e.target.value)} className="h-10" />
                  </div>
                </div>
              )}

              {createStep === 4 && (
                <div className="space-y-4">
                  <p className="text-[11px] text-muted-foreground">
                    Pasaport ve ehliyet numaraları isteğe bağlıdır. Fotoğraflar zorunludur.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Pasaport no (opsiyonel)</Label>
                      <Input value={passportNo} onChange={(e) => setPassportNo(e.target.value)} className="h-10" />
                    </div>
                    <div className="space-y-1">
                      <Label>Ehliyet no (opsiyonel)</Label>
                      <Input value={driverLicenseNo} onChange={(e) => setDriverLicenseNo(e.target.value)} className="h-10" />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label>Pasaport fotoğrafı (zorunlu)</Label>
                      <ImageSourceInput
                        previewDataUrl={passportImageDataUrl || undefined}
                        onPick={async (f) => {
                          try {
                            setPassportImageDataUrl(await fileToDataUrl(f));
                          } catch {
                            setFormError("Pasaport görseli okunamadı.");
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label>Ehliyet fotoğrafı (zorunlu)</Label>
                      <ImageSourceInput
                        previewDataUrl={driverLicenseImageDataUrl || undefined}
                        onPick={async (f) => {
                          try {
                            setDriverLicenseImageDataUrl(await fileToDataUrl(f));
                          } catch {
                            setFormError("Ehliyet görseli okunamadı.");
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {createStep === 5 && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Label className="text-sm">Ek sürücü</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={!wantsAdditionalDriver ? "default" : "outline"}
                        className="h-9"
                        onClick={() => {
                          setWantsAdditionalDriver(false);
                          setAdditionalDrivers([]);
                        }}
                      >
                        Yok
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={wantsAdditionalDriver ? "default" : "outline"}
                        className="h-9"
                        onClick={() => {
                          setWantsAdditionalDriver(true);
                          if (additionalDrivers.length === 0) setAdditionalDrivers([blankDriver()]);
                        }}
                      >
                        Var
                      </Button>
                    </div>
                  </div>
                  {wantsAdditionalDriver && additionalDrivers[0] && (
                    <div className="rounded-lg border border-border/70 p-3 space-y-3">
                      <p className="text-xs font-medium">Ek sürücü bilgileri</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1 sm:col-span-2">
                          <Label>Ad soyad</Label>
                          <Input
                            value={additionalDrivers[0].fullName}
                            onChange={(e) => updateDriver(0, "fullName", e.target.value)}
                            className="h-10"
                          />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label>Doğum tarihi</Label>
                          <Input
                            type="date"
                            value={additionalDrivers[0].birthDate}
                            onChange={(e) => updateDriver(0, "birthDate", e.target.value)}
                            className="h-10"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Ehliyet no (opsiyonel)</Label>
                          <Input
                            value={additionalDrivers[0].driverLicenseNo}
                            onChange={(e) => updateDriver(0, "driverLicenseNo", e.target.value)}
                            className="h-10"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Pasaport no (opsiyonel)</Label>
                          <Input
                            value={additionalDrivers[0].passportNo}
                            onChange={(e) => updateDriver(0, "passportNo", e.target.value)}
                            className="h-10"
                          />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label>Pasaport fotoğrafı (zorunlu)</Label>
                          <ImageSourceInput
                            previewDataUrl={additionalDrivers[0]?.passportImageDataUrl || undefined}
                            onPick={async (f) => {
                              updateDriver(0, "passportImageDataUrl", await fileToDataUrl(f));
                            }}
                          />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label>Ehliyet fotoğrafı (zorunlu)</Label>
                          <ImageSourceInput
                            previewDataUrl={additionalDrivers[0]?.driverLicenseImageDataUrl || undefined}
                            onPick={async (f) => {
                              updateDriver(0, "driverLicenseImageDataUrl", await fileToDataUrl(f));
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {createStep === 6 && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs space-y-2">
                    <p>
                      <span className="font-medium">Araç:</span>{" "}
                      {selectedVehicle ? `${selectedVehicle.plate} — ${selectedVehicle.brand} ${selectedVehicle.model}` : "—"}
                    </p>
                    <p>
                      <span className="font-medium">Tarihler:</span> {startDate} → {endDate} ({rentalDays} gün)
                    </p>
                    <p>
                      <span className="font-medium">Müşteri:</span> {fullName}
                    </p>
                  </div>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 p-3">
                    <input
                      type="checkbox"
                      checked={outsideCountryTravel}
                      onChange={(e) => setOutsideCountryTravel(e.target.checked)}
                      className="mt-1 rounded border-input"
                    />
                    <span className="text-sm">
                      Yurt dışına çıkış olacak
                      <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                        İşaretlerseniz yeşil sigorta ücreti uygulanır (yaklaşık {GREEN_INSURANCE_DISPLAY.toLocaleString("tr-TR")} ₺).
                      </span>
                    </span>
                  </label>
                  <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 text-sm space-y-1">
                    {estimatedRentalSubtotal != null ? (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Tahmini kira ({rentalDays} gün)</span>
                        <span className="font-semibold tabular-nums">
                          {estimatedRentalSubtotal.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ₺
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Günlük fiyat bilinmiyorsa ara toplam gösterilmez.</p>
                    )}
                    {outsideCountryTravel && (
                      <div className="flex justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">Yeşil sigorta (tahmini)</span>
                        <span className="font-medium tabular-nums">
                          {GREEN_INSURANCE_DISPLAY.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ₺
                        </span>
                      </div>
                    )}
                    {estimatedGrand != null && (
                      <div className="flex justify-between gap-2 border-t border-border/50 pt-2 font-semibold">
                        <span>Tahmini toplam</span>
                        <span className="tabular-nums">{estimatedGrand.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ₺</span>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground pt-1">
                      Kesin tutar ve onay ofis tarafından yapılır; buradaki rakamlar bilgilendirme amaçlıdır.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label>Not (opsiyonel)</Label>
                    <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Eklemek istediğiniz bilgi…" className="h-10" />
                  </div>
                  <Button className="h-11 w-full gap-2 text-sm" onClick={() => void submitCreate()} disabled={submitting}>
                    <Send className="h-4 w-4" />
                    {submitting ? "Gönderiliyor..." : "Talebi gönder"}
                  </Button>
                </div>
              )}

              {createStep < 6 && (
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" className="h-10 w-full sm:w-auto" onClick={tryGoBackCreate}>
                    Geri
                  </Button>
                  <Button type="button" className="h-10 w-full sm:w-auto" onClick={tryAdvanceCreate}>
                    İleri
                  </Button>
                </div>
              )}
              {createStep === 6 && (
                <Button type="button" variant="outline" className="h-10 w-full sm:w-auto" onClick={tryGoBackCreate}>
                  Geri
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
