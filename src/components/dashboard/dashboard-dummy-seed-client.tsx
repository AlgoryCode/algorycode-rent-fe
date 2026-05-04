"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Database } from "lucide-react";
import { toast } from "@/components/ui/sonner";

import { rentKeys } from "@/lib/rent-query-keys";
import {
  createCityOnRentApi,
  createCountryOnRentApi,
  createHandoverLocationOnRentApi,
  createRentalOnRentApi,
  createRentalRequestOnRentApi,
  createReservationExtraOptionTemplateOnRentApi,
  createVehicleBrandOnRentApi,
  createVehicleCatalogEntryOnRentApi,
  createVehicleModelOnRentApi,
  createVehicleOnRentApi,
  createVehicleOptionTemplateOnRentApi,
  createVehicleStatusOnRentApi,
  fetchCitiesFromRentApi,
  fetchCountriesFromRentApi,
  fetchHandoverLocationsFromRentApi,
  fetchVehicleFormCatalogFromRentApi,
  fetchVehiclesFromRentApi,
  getRentApiErrorMessage,
  type VehicleCatalogKind,
} from "@/lib/rent-api";
import { VEHICLE_IMAGE_SLOTS, type VehicleImageSlot } from "@/lib/vehicle-images";

const TINY_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function vehicleDummyImages(): Record<VehicleImageSlot, string> {
  const out = {} as Record<VehicleImageSlot, string>;
  for (const { key } of VEHICLE_IMAGE_SLOTS) {
    out[key] = TINY_PNG_DATA_URL;
  }
  return out;
}

function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysLocal(ymd: string, days: number): string {
  const [y, mo, da] = ymd.split("-").map((n) => Number(n));
  const d = new Date(y, mo - 1, da);
  d.setDate(d.getDate() + days);
  return formatLocalYmd(d);
}

function randomLetters(len: number): string {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let s = "";
  for (let i = 0; i < len; i += 1) {
    s += A[Math.floor(Math.random() * A.length)];
  }
  return s;
}

function randomCountryCode(): string {
  const n = 3 + Math.floor(Math.random() * 3);
  return randomLetters(n);
}

function randomPlate(): string {
  return `DUM ${String(Date.now()).slice(-6)}`;
}

function randomNationalId(): string {
  let s = "";
  for (let i = 0; i < 11; i += 1) {
    s += String(Math.floor(Math.random() * 10));
  }
  return s;
}

function randomPhoneTr(): string {
  const n = 1000000 + Math.floor(Math.random() * 8999999);
  return `+90555${String(n).slice(0, 7)}`;
}

type SeedKey =
  | "country"
  | "city"
  | "handover"
  | "catalog"
  | "vehicleTemplate"
  | "reservationExtraTemplate"
  | "vehicle"
  | "rental"
  | "rentalRequest";

async function invalidateRentData(qc: ReturnType<typeof useQueryClient>): Promise<void> {
  await Promise.all([
    qc.invalidateQueries({ queryKey: rentKeys.countries() }),
    qc.invalidateQueries({ queryKey: rentKeys.vehicles() }),
    qc.invalidateQueries({ queryKey: rentKeys.vehicleFormCatalog() }),
    qc.invalidateQueries({ queryKey: rentKeys.rentals() }),
    qc.invalidateQueries({ queryKey: rentKeys.rentalRequests() }),
  ]);
}

async function ensureDummyVehicleModelAndStatus(ts: number): Promise<{ vehicleModelId: string; vehicleStatusId: string }> {
  let catalog = await fetchVehicleFormCatalogFromRentApi();
  if (catalog.vehicleStatuses.length === 0) {
    try {
      await createVehicleStatusOnRentApi({ code: "available", labelTr: "Müsait", sortOrder: 0 });
    } catch (e) {
      const msg = getRentApiErrorMessage(e);
      if (!/409|Conflict|zaten|duplicate/i.test(msg)) {
        throw e;
      }
    }
    catalog = await fetchVehicleFormCatalogFromRentApi();
  }
  const statusRow =
    catalog.vehicleStatuses.find((s) => s.code.toLowerCase() === "available") ?? catalog.vehicleStatuses[0];
  if (!statusRow) {
    throw new Error("Araç statüsü bulunamadı ve oluşturulamadı.");
  }
  let vehicleModelId = "";
  for (const br of catalog.brands) {
    if (br.models.length > 0) {
      vehicleModelId = br.models[0].id;
      break;
    }
  }
  if (!vehicleModelId) {
    const brand = await createVehicleBrandOnRentApi({ name: `Dummy marka ${ts}`, sortOrder: 0 });
    const model = await createVehicleModelOnRentApi(brand.id, { name: `Dummy model ${ts}`, sortOrder: 0 });
    vehicleModelId = model.id;
  }
  return { vehicleModelId, vehicleStatusId: statusRow.id };
}

