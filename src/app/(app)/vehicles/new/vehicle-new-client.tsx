"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCountries } from "@/hooks/use-countries";
import { useFleetVehicles } from "@/hooks/use-fleet-vehicles";
import {
  fetchHandoverLocationsFromRentApi,
  fetchVehicleBodyStylesFromRentApi,
  fetchVehicleFuelTypesFromRentApi,
  fetchVehicleOptionTemplatesFromRentApi,
  fetchVehicleTransmissionTypesFromRentApi,
  getRentApiErrorMessage,
  type HandoverLocationApiRow,
  type VehicleBodyStyleRow,
  type VehicleOptionTemplateApiRow,
} from "@/lib/rent-api";
import { compactVehicleImages, type VehicleImages } from "@/lib/vehicle-images";
import { HandoverReturnMultiCombobox } from "@/components/vehicles/handover-return-multi-combobox";
import { VehicleImageSlotsEditor } from "@/components/vehicles/vehicle-image-slots-editor";

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

function sortVehicleCatalogRows(rows: VehicleBodyStyleRow[]): VehicleBodyStyleRow[] {
  return [...rows].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.labelTr.localeCompare(b.labelTr, "tr"),
  );
}

export function VehicleNewClient() {
  const router = useRouter();
  const { allVehicles, addVehicle } = useFleetVehicles();
  const { countries } = useCountries();
  const [saving, setSaving] = useState(false);
  const [plate, setPlate] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [maintenance, setMaintenance] = useState(false);
  const [externalVehicle, setExternalVehicle] = useState(false);
  const [externalCompany, setExternalCompany] = useState("");
  const [commissionRatePercent, setCommissionRatePercent] = useState("");
  const [commissionBrokerPhone, setCommissionBrokerPhone] = useState("");
  const [rentalDailyPrice, setRentalDailyPrice] = useState("");
  const [vehicleCountry, setVehicleCountry] = useState<string>(COUNTRY_NONE);
  const [draftImages, setDraftImages] = useState<VehicleImages>({});
  const [pickupLocs, setPickupLocs] = useState<HandoverLocationApiRow[]>([]);
  const [returnLocs, setReturnLocs] = useState<HandoverLocationApiRow[]>([]);
  const [defaultPickupId, setDefaultPickupId] = useState("");
  const [selectedReturnIds, setSelectedReturnIds] = useState<string[]>([]);
  const [optionTemplates, setOptionTemplates] = useState<VehicleOptionTemplateApiRow[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [optionSearch, setOptionSearch] = useState("");
  const [highlightsText, setHighlightsText] = useState("");
  const [fuelType, setFuelType] = useState(SPECS_FUEL_NONE);
  const [transmissionType, setTransmissionType] = useState(SPECS_TRANS_NONE);
  const [bodyStyleCode, setBodyStyleCode] = useState(SPECS_BODY_NONE);
  const [seats, setSeats] = useState("");
  const [luggage, setLuggage] = useState("");
  const [bodyStyleOptions, setBodyStyleOptions] = useState<VehicleBodyStyleRow[]>([]);
  const [fuelTypeOptions, setFuelTypeOptions] = useState<VehicleBodyStyleRow[]>([]);
  const [transmissionTypeOptions, setTransmissionTypeOptions] = useState<VehicleBodyStyleRow[]>([]);

  const countriesSorted = useMemo(
    () => [...countries].sort((a, b) => a.name.localeCompare(b.name, "tr")),
    [countries],
  );

  useEffect(() => {
    void fetchHandoverLocationsFromRentApi("PICKUP").then((rows) => setPickupLocs(rows.filter((r) => r.active !== false)));
    void fetchHandoverLocationsFromRentApi("RETURN").then((rows) => setReturnLocs(rows.filter((r) => r.active !== false)));
    void fetchVehicleOptionTemplatesFromRentApi().then((rows) => setOptionTemplates(rows.filter((r) => r.active)));
    void fetchVehicleBodyStylesFromRentApi().then((rows) => setBodyStyleOptions(sortVehicleCatalogRows(rows)));
    void fetchVehicleFuelTypesFromRentApi().then((rows) => setFuelTypeOptions(sortVehicleCatalogRows(rows)));
    void fetchVehicleTransmissionTypesFromRentApi().then((rows) =>
      setTransmissionTypeOptions(sortVehicleCatalogRows(rows)),
    );
  }, []);

  const filteredOptionTemplates = useMemo(() => {
    const q = optionSearch.trim().toLocaleLowerCase("tr");
    if (!q) return optionTemplates;
    return optionTemplates.filter(
      (t) =>
        t.title.toLocaleLowerCase("tr").includes(q) ||
        (t.description ?? "").toLocaleLowerCase("tr").includes(q),
    );
  }, [optionSearch, optionTemplates]);

  const submitNewVehicle = async () => {
    const p = normalizePlate(plate);
    const b = brand.trim();
    const m = model.trim();
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
      const created = await addVehicle({
        plate: p,
        brand: b,
        model: m,
        year: y,
        maintenance: Boolean(maintenance),
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
      router.push(`/vehicles/${created.id}`);
    } catch (e) {
      toast.error(getRentApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Card className="glow-card overflow-hidden">
        <CardHeader className="space-y-1 border-b border-border/60 pb-4 pt-5">
          <CardTitle className="text-lg">Yeni araç</CardTitle>
          <CardDescription className="text-xs">
            Plaka benzersiz olmalı. Görseller base64 olarak yüklenir (demo). Tüm açılar zorunludur.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-4 py-4 sm:px-6">
          <div className="space-y-1">
            <Label htmlFor="nv-plate">Plaka</Label>
            <Input id="nv-plate" value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="34 ABC 123" className="font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="nv-brand">Marka</Label>
              <Input id="nv-brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nv-model">Model</Label>
              <Input id="nv-model" value={model} onChange={(e) => setModel(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="nv-year">Model yılı</Label>
            <Input
              id="nv-year"
              type="number"
              min={1950}
              max={new Date().getFullYear() + 1}
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          </div>
          <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Araç özellikleri
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Yakıt türü</Label>
                <Select value={fuelType} onValueChange={setFuelType}>
                  <SelectTrigger className="h-9 w-full text-xs">
                    <SelectValue />
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
                <Select value={transmissionType} onValueChange={setTransmissionType}>
                  <SelectTrigger className="h-9 w-full text-xs">
                    <SelectValue />
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
                <Select value={bodyStyleCode} onValueChange={setBodyStyleCode}>
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
                  value={seats}
                  onChange={(e) => setSeats(e.target.value)}
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
                />
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="nv-country">Ülke</Label>
            <Select value={vehicleCountry} onValueChange={setVehicleCountry}>
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
            <Select value={defaultPickupId || undefined} onValueChange={setDefaultPickupId}>
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
              emptyMessage="Ayarlar → Teslim noktalarından RETURN kaydı ekleyin"
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
                        <p className="text-[10px] text-muted-foreground">{t.price}</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={selected ? "secondary" : "outline"}
                        className="h-7 shrink-0 px-2 text-[10px]"
                        disabled={selected}
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
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input type="checkbox" checked={maintenance} onChange={(e) => setMaintenance(e.target.checked)} className="rounded border-input" />
            Bakımda (kiralanamaz)
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={externalVehicle}
              onChange={(e) => setExternalVehicle(e.target.checked)}
              className="rounded border-input"
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
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nv-commission-broker-phone">Komisyoncu telefonu (opsiyonel)</Label>
                <Input
                  id="nv-commission-broker-phone"
                  value={commissionBrokerPhone}
                  onChange={(e) => setCommissionBrokerPhone(e.target.value)}
                  placeholder="+90 5xx ..."
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
              className="flex min-h-[88px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p className="text-[10px] text-muted-foreground">İlan ve müşteri arayüzünde sırayla gösterilir.</p>
          </div>
          <VehicleImageSlotsEditor value={draftImages} onChange={setDraftImages} />
        </CardContent>
        <CardFooter className="flex flex-col-reverse gap-2 border-t border-border/60 bg-muted/10 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
          <Button type="button" variant="outline" size="sm" className="h-9 w-full text-xs sm:w-auto" asChild>
            <Link href="/vehicles">İptal</Link>
          </Button>
          <Button type="button" size="sm" variant="hero" className="h-9 w-full text-xs sm:w-auto" disabled={saving} onClick={() => void submitNewVehicle()}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
