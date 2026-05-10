"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFleetVehicles } from "@/hooks/use-fleet-vehicles";
import { fetchVehicleFormCatalogFromRentApi, getRentApiErrorMessage } from "@/lib/rent-api";
import { rentKeys } from "@/lib/rent-query-keys";
import { compactVehicleImages, type VehicleImages } from "@/lib/vehicle-images";
import {
  resolveStaticBrandModelNames,
  staticVehicleBrandSelectItems,
  staticVehicleModelsForBrandId,
  VEHICLE_BODY_STYLES_STATIC,
  VEHICLE_FUEL_TYPES_STATIC,
  VEHICLE_TRANSMISSION_TYPES_STATIC,
} from "@/constants";
import { HandoverReturnMultiCombobox } from "@/components/vehicles/handover-return-multi-combobox";
import { VehicleImageSlotsEditor } from "@/components/vehicles/vehicle-image-slots-editor";
import { formatEur } from "@/lib/format-money";
import { cn } from "@/lib/utils";

const REQUIRED_VEHICLE_IMAGE_SLOTS: (keyof VehicleImages)[] = [
  "front",
  "rear",
  "left",
  "right",
  "interiorDash",
  "interiorRear",
];

function normalizePlate(p: string) {
  return p.replace(/\s+/g, " ").trim().toUpperCase();
}

const COUNTRY_NONE = "__none__";
const SPECS_FUEL_NONE = "__fuel_none__";
const SPECS_TRANS_NONE = "__trans_none__";
const SPECS_BODY_NONE = "__body_none__";
const BRAND_NONE = "__brand_none__";
const MODEL_NONE = "__model_none__";
type NewVehicleStep = 1 | 2 | 3;