export function DashboardDummySeedClient() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<SeedKey | null>(null);

  const run = useCallback(
    async (key: SeedKey, fn: () => Promise<void>) => {
      if (busy) return;
      setBusy(key);
      try {
        await fn();
        await invalidateRentData(qc);
        toast.success("Örnek veri eklendi.");
      } catch (e) {
        toast.error(getRentApiErrorMessage(e));
      } finally {
        setBusy(null);
      }
    },
    [busy, qc],
  );

  const seedCountry = () =>
    run("country", async () => {
      let code = "";
      for (let attempt = 0; attempt < 8; attempt += 1) {
        code = randomCountryCode();
        try {
          await createCountryOnRentApi({
            code,
            name: `Dummy ülke ${Date.now()}`,
            colorCode: "#22C55E",
          });
          return;
        } catch (e) {
          const msg = getRentApiErrorMessage(e);
          if (!/409|Conflict|zaten|duplicate/i.test(msg) || attempt === 7) {
            throw e;
          }
        }
      }
    });

  const seedCity = () =>
    run("city", async () => {
      const countries = await fetchCountriesFromRentApi();
      if (countries.length === 0) {
        throw new Error("Önce bir ülke ekleyin veya “Ülke” düğmesini kullanın.");
      }
      const c = countries[countries.length - 1];
      await createCityOnRentApi({
        name: `Dummy şehir ${Date.now()}`,
        countryId: c.id,
      });
    });

  const seedHandover = () =>
    run("handover", async () => {
      const cities = await fetchCitiesFromRentApi();
      if (cities.length === 0) {
        throw new Error("Önce şehir ekleyin (veya ülke + şehir düğmeleri).");
      }
      const city = cities[cities.length - 1];
      const ts = Date.now();
      await createHandoverLocationOnRentApi({
        kind: "PICKUP",
        name: `Dummy alış ${ts}`,
        description: "Dashboard örnek veri",
        cityId: city.id,
        active: true,
        lineOrder: 0,
        surchargeEur: 0,
      });
      await createHandoverLocationOnRentApi({
        kind: "RETURN",
        name: `Dummy teslim ${ts}`,
        description: "Dashboard örnek veri",
        cityId: city.id,
        active: true,
        lineOrder: 1,
        surchargeEur: 0,
      });
    });

  const seedCatalog = () =>
    run("catalog", async () => {
      const ts = Date.now();
      const kinds: VehicleCatalogKind[] = ["bodyStyle", "fuelType", "transmissionType"];
      for (const kind of kinds) {
        await createVehicleCatalogEntryOnRentApi(kind, {
          labelTr: `Dummy katalog (${kind}) ${ts}`,
          sortOrder: 990,
        });
      }
    });

  const seedVehicleTemplate = () =>
    run("vehicleTemplate", async () => {
      await createVehicleOptionTemplateOnRentApi({
        title: `Dummy araç opsiyonu ${Date.now()}`,
        description: "Dashboard örnek veri",
        price: 25,
        lineOrder: 99,
        active: true,
      });
    });

  const seedReservationExtra = () =>
    run("reservationExtraTemplate", async () => {
      const code = `D${Date.now().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "X").slice(0, 12)}`;
      await createReservationExtraOptionTemplateOnRentApi({
        code,
        title: `Dummy ek hizmet ${Date.now()}`,
        description: "Dashboard örnek veri",
        price: 15,
        lineOrder: 99,
        active: true,
        requiresCoDriverDetails: false,
      });
    });

  const seedVehicle = () =>
    run("vehicle", async () => {
      let countries = await fetchCountriesFromRentApi();
      if (countries.length === 0) {
        const code = randomCountryCode();
        await createCountryOnRentApi({
          code,
          name: `Dummy ülke (araç) ${Date.now()}`,
          colorCode: "#3B82F6",
        });
        countries = await fetchCountriesFromRentApi();
      }
      const country = countries[countries.length - 1];

      let cities = await fetchCitiesFromRentApi(country.id);
      if (cities.length === 0) {
        await createCityOnRentApi({
          name: `Dummy şehir (araç) ${Date.now()}`,
          countryId: country.id,
        });
        cities = await fetchCitiesFromRentApi(country.id);
      }
      const city = cities[cities.length - 1];

      const pickups = await fetchHandoverLocationsFromRentApi("PICKUP");
      const returns = await fetchHandoverLocationsFromRentApi("RETURN");
      const pickupForCity = pickups.filter((p) => p.cityId === city.id);
      const returnForCity = returns.filter((p) => p.cityId === city.id);

      let pickupId = pickupForCity[0]?.id;
      let returnId = returnForCity[0]?.id;

      const ts = Date.now();
      if (!pickupId) {
        const p = await createHandoverLocationOnRentApi({
          kind: "PICKUP",
          name: `Dummy alış (araç) ${ts}`,
          cityId: city.id,
          active: true,
          lineOrder: 0,
          surchargeEur: 0,
        });
        pickupId = p.id;
      }
      if (!returnId) {
        const r = await createHandoverLocationOnRentApi({
          kind: "RETURN",
          name: `Dummy teslim (araç) ${ts}`,
          cityId: city.id,
          active: true,
          lineOrder: 1,
          surchargeEur: 0,
        });
        returnId = r.id;
      }

      const { vehicleModelId, vehicleStatusId } = await ensureDummyVehicleModelAndStatus(ts);

      await createVehicleOnRentApi({
        plate: randomPlate(),
        brand: "Dummy",
        model: `Model ${ts}`,
        year: new Date().getFullYear() - 2,
        maintenance: false,
        vehicleModelId,
        vehicleStatusId,
        external: false,
        rentalDailyPrice: 120,
        countryCode: country.code,
        cityId: city.id,
        defaultPickupHandoverLocationId: pickupId,
        returnHandoverLocationIds: [returnId],
        images: vehicleDummyImages(),
        seats: 5,
        luggage: 2,
        highlights: ["Dashboard örnek aracı"],
      });
    });

  const seedRental = () =>
    run("rental", async () => {
      const vehicles = await fetchVehiclesFromRentApi();
      const v = vehicles.find((x) => !x.maintenance);
      if (!v) {
        throw new Error("Kiralanabilir araç yok. Önce “Araç” ile örnek araç ekleyin.");
      }
      const start = formatLocalYmd(new Date());
      const end = addDaysLocal(start, 2);
      await createRentalOnRentApi({
        vehicleId: v.id,
        startDate: start,
        endDate: end,
        outsideCountryTravel: false,
        customer: {
          fullName: `Dummy müşteri ${Date.now()}`,
          nationalId: randomNationalId(),
          passportNo: "",
          phone: randomPhoneTr(),
          email: `dummy.rental.${Date.now()}@example.com`,
          birthDate: "1990-01-15",
          driverLicenseNo: "DUMMY-LIC",
        },
        status: "active",
      });
    });

  const seedRentalRequest = () =>
    run("rentalRequest", async () => {
      const vehicles = await fetchVehiclesFromRentApi();
      const v = vehicles.find((x) => !x.maintenance);
      if (!v) {
        throw new Error("Araç yok. Önce “Araç” ile örnek araç ekleyin.");
      }
      const start = formatLocalYmd(new Date());
      const end = addDaysLocal(start, 2);
      await createRentalRequestOnRentApi({
        vehicleId: v.id,
        startDate: start,
        endDate: end,
        outsideCountryTravel: false,
        note: "Dashboard örnek talep",
        customer: {
          fullName: `Dummy talep ${Date.now()}`,
          phone: randomPhoneTr(),
          email: `dummy.request.${Date.now()}@example.com`,
          birthDate: "1992-06-01",
          nationalId: randomNationalId(),
          passportNo: "P" + String(Date.now()).slice(-8),
          driverLicenseNo: "L" + String(Date.now()).slice(-8),
          passportImageDataUrl: TINY_PNG_DATA_URL,
          driverLicenseImageDataUrl: TINY_PNG_DATA_URL,
        },
      });
    });

  const btn =
    "inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background/90 px-3 text-xs font-medium shadow-sm transition hover:bg-muted/60 disabled:pointer-events-none disabled:opacity-50";

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/85">
          <Database className="h-5 w-5 text-amber-600" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-sm font-semibold tracking-tight">Örnek (dummy) veri</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Geliştirme ve demo için tek tek API çağrılarıyla kayıt oluşturur. Kiralama: bugünden başlayan 3 günlük
              aralık (başlangıç + 2 gün bitiş).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} disabled={busy != null} onClick={() => void seedCountry()}>
              {busy === "country" ? "…" : "Ülke"}
            </button>
            <button type="button" className={btn} disabled={busy != null} onClick={() => void seedCity()}>
              {busy === "city" ? "…" : "Şehir"}
            </button>
            <button type="button" className={btn} disabled={busy != null} onClick={() => void seedHandover()}>
              {busy === "handover" ? "…" : "Lokasyon"}
            </button>
            <button type="button" className={btn} disabled={busy != null} onClick={() => void seedCatalog()}>
              {busy === "catalog" ? "…" : "Araç katalogları"}
            </button>
            <button type="button" className={btn} disabled={busy != null} onClick={() => void seedVehicleTemplate()}>
              {busy === "vehicleTemplate" ? "…" : "Araç şablonları"}
            </button>
            <button
              type="button"
              className={btn}
              disabled={busy != null}
              onClick={() => void seedReservationExtra()}
            >
              {busy === "reservationExtraTemplate" ? "…" : "Rezervasyon ekleri"}
            </button>
            <button type="button" className={btn} disabled={busy != null} onClick={() => void seedVehicle()}>
              {busy === "vehicle" ? "…" : "Araç"}
            </button>
            <button type="button" className={btn} disabled={busy != null} onClick={() => void seedRental()}>
              {busy === "rental" ? "…" : "Kiralama"}
            </button>
            <button type="button" className={btn} disabled={busy != null} onClick={() => void seedRentalRequest()}>
              {busy === "rentalRequest" ? "…" : "Talep"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