export function VehicleNewClient() {
  const router = useRouter();
  const { allVehicles, addVehicle } = useFleetVehicles();
  const {
    data: catalog,
    isPending: catalogLoading,
    error: catalogError,
    refetch: refetchCatalog,
  } = useQuery({
    queryKey: rentKeys.vehicleFormCatalog(),
    queryFn: fetchVehicleFormCatalogFromRentApi,
  });
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<NewVehicleStep>(1);
  const [plate, setPlate] = useState("");
  const [brandId, setBrandId] = useState(BRAND_NONE);
  const [modelId, setModelId] = useState(MODEL_NONE);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [externalVehicle, setExternalVehicle] = useState(false);
  const [externalCompany, setExternalCompany] = useState("");
  const [commissionRatePercent, setCommissionRatePercent] = useState("");
  const [commissionBrokerPhone, setCommissionBrokerPhone] = useState("");
  const [rentalDailyPrice, setRentalDailyPrice] = useState("");
  const [vehicleCountry, setVehicleCountry] = useState<string>(COUNTRY_NONE);
  const [draftImages, setDraftImages] = useState<VehicleImages>({});
  const [defaultPickupId, setDefaultPickupId] = useState("");
  const [selectedReturnIds, setSelectedReturnIds] = useState<string[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [optionSearch, setOptionSearch] = useState("");
  const [highlightsText, setHighlightsText] = useState("");
  const [fuelType, setFuelType] = useState(SPECS_FUEL_NONE);
  const [transmissionType, setTransmissionType] = useState(SPECS_TRANS_NONE);
  const [bodyStyleCode, setBodyStyleCode] = useState(SPECS_BODY_NONE);
  const [seats, setSeats] = useState("");
  const [luggage, setLuggage] = useState("");
  const pickupLocs = catalog?.pickupHandoverLocations ?? [];
  const returnLocs = catalog?.returnHandoverLocations ?? [];
  const optionTemplates = useMemo(() => catalog?.optionTemplates ?? [], [catalog]);
  const fuelTypeOptions = VEHICLE_FUEL_TYPES_STATIC;
  const transmissionTypeOptions = VEHICLE_TRANSMISSION_TYPES_STATIC;
  const bodyStyleOptions = VEHICLE_BODY_STYLES_STATIC;

  const countriesSorted = useMemo(
    () => [...(catalog?.countries ?? [])].sort((a, b) => a.name.localeCompare(b.name, "tr")),
    [catalog?.countries],
  );

  const staticBrandItems = useMemo(() => staticVehicleBrandSelectItems(), []);

  const staticModelItems = useMemo(() => staticVehicleModelsForBrandId(brandId), [brandId]);

  const fuelSelectItems = useMemo(
    () => fuelTypeOptions.map((o) => ({ value: o.code, label: o.labelTr })),
    [fuelTypeOptions],
  );

  const transmissionSelectItems = useMemo(
    () => transmissionTypeOptions.map((o) => ({ value: o.code, label: o.labelTr })),
    [transmissionTypeOptions],
  );

  const bodyStyleSelectItems = useMemo(
    () => bodyStyleOptions.map((o) => ({ value: o.code, label: o.labelTr })),
    [bodyStyleOptions],
  );

  const formLocked = catalogLoading || !!catalogError || !catalog;

  const filteredOptionTemplates = useMemo(() => {
    const q = optionSearch.trim().toLocaleLowerCase("tr");
    if (!q) return optionTemplates;
    return optionTemplates.filter(
      (t) =>
        t.title.toLocaleLowerCase("tr").includes(q) ||
        (t.description ?? "").toLocaleLowerCase("tr").includes(q),
    );
  }, [optionSearch, optionTemplates]);

  const validateStep = (targetStep: NewVehicleStep): boolean => {
    const p = normalizePlate(plate);
    const resolved = resolveStaticBrandModelNames(brandId, modelId);
    const b = resolved?.brand.trim() ?? "";
    const m = resolved?.model.trim() ?? "";
    const y = parseInt(year, 10);
    if (targetStep >= 1) {
      if (!p || !b || !m || !Number.isFinite(y) || y < 1950 || y > new Date().getFullYear() + 1) {
        toast.error("Plaka, marka, model ve geçerli model yılı gerekli.");
        return false;
      }
      const dup = allVehicles.some((v) => normalizePlate(v.plate) === p);
      if (dup) {
        toast.error("Bu plaka zaten kayıtlı.");
        return false;
      }
    }
    if (targetStep >= 2) {
      if (externalVehicle && !externalCompany.trim()) {
        toast.error("Harici araç için firma adı girin.");
        return false;
      }
      const rate = externalVehicle ? Number.parseFloat(commissionRatePercent.trim().replace(",", ".")) : undefined;
      if (externalVehicle && (!Number.isFinite(rate) || (rate ?? 0) <= 0 || (rate ?? 0) > 100)) {
        toast.error("Komisyon oranı yüzde olarak 0 ile 100 arasında olmalı.");
        return false;
      }
      const rentalPrice = Number.parseFloat(rentalDailyPrice.trim().replace(",", "."));
      if (!Number.isFinite(rentalPrice) || rentalPrice <= 0) {
        toast.error("Günlük kiralama fiyatı zorunlu ve sıfırdan büyük olmalı.");
        return false;
      }
      const seatsParsed = seats.trim() === "" ? undefined : Number.parseInt(seats.trim(), 10);
      if (seats.trim() !== "" && (!Number.isFinite(seatsParsed) || seatsParsed! < 1 || seatsParsed! > 20)) {
        toast.error("Koltuk sayısı 1–20 arası veya boş olmalıdır.");
        return false;
      }
      const luggageParsed = luggage.trim() === "" ? undefined : Number.parseInt(luggage.trim(), 10);
      if (luggage.trim() !== "" && (!Number.isFinite(luggageParsed) || luggageParsed! < 0)) {
        toast.error("Bagaj (valiz) için geçerli bir sayı girin veya boş bırakın.");
        return false;
      }
    }
    if (targetStep >= 3) {
      if (vehicleCountry === COUNTRY_NONE) {
        toast.error("Ülke seçimi zorunludur.");
        return false;
      }
      if (!defaultPickupId.trim()) {
        toast.error("Varsayılan alış noktası seçin.");
        return false;
      }
      const images = compactVehicleImages(draftImages);
      const missingVehicleImages = REQUIRED_VEHICLE_IMAGE_SLOTS.filter((slot) => !images?.[slot]);
      if (missingVehicleImages.length > 0) {
        toast.error("Araç için ön, arka, sol, sağ, kokpit ve arka koltuk fotoğrafları zorunlu.");
        return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (step >= 3) return;
    const next = (step + 1) as NewVehicleStep;
    if (!validateStep(step)) return;
    setStep(next);
  };

  const submitNewVehicle = async () => {
    if (!catalog) {
      toast.error("Form katalogu yüklenemedi.");
      return;
    }
    const p = normalizePlate(plate);
    const resolved = resolveStaticBrandModelNames(brandId, modelId);
    const b = resolved?.brand.trim() ?? "";
    const m = resolved?.model.trim() ?? "";
    const y = parseInt(year, 10);
    if (!p || !b || !m || !Number.isFinite(y) || y < 1950 || y > new Date().getFullYear() + 1) {
      toast.error("Plaka, marka, model ve geçerli model yılı gerekli.");
      return;
    }
    const dup = allVehicles.some((v) => normalizePlate(v.plate) === p);
    if (dup) {
      toast.error("Bu plaka zaten kayıtlı.");
      return;
    }
    if (externalVehicle && !externalCompany.trim()) {
      toast.error("Harici araç için firma adı girin.");
      return;
    }
    const rate = externalVehicle ? Number.parseFloat(commissionRatePercent.trim().replace(",", ".")) : undefined;
    if (externalVehicle) {
      if (!Number.isFinite(rate) || (rate ?? 0) <= 0 || (rate ?? 0) > 100) {
        toast.error("Komisyon oranı yüzde olarak 0 ile 100 arasında olmalı.");
        return;
      }
    }
    const rentalPrice = Number.parseFloat(rentalDailyPrice.trim().replace(",", "."));
    if (!Number.isFinite(rentalPrice) || rentalPrice <= 0) {
      toast.error("Günlük kiralama fiyatı zorunlu ve sıfırdan büyük olmalı.");
      return;
    }
    const images = compactVehicleImages(draftImages);
    const missingVehicleImages = REQUIRED_VEHICLE_IMAGE_SLOTS.filter((slot) => !images?.[slot]);
    if (missingVehicleImages.length > 0) {
      toast.error("Araç için ön, arka, sol, sağ, kokpit ve arka koltuk fotoğrafları zorunlu.");
      return;
    }
    if (vehicleCountry === COUNTRY_NONE) {
      toast.error("Ülke seçimi zorunludur.");
      return;
    }
    if (!defaultPickupId.trim()) {
      toast.error("Varsayılan alış noktası seçin.");
      return;
    }
    const seatsParsed = seats.trim() === "" ? undefined : Number.parseInt(seats.trim(), 10);
    if (seats.trim() !== "" && (!Number.isFinite(seatsParsed) || seatsParsed! < 1 || seatsParsed! > 20)) {
      toast.error("Koltuk sayısı 1–20 arası veya boş olmalıdır.");
      return;
    }
    const luggageParsed = luggage.trim() === "" ? undefined : Number.parseInt(luggage.trim(), 10);
    if (luggage.trim() !== "" && (!Number.isFinite(luggageParsed) || luggageParsed! < 0)) {
      toast.error("Bagaj (valiz) için geçerli bir sayı girin veya boş bırakın.");
      return;
    }
    const highlightsFromText = highlightsText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(0, 30);

    setSaving(true);
    try {
      await addVehicle({
        plate: p,
        brand: b,
        model: m,
        year: y,
        maintenance: false,
        external: externalVehicle,
        externalCompany: externalVehicle ? externalCompany.trim() : undefined,
        commissionRatePercent: externalVehicle ? rate : undefined,
        commissionBrokerPhone: externalVehicle ? commissionBrokerPhone.trim() : undefined,
        rentalDailyPrice: rentalPrice,
        countryCode: vehicleCountry,
        defaultPickupHandoverLocationId: defaultPickupId.trim(),
        returnHandoverLocationIds: selectedReturnIds.length > 0 ? selectedReturnIds : undefined,
        optionTemplateIds: selectedTemplateIds.length > 0 ? selectedTemplateIds : undefined,
        highlights: highlightsFromText.length > 0 ? highlightsFromText : undefined,
        images,
        ...(fuelType !== SPECS_FUEL_NONE ? { fuelType } : {}),
        ...(transmissionType !== SPECS_TRANS_NONE ? { transmissionType } : {}),
        ...(bodyStyleCode !== SPECS_BODY_NONE ? { bodyStyleCode } : {}),
        ...(seatsParsed !== undefined ? { seats: seatsParsed } : {}),
        ...(luggageParsed !== undefined ? { luggage: luggageParsed } : {}),
      });
      toast.success("Araç kaydedildi");
      router.push("/vehicles");
    } catch (e) {
      toast.error(getRentApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="rounded-xl border border-border/80 bg-card shadow-sm dark:border-border/60">
        <div className="space-y-4 p-4 sm:p-6">
        <div className="space-y-1 pb-1 pt-0">
          <h1 className="text-lg font-semibold">Add New Vehicle</h1>
          <p className="text-xs text-muted-foreground">
            Configure global logistics and finalize asset media.
          </p>
          <div className="pt-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Step {step} of 3</p>
            <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
              <div className={cn("h-1.5 rounded-full bg-primary transition-all", step === 1 ? "w-1/3" : step === 2 ? "w-2/3" : "w-full")} />
            </div>
          </div>
        </div>
        <div className="space-y-3">
          {catalogLoading ? (
            <p className="text-xs text-muted-foreground">Araç formu için katalog yükleniyor…</p>
          ) : null}
          {catalogError ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs">
              <span className="text-destructive">{getRentApiErrorMessage(catalogError)}</span>
              <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => void refetchCatalog()}>
                Yeniden dene
              </Button>
            </div>
          ) : null}
          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="nv-plate" className="text-xs">
                    Plaka
                  </Label>
                  <Input
                    id="nv-plate"
                    value={plate}
                    onChange={(e) => setPlate(e.target.value)}
                    placeholder="34 ABC 123"
                    className="font-mono"
                    disabled={formLocked}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="nv-year" className="text-xs">
                    Model yılı
                  </Label>
                  <Input
                    id="nv-year"
                    type="number"
                    min={1950}
                    max={new Date().getFullYear() + 1}
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    disabled={formLocked}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Marka</Label>
                  <SearchableSelect
                    className="text-xs"
                    items={staticBrandItems}
                    value={brandId}
                    onValueChange={(v) => {
                      setBrandId(v);
                      setModelId(MODEL_NONE);
                    }}
                    noneValue={BRAND_NONE}
                    noneLabel="Seçin"
                    placeholder="Seçin"
                    searchPlaceholder="Marka ara…"
                    emptyText="Marka listesi yüklenemedi."
                    disabled={formLocked}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Model</Label>
                  <SearchableSelect
                    className="text-xs"
                    items={staticModelItems}
                    value={modelId}
                    onValueChange={setModelId}
                    noneValue={MODEL_NONE}
                    noneLabel="Seçin"
                    placeholder={brandId === BRAND_NONE ? "Önce marka seçin" : "Seçin"}
                    searchPlaceholder="Model ara…"
                    emptyText="Bu marka için model yok."
                    disabled={formLocked || brandId === BRAND_NONE}
                  />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Araç özellikleri
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Yakıt türü</Label>
                    <SearchableSelect
                      className="text-xs"
                      items={fuelSelectItems}
                      value={fuelType}
                      onValueChange={setFuelType}
                      noneValue={SPECS_FUEL_NONE}
                      noneLabel="Seçilmedi"
                      placeholder="Seçin"
                      searchPlaceholder="Yakıt ara…"
                      emptyText="Sonuç yok."
                      disabled={formLocked}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Vites türü</Label>
                    <SearchableSelect
                      className="text-xs"
                      items={transmissionSelectItems}
                      value={transmissionType}
                      onValueChange={setTransmissionType}
                      noneValue={SPECS_TRANS_NONE}
                      noneLabel="Seçilmedi"
                      placeholder="Seçin"
                      searchPlaceholder="Vites ara…"
                      emptyText="Sonuç yok."
                      disabled={formLocked}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Araç türü</Label>
                    <SearchableSelect
                      className="text-xs"
                      items={bodyStyleSelectItems}
                      value={bodyStyleCode}
                      onValueChange={setBodyStyleCode}
                      noneValue={SPECS_BODY_NONE}
                      noneLabel="Seçilmedi"
                      placeholder="Seçin"
                      searchPlaceholder="Gövde tipi ara…"
                      emptyText="Sonuç yok."
                      disabled={formLocked}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Koltuk sayısı</Label>
                    <Input
                      className="h-9 text-xs"
                      inputMode="numeric"
                      placeholder="Örn. 5"
                      value={seats}
                      onChange={(e) => setSeats(e.target.value)}
                      disabled={formLocked}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Bagaj (valiz sayısı)</Label>
                    <Input
                      className="h-9 text-xs"
                      inputMode="numeric"
                      placeholder="Örn. 5"
                      value={luggage}
                      onChange={(e) => setLuggage(e.target.value)}
                      disabled={formLocked}
                    />
                  </div>
                </div>
              </div>
              <label className={cn("flex cursor-pointer items-center gap-2 text-xs", formLocked && "pointer-events-none opacity-60")}>
                <input
                  type="checkbox"
                  checked={externalVehicle}
                  onChange={(e) => setExternalVehicle(e.target.checked)}
                  className="rounded border-input"
                  disabled={formLocked}
                />
                Harici araç (başka firmadan)
              </label>
              {externalVehicle && (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="nv-external-company">Harici firma adı</Label>
                    <Input
                      id="nv-external-company"
                      value={externalCompany}
                      onChange={(e) => setExternalCompany(e.target.value)}
                      placeholder="Örn: X Rent A Car"
                      disabled={formLocked}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="nv-commission-rate">Komisyon oranı (%)</Label>
                    <Input
                      id="nv-commission-rate"
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={commissionRatePercent}
                      onChange={(e) => setCommissionRatePercent(e.target.value)}
                      placeholder="Örn: 12.5"
                      disabled={formLocked}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="nv-commission-broker-phone">Komisyoncu telefonu (opsiyonel)</Label>
                    <Input
                      id="nv-commission-broker-phone"
                      value={commissionBrokerPhone}
                      onChange={(e) => setCommissionBrokerPhone(e.target.value)}
                      placeholder="+90 5xx ..."
                      disabled={formLocked}
                    />
                  </div>
                </>
              )}
              <div className="space-y-1">
                <Label htmlFor="nv-rental-price">Günlük kiralama fiyatı</Label>
                <Input
                  id="nv-rental-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={rentalDailyPrice}
                  onChange={(e) => setRentalDailyPrice(e.target.value)}
                  placeholder="0.00"
                  disabled={formLocked}
                />
              </div>
              <div className="space-y-2 rounded-md border border-border/50 bg-muted/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-xs">Ek opsiyonlar (şablondan)</Label>
              <Button variant="ghost" className="h-auto px-1 py-0 text-[11px] text-primary" asChild>
                <Link href="/settings/options/vehicle">Şablonları yönet</Link>
              </Button>
            </div>
            <Input
              placeholder="Şablonda ara…"
              value={optionSearch}
              onChange={(e) => setOptionSearch(e.target.value)}
              className="h-8 text-xs"
              disabled={formLocked}
            />
            {selectedTemplateIds.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {selectedTemplateIds.map((id) => {
                  const t = optionTemplates.find((x) => x.id === id);
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[10px]"
                    >
                      <span className="max-w-[10rem] truncate">{t?.title ?? id}</span>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Kaldır"
                        onClick={() => setSelectedTemplateIds((prev) => prev.filter((x) => x !== id))}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">İsteğe bağlı. Seçilen sıra ile araca kopyalanır.</p>
            )}
            <div className="max-h-40 space-y-1 overflow-y-auto rounded border border-border/40 bg-background/50 p-1">
              {filteredOptionTemplates.length === 0 ? (
                <p className="px-2 py-2 text-[11px] text-muted-foreground">
                  {optionTemplates.length === 0 ? "Önce opsiyon şablonu ekleyin." : "Eşleşen şablon yok."}
                </p>
              ) : (
                filteredOptionTemplates.map((t) => {
                  const selected = selectedTemplateIds.includes(t.id);
                  return (
                    <div key={t.id} className="flex items-center justify-between gap-2 rounded px-1 py-1 hover:bg-muted/60">
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-medium">{t.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {Number.isFinite(t.price)
                            ? formatEur(t.price)
                            : "—"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={selected ? "secondary" : "outline"}
                        className="h-7 shrink-0 px-2 text-[10px]"
                        disabled={selected || formLocked}
                        onClick={() => setSelectedTemplateIds((prev) => [...prev, t.id])}
                      >
                        {selected ? "Eklendi" : "Ekle"}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="space-y-1">
                <Label htmlFor="nv-country">Ülke</Label>
                <Select value={vehicleCountry} onValueChange={setVehicleCountry} disabled={formLocked}>
                  <SelectTrigger id="nv-country" className="w-full">
                    <SelectValue placeholder="Ülke seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={COUNTRY_NONE}>Atanmadı</SelectItem>
                    {countriesSorted.map((c) => (
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
                <Label>Varsayılan alış noktası</Label>
                <Select value={defaultPickupId || undefined} onValueChange={setDefaultPickupId} disabled={formLocked}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="PICKUP noktası seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {pickupLocs.map((loc) => (
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
                  Açılır listede arayıp birden fazla seçebilirsiniz. Boş bırakırsanız bu araç için teslim kısıtı olmaz.
                </p>
                <HandoverReturnMultiCombobox
                  locations={returnLocs}
                  value={selectedReturnIds}
                  onChange={setSelectedReturnIds}
                  placeholder="Teslim noktası seçin…"
                  disabled={formLocked}
                  emptyMessage={
                    catalog && returnLocs.length === 0
                      ? "Katalogda teslim noktası yok."
                      : "Ayarlar → Teslim noktalarından RETURN kaydı ekleyin"
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nv-highlights">Öne çıkanlar (opsiyonel)</Label>
                <textarea
                  id="nv-highlights"
                  value={highlightsText}
                  onChange={(e) => setHighlightsText(e.target.value)}
                  placeholder={"Her satır bir madde (en fazla 30).\nÖrn: Kasko dahil\n7/24 yol yardımı"}
                  rows={4}
                  disabled={formLocked}
                  className="flex min-h-[88px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                />
                <p className="text-[10px] text-muted-foreground">İlan ve müşteri arayüzünde sırayla gösterilir.</p>
              </div>
              <VehicleImageSlotsEditor value={draftImages} onChange={setDraftImages} />
            </>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-border/60 pt-4 sm:flex-row sm:justify-end">
          {step === 1 ? (
            <Button type="button" variant="outline" size="sm" className="h-9 w-full text-xs sm:w-auto" asChild>
              <Link href="/vehicles">İptal</Link>
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" className="h-9 w-full text-xs sm:w-auto" onClick={() => setStep((prev) => (prev - 1) as NewVehicleStep)}>
              Back
            </Button>
          )}
          {step < 3 ? (
            <Button type="button" size="sm" variant="hero" className="h-9 w-full text-xs sm:w-auto" disabled={formLocked} onClick={nextStep}>
              Next
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="hero"
              className="h-9 w-full text-xs sm:w-auto"
              disabled={saving || formLocked}
              onClick={() => void submitNewVehicle()}
            >
              {saving ? "Kaydediliyor…" : "Submit & Create Vehicle"}
            </Button>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
