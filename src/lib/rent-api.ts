import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";

import { RENT_API_BASE } from "@/lib/config";
import { refreshPanelSession } from "@/lib/panel-same-origin-axios";
import { clearRentApiGatewayAuthCache, resolveGatewayBearerHeader } from "@/lib/rent-gateway-bearer-cache";

export { clearRentApiGatewayAuthCache } from "@/lib/rent-gateway-bearer-cache";

function browserGatewayCrossOrigin(): boolean {
  if (typeof window === "undefined") return false;
  const b = RENT_API_BASE.trim();
  if (!b.startsWith("http")) return false;
  try {
    return new URL(b).origin !== window.location.origin;
  } catch {
    return false;
  }
}
import type {
  AdditionalDriverInfo,
  RentalSession,
  Vehicle,
  VehicleHandoverRef,
  VehicleOptionDefRow,
} from "@/lib/mock-fleet";
import type { PaymentLog, PaymentLogStatus } from "@/lib/mock-payments";
import type { PanelUser, PanelUserRole } from "@/lib/mock-users";
import { normalizeRentalStatus } from "@/lib/rental-status";
import { VEHICLE_IMAGE_SLOTS, type VehicleImageSlot } from "@/lib/vehicle-images";

const SLOT_KEYS = new Set<string>(VEHICLE_IMAGE_SLOTS.map((s) => s.key));

/**
 * rent-service DTO’larında `Long` alanlar: JSON’da sayı olmalı.
 * Dize dizisi (`["1","2"]`) bazı Jackson ayarlarında 400/500’a yol açabiliyor.
 */
function rentApiLongValue(raw: string | undefined | null): number | undefined {
  if (raw == null) return undefined;
  const t = String(raw).trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return undefined;
  return n;
}

function rentApiLongArray(raw: string[] | undefined): number[] | undefined {
  if (raw === undefined) return undefined;
  const out: number[] = [];
  for (const s of raw) {
    const n = rentApiLongValue(s);
    if (n !== undefined) out.push(n);
  }
  return out;
}

function rentVehiclePathId(id: string): string {
  return encodeURIComponent(String(id).trim());
}

type RetryCfg = InternalAxiosRequestConfig & { __rent401Retried?: boolean };

function attachRent401Refresh(client: AxiosInstance) {
  client.interceptors.response.use(
    (res) => res,
    async (error: AxiosError) => {
      const status = error.response?.status;
      const cfg = error.config as RetryCfg | undefined;
      if (status !== 401 || !cfg || cfg.__rent401Retried || typeof window === "undefined") {
        return Promise.reject(error);
      }
      cfg.__rent401Retried = true;
      try {
        const ok = await refreshPanelSession();
        if (!ok) {
          return Promise.reject(error);
        }
        if (browserGatewayCrossOrigin()) {
          clearRentApiGatewayAuthCache();
        }
        return client.request(cfg);
      } catch {
        return Promise.reject(error);
      }
    },
  );
}

function rentClient() {
  if (!RENT_API_BASE) {
    throw new Error(
      "RENT_API_BASE tanımsız (api-base / gateway kökü). NEXT_PUBLIC_GATEWAY_URL veya varsayılan gateway kullanılmalı.",
    );
  }
  const client = axios.create({
    baseURL: RENT_API_BASE,
    timeout: 20_000,
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    // Cross-origin: cookie panel origin’de; JWT `Authorization` ile gidiyor. `true` olsa gateway
    // `Access-Control-Allow-Credentials: true` + dar origin ister (globalcors allowCredentials:false ile çakışır).
    withCredentials: false,
  });
  if (browserGatewayCrossOrigin()) {
    client.interceptors.request.use(async (config) => {
      const auth = await resolveGatewayBearerHeader();
      if (auth) {
        config.headers.Authorization = auth;
      }
      return config;
    });
  }
  attachRent401Refresh(client);
  return client;
}

export type VehicleBodyStyleRow = {
  /** Veritabanı otomatik artan kimlik; silme isteğinde kullanılır (UI’da göstermek zorunlu değil). */
  id: string;
  code: string;
  labelTr: string;
  sortOrder: number;
};

/** Gövde / yakıt / vites referans satırı (aynı JSON şekli). */
export type VehicleCatalogRow = VehicleBodyStyleRow;

function mapVehicleCatalogRow(o: Record<string, unknown>): VehicleCatalogRow {
  const rawId = o.id;
  const idStr =
    typeof rawId === "number" && Number.isFinite(rawId)
      ? String(Math.trunc(rawId))
      : typeof rawId === "string" && rawId.trim()
        ? rawId.trim()
        : "";
  return {
    id: idStr,
    code: String(o.code ?? ""),
    labelTr: String(o.labelTr ?? o.label_tr ?? ""),
    sortOrder: typeof o.sortOrder === "number" ? o.sortOrder : Number(o.sort_order ?? 0) || 0,
  };
}

const VEHICLE_CATALOG_API = {
  bodyStyle: "/vehicle-body-styles",
  fuelType: "/vehicle-fuel-types",
  transmissionType: "/vehicle-transmission-types",
} as const;

export type VehicleCatalogKind = keyof typeof VEHICLE_CATALOG_API;

export type VehicleCatalogCreatePayload = {
  /** Boş bırakılırsa sunucu özellik adından benzersiz kod üretir. */
  code?: string;
  labelTr: string;
  sortOrder: number;
};

export type VehicleCatalogUpdatePayload = {
  labelTr?: string;
  sortOrder?: number;
};

export type VehicleOptionDefinitionPayload = {
  title: string;
  description?: string;
  price: number;
  icon?: string;
  lineOrder: number;
  active?: boolean;
};

export type CreateVehiclePayload = {
  plate: string;
  brand: string;
  model: string;
  year: number;
  maintenance: boolean;
  external?: boolean;
  externalCompany?: string;
  rentalDailyPrice: number;
  commissionRatePercent?: number;
  commissionBrokerPhone?: string;
  /** Ülke tablosundaki kod ile eşleşir (en fazla 64 karakter). */
  countryCode: string;
  /** rent-service şehir (opsiyonel). */
  cityId?: string;
  defaultPickupHandoverLocationId: string;
  /** Boş veya atlanırsa araç için teslim kısıtı yok; doluysa yalnız bu RETURN noktaları geçerli. */
  returnHandoverLocationIds?: string[];
  /** Geriye uyumluluk: tek teslim; {@code returnHandoverLocationIds} doluysa kullanılmaz. */
  defaultReturnHandoverLocationId?: string;
  /** Sunucuda şablondan kopyalanır; {@code optionDefinitions} ile birlikte kullanılabilir. */
  optionTemplateIds?: string[];
  optionDefinitions?: VehicleOptionDefinitionPayload[];
  /** Her satır bir madde; en fazla 30 (opsiyonel). */
  highlights?: string[];
  images?: Record<string, string>;
  engine?: string;
  fuelType?: string;
  bodyColor?: string;
  seats?: number;
  luggage?: number;
  transmissionType?: string;
  bodyStyleCode?: string;
};

export type UpdateVehiclePayload = {
  plate?: string;
  brand?: string;
  model?: string;
  year?: number;
  maintenance?: boolean;
  external?: boolean;
  externalCompany?: string;
  rentalDailyPrice?: number;
  commissionRatePercent?: number;
  commissionBrokerPhone?: string;
  countryCode?: string;
  cityId?: string;
  defaultPickupHandoverLocationId?: string;
  /** null/undefined: dokunma; []: tüm teslim atamalarını kaldır. */
  returnHandoverLocationIds?: string[];
  defaultReturnHandoverLocationId?: string;
  optionTemplateIds?: string[];
  optionDefinitions?: VehicleOptionDefinitionPayload[];
  /** {@code undefined}: değiştirme; boş dizi: tümünü sil. */
  highlights?: string[];
  images?: Record<string, string>;
  engine?: string;
  fuelType?: string;
  bodyColor?: string;
  seats?: number;
  luggage?: number;
  transmissionType?: string;
  bodyStyleCode?: string;
};

export type CountryRow = {
  id: string;
  code: string;
  name: string;
  colorCode: string;
};

export type CityRow = {
  id: string;
  name: string;
  countryId: string;
  countryCode: string;
  countryName: string;
};

export type HandoverLocationApiRow = {
  id: string;
  kind: string;
  name: string;
  description?: string | null;
  cityId?: string | null;
  cityName?: string | null;
  countryCode?: string | null;
  lineOrder?: number;
  active?: boolean;
  /** Bu nokta seçildiğinde eklenen sabit ücret (EUR); farklı bırakış fiyatlaması. */
  surchargeEur?: number;
};

export type CreateHandoverLocationPayload = {
  kind: "PICKUP" | "RETURN";
  name: string;
  description?: string;
  cityId?: string;
  active?: boolean;
  lineOrder: number;
  surchargeEur?: number;
};

export type UpdateHandoverLocationPayload = {
  kind?: "PICKUP" | "RETURN";
  name?: string;
  description?: string;
  cityId?: string;
  clearCity?: boolean;
  active?: boolean;
  lineOrder?: number;
  surchargeEur?: number;
};

export type VehicleOptionTemplateApiRow = {
  id: string;
  title: string;
  description?: string | null;
  price: number;
  icon?: string | null;
  lineOrder: number;
  active: boolean;
};

export type VehicleFormCatalogModelRow = {
  id: string;
  name: string;
  sortOrder: number;
};

export type VehicleFormCatalogBrandRow = {
  id: string;
  name: string;
  sortOrder: number;
  models: VehicleFormCatalogModelRow[];
};

export type VehicleFormCatalogVehicleStatusRow = {
  id: string;
  code: string;
  labelTr: string;
  sortOrder: number;
};

export type VehicleFormCatalog = {
  brands: VehicleFormCatalogBrandRow[];
  fuelTypes: VehicleCatalogRow[];
  transmissionTypes: VehicleCatalogRow[];
  bodyStyles: VehicleCatalogRow[];
  vehicleStatuses: VehicleFormCatalogVehicleStatusRow[];
  countries: CountryRow[];
  pickupHandoverLocations: HandoverLocationApiRow[];
  returnHandoverLocations: HandoverLocationApiRow[];
  optionTemplates: VehicleOptionTemplateApiRow[];
};

export type CreateVehicleOptionTemplatePayload = {
  title: string;
  description?: string;
  price: number;
  icon?: string;
  lineOrder: number;
  active?: boolean;
};

export type UpdateVehicleOptionTemplatePayload = {
  title?: string;
  description?: string;
  price?: number;
  icon?: string;
  lineOrder?: number;
  active?: boolean;
};

/** Kiralama (rezervasyon) ek hizmet şablonları — rent ekranında listelenir. */
export type ReservationExtraOptionTemplateApiRow = {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  price: number;
  icon?: string | null;
  lineOrder: number;
  active: boolean;
  requiresCoDriverDetails: boolean;
};

export type CreateReservationExtraOptionTemplatePayload = {
  code: string;
  title: string;
  description?: string;
  price: number;
  icon?: string;
  lineOrder: number;
  active?: boolean;
  requiresCoDriverDetails?: boolean;
};

export type UpdateReservationExtraOptionTemplatePayload = {
  code?: string;
  title?: string;
  description?: string;
  price?: number;
  icon?: string;
  lineOrder?: number;
  active?: boolean;
  requiresCoDriverDetails?: boolean;
};

export type CreateCountryPayload = {
  code: string;
  name: string;
  colorCode: string;
};

export type CreateRentalPayload = {
  vehicleId: string;
  startDate: string;
  endDate: string;
  customer: {
    fullName: string;
    nationalId: string;
    passportNo?: string;
    phone: string;
    email?: string;
    birthDate?: string;
    driverLicenseNo?: string;
    driverLicenseImageDataUrl?: string;
    passportImageDataUrl?: string;
  };
  commissionAmount: number;
  commissionFlow: "collect" | "pay";
  commissionCompany?: string;
  additionalDrivers?: {
    fullName: string;
    birthDate: string;
    driverLicenseNo?: string;
    passportNo?: string;
    driverLicenseImageDataUrl: string;
    passportImageDataUrl: string;
  }[];
  status?: string;
};

export type FetchRentalsParams = {
  vehicleId?: string;
  status?: "active" | "pending" | "completed" | "cancelled";
  startDate?: string;
  endDate?: string;
};

export type RentalDashboardSummary = {
  rentalCount: number;
  rentalDayBooked: number;
  totalRevenueEur: number;
  totalBaseRentalEur: number;
  totalOptionsEur: number;
  totalCommissionEur: number;
  activeOrPendingCount: number;
  completedCount: number;
};

export type RentalDashboardVehicleRow = {
  vehicleId: string;
  plate: string;
  brand: string;
  model: string;
  rentalCount: number;
  rentalDayBooked: number;
  revenueEur: number;
  baseRentalEur: number;
  optionsEur: number;
};

export type RentalDashboardTimelineRow = {
  period: string;
  label: string;
  rentalStarts: number;
  revenueEur: number;
};

export type RentalDashboardReport = {
  fromInclusive: string;
  toInclusive: string;
  timelineGranularity: "day" | "month";
  summary: RentalDashboardSummary;
  byVehicle: RentalDashboardVehicleRow[];
  timeline: RentalDashboardTimelineRow[];
};

export type FetchRentalDashboardParams = {
  from?: string;
  to?: string;
  vehicleId?: string;
};

export type UpdateRentalPayload = {
  startDate?: string;
  endDate?: string;
  commissionAmount?: number;
  commissionFlow?: "collect" | "pay";
  commissionCompany?: string;
  status?: "active" | "pending" | "completed" | "cancelled";
  customer?: {
    fullName?: string;
    nationalId?: string;
    passportNo?: string;
    phone?: string;
    email?: string;
    birthDate?: string;
    driverLicenseNo?: string;
    passportImageDataUrl?: string;
    driverLicenseImageDataUrl?: string;
  };
};

export type RentalRequestStatus = "pending" | "approved" | "rejected";

export type RentalRequestFormPayload = {
  vehicleId?: string;
  startDate: string;
  endDate: string;
  outsideCountryTravel: boolean;
  note?: string;
  customer: {
    fullName: string;
    phone: string;
    email: string;
    birthDate: string;
    nationalId?: string;
    passportNo?: string;
    driverLicenseNo?: string;
    passportImageDataUrl: string;
    driverLicenseImageDataUrl: string;
  };
  additionalDrivers?: {
    fullName: string;
    birthDate: string;
    driverLicenseNo?: string;
    passportNo?: string;
    passportImageDataUrl: string;
    driverLicenseImageDataUrl: string;
  }[];
};

export type RentalRequestDto = {
  id: string;
  referenceNo: string;
  createdAt?: string;
  status: RentalRequestStatus;
  statusMessage?: string;
  vehicleId?: string;
  startDate: string;
  endDate: string;
  outsideCountryTravel: boolean;
  greenInsuranceFee: number;
  note?: string;
  contractPdfPath?: string;
  /** Sunucu: onaylı ve henüz PDF yoksa true — “Sözleşme oluştur” gösterimi için. */
  contractGenerationAvailable?: boolean;
  whatsappContractSentAt?: string;
  whatsappContractError?: string;
  customer: {
    fullName: string;
    phone: string;
    email: string;
    birthDate: string;
    nationalId?: string;
    passportNo: string;
    driverLicenseNo: string;
    passportImageDataUrl?: string;
    driverLicenseImageDataUrl?: string;
  };
  additionalDrivers?: {
    id?: string;
    fullName: string;
    birthDate: string;
    driverLicenseNo: string;
    passportNo: string;
    passportImageDataUrl?: string;
    driverLicenseImageDataUrl?: string;
  }[];
};

export function getRentApiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { detail?: string; title?: string; message?: string } | undefined;
    if (data?.message && typeof data.message === "string" && data.message.trim()) return data.message.trim();
    if (data?.detail && typeof data.detail === "string") return data.detail;
    if (err.response?.status === 409) return "İstek sunucu tarafından reddedildi (çakışma).";
    if (err.response?.status === 400) return data?.detail ?? "Geçersiz istek.";
    if (err.code === "ERR_NETWORK")
      return "API’ye bağlanılamadı (ağ veya sunucu). DNS/TLS, API’nin ayakta olması ve (doğrudan çağrıda) CORS’u kontrol edin.";
  }
  if (err instanceof Error) return err.message;
  return "Bilinmeyen hata";
}

function mapVehicleImages(raw: unknown): Vehicle["images"] {
  if (raw == null || typeof raw !== "object") return undefined;
  const out: Partial<Record<VehicleImageSlot, string>> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (SLOT_KEYS.has(k) && typeof v === "string" && v.length > 0) {
      out[k as VehicleImageSlot] = v;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function asOptionalString(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

function asOptionalNumber(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function mapHandoverRef(raw: unknown): VehicleHandoverRef | undefined {
  if (raw == null || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const id = asOptionalString(o.id);
  if (!id) return undefined;
  return {
    id,
    name: asOptionalString(o.name),
    kind: asOptionalString(o.kind),
  };
}

function mapVehicleReturnHandoverLocations(raw: Record<string, unknown>): VehicleHandoverRef[] {
  const list = raw.returnHandoverLocations;
  if (Array.isArray(list) && list.length > 0) {
    const out: VehicleHandoverRef[] = [];
    for (const item of list) {
      const m = mapHandoverRef(item);
      if (m) out.push(m);
    }
    if (out.length > 0) return out;
  }
  const single = mapHandoverRef(raw.defaultReturnHandoverLocation);
  return single ? [single] : [];
}

function mapVehicleOptionDefinitions(raw: unknown): VehicleOptionDefRow[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: VehicleOptionDefRow[] = [];
  for (const row of raw) {
    if (row == null || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const id = asOptionalString(o.id);
    const title = asOptionalString(o.title);
    if (!id || !title) continue;
    const priceRaw = asOptionalNumber(o.price);
    const price = priceRaw != null && Number.isFinite(priceRaw) ? priceRaw : 0;
    const lo = asOptionalNumber(o.lineOrder);
    out.push({
      id,
      title,
      description: asOptionalString(o.description),
      price,
      icon: asOptionalString(o.icon),
      lineOrder: lo != null && Number.isFinite(lo) ? Math.round(lo) : 0,
      active: o.active == null ? true : Boolean(o.active),
    });
  }
  return out.length ? out : undefined;
}

function mapVehicleHighlights(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out = raw.map((x) => String(x).trim()).filter((s) => s.length > 0);
  return out.length > 0 ? out.slice(0, 30) : undefined;
}

export function mapVehicleFromApi(raw: Record<string, unknown>): Vehicle {
  const cc = raw.countryCode;
  const returnLocations = mapVehicleReturnHandoverLocations(raw);
  return {
    id: String(raw.id),
    plate: String(raw.plate),
    brand: String(raw.brand),
    model: String(raw.model),
    year: Number(raw.year),
    maintenance: Boolean(raw.maintenance),
    external: Boolean(raw.external),
    externalCompany: asOptionalString(raw.externalCompany),
    rentalDailyPrice: asOptionalNumber(raw.rentalDailyPrice),
    commissionEnabled: Boolean(raw.commissionEnabled),
    commissionRatePercent: asOptionalNumber(raw.commissionRatePercent),
    commissionBrokerFullName: asOptionalString(raw.commissionBrokerFullName),
    commissionBrokerPhone: asOptionalString(raw.commissionBrokerPhone),
    countryCode: cc != null && String(cc).length > 0 ? String(cc).toUpperCase() : undefined,
    cityId: asOptionalString(raw.cityId),
    defaultPickupHandoverLocation: mapHandoverRef(raw.defaultPickupHandoverLocation) ?? null,
    defaultReturnHandoverLocation: returnLocations[0] ?? mapHandoverRef(raw.defaultReturnHandoverLocation) ?? null,
    returnHandoverLocations: returnLocations.length > 0 ? returnLocations : undefined,
    optionDefinitions: mapVehicleOptionDefinitions(raw.optionDefinitions),
    highlights: mapVehicleHighlights(raw.highlights),
    images: mapVehicleImages(raw.images),
    engine: asOptionalString(raw.engine),
    fuelType: asOptionalString(raw.fuelType),
    bodyColor: asOptionalString(raw.bodyColor),
    seats: asOptionalNumber(raw.seats),
    luggage: asOptionalNumber(raw.luggage),
    transmissionType: asOptionalString(raw.transmissionType),
    bodyStyleCode: asOptionalString(raw.bodyStyleCode),
    bodyStyleLabel: asOptionalString(raw.bodyStyleLabel),
  };
}

export async function fetchVehicleCatalogFromRentApi(kind: VehicleCatalogKind): Promise<VehicleCatalogRow[]> {
  const { data } = await rentClient().get<unknown[]>(VEHICLE_CATALOG_API[kind]);
  if (!Array.isArray(data)) return [];
  return data.map((row) => mapVehicleCatalogRow(row as Record<string, unknown>));
}

export async function fetchVehicleBodyStylesFromRentApi(): Promise<VehicleBodyStyleRow[]> {
  return fetchVehicleCatalogFromRentApi("bodyStyle");
}

export async function fetchVehicleFuelTypesFromRentApi(): Promise<VehicleCatalogRow[]> {
  return fetchVehicleCatalogFromRentApi("fuelType");
}

export async function fetchVehicleTransmissionTypesFromRentApi(): Promise<VehicleCatalogRow[]> {
  return fetchVehicleCatalogFromRentApi("transmissionType");
}

export async function createVehicleCatalogEntryOnRentApi(
  kind: VehicleCatalogKind,
  payload: VehicleCatalogCreatePayload,
): Promise<VehicleCatalogRow> {
  const body: Record<string, unknown> = { labelTr: payload.labelTr, sortOrder: payload.sortOrder };
  const trimmedCode = payload.code?.trim();
  if (trimmedCode) {
    body.code = trimmedCode;
  }
  const { data } = await rentClient().post<unknown>(VEHICLE_CATALOG_API[kind], body);
  return mapVehicleCatalogRow(data as Record<string, unknown>);
}

export async function updateVehicleCatalogEntryOnRentApi(
  kind: VehicleCatalogKind,
  code: string,
  payload: VehicleCatalogUpdatePayload,
): Promise<VehicleCatalogRow> {
  const path = `${VEHICLE_CATALOG_API[kind]}/${encodeURIComponent(code)}`;
  const { data } = await rentClient().put<unknown>(path, payload);
  return mapVehicleCatalogRow(data as Record<string, unknown>);
}

export async function deleteVehicleCatalogEntryOnRentApi(kind: VehicleCatalogKind, id: string): Promise<void> {
  const path = `${VEHICLE_CATALOG_API[kind]}/by-id/${encodeURIComponent(id)}`;
  await rentClient().delete(path);
}

const VEHICLE_STATUSES_API = "/vehicle-statuses";

export async function fetchVehicleStatusesFromRentApi(): Promise<VehicleCatalogRow[]> {
  const { data } = await rentClient().get<unknown[]>(VEHICLE_STATUSES_API);
  if (!Array.isArray(data)) return [];
  return data.map((row) => mapVehicleCatalogRow(row as Record<string, unknown>));
}

export async function fetchVehicleStatusByCodeFromRentApi(code: string): Promise<VehicleCatalogRow> {
  const { data } = await rentClient().get<unknown>(`${VEHICLE_STATUSES_API}/${encodeURIComponent(code)}`);
  return mapVehicleCatalogRow(data as Record<string, unknown>);
}

export async function createVehicleStatusOnRentApi(payload: VehicleCatalogCreatePayload): Promise<VehicleCatalogRow> {
  const body: Record<string, unknown> = { labelTr: payload.labelTr, sortOrder: payload.sortOrder };
  const trimmedCode = payload.code?.trim();
  if (trimmedCode) body.code = trimmedCode;
  const { data } = await rentClient().post<unknown>(VEHICLE_STATUSES_API, body);
  return mapVehicleCatalogRow(data as Record<string, unknown>);
}

export async function updateVehicleStatusOnRentApi(code: string, payload: VehicleCatalogUpdatePayload): Promise<VehicleCatalogRow> {
  const { data } = await rentClient().put<unknown>(`${VEHICLE_STATUSES_API}/${encodeURIComponent(code)}`, payload);
  return mapVehicleCatalogRow(data as Record<string, unknown>);
}

export async function deleteVehicleStatusOnRentApi(id: string): Promise<void> {
  await rentClient().delete(`${VEHICLE_STATUSES_API}/by-id/${encodeURIComponent(id)}`);
}

export function mapCountryFromApi(raw: Record<string, unknown>): CountryRow {
  return {
    id: String(raw.id),
    code: String(raw.code ?? "").toUpperCase(),
    name: String(raw.name ?? ""),
    colorCode: String(raw.colorCode ?? "#808080"),
  };
}

function mapRentalPhoto(p: Record<string, unknown>) {
  return {
    id: String(p.id),
    url: String(p.url),
    caption: p.caption != null ? String(p.caption) : undefined,
  };
}

function mapAdditionalDriver(raw: Record<string, unknown>): AdditionalDriverInfo {
  return {
    id: asOptionalString(raw.id),
    fullName: String(raw.fullName ?? ""),
    birthDate: String(raw.birthDate ?? "").slice(0, 10),
    driverLicenseNo: String(raw.driverLicenseNo ?? ""),
    passportNo: String(raw.passportNo ?? ""),
    driverLicenseImageDataUrl: asOptionalString(raw.driverLicenseImageDataUrl),
    passportImageDataUrl: asOptionalString(raw.passportImageDataUrl),
  };
}

export function mapRentalFromApi(raw: Record<string, unknown>): RentalSession {
  const customer = raw.customer as Record<string, unknown> | null | undefined;
  const feedbackRaw = raw.feedback as Record<string, unknown> | null | undefined;
  const photos = Array.isArray(raw.photos) ? raw.photos.map((p) => mapRentalPhoto(p as Record<string, unknown>)) : [];
  const additionalDriversRaw = raw.additionalDrivers as unknown[] | undefined;
  const additionalDrivers = Array.isArray(additionalDriversRaw)
    ? additionalDriversRaw.map((d) => mapAdditionalDriver(d as Record<string, unknown>))
    : undefined;
  const accidentReportsRaw = raw.accidentReports as unknown[] | undefined;
  const accidentReports =
    Array.isArray(accidentReportsRaw) && accidentReportsRaw.length > 0
      ? accidentReportsRaw.map((ar) => {
          const o = ar as Record<string, unknown>;
          const ap = Array.isArray(o.photos) ? o.photos.map((p) => mapRentalPhoto(p as Record<string, unknown>)) : [];
          return {
            id: String(o.id),
            at: typeof o.at === "string" ? o.at : String(o.at ?? ""),
            description: String(o.description ?? ""),
            photos: ap.length ? ap : undefined,
          };
        })
      : undefined;

  const startDate = String(raw.startDate).slice(0, 10);
  const endDate = String(raw.endDate).slice(0, 10);
  const createdAt =
    raw.createdAt != null
      ? typeof raw.createdAt === "string"
        ? raw.createdAt
        : String(raw.createdAt)
      : undefined;

  const session: RentalSession = {
    id: String(raw.id),
    vehicleId: String(raw.vehicleId),
    startDate,
    endDate,
    createdAt,
    status: normalizeRentalStatus(raw.status),
    commissionAmount: asOptionalNumber(raw.commissionAmount),
    commissionFlow:
      raw.commissionFlow === "collect" || raw.commissionFlow === "pay" ? (raw.commissionFlow as "collect" | "pay") : undefined,
    commissionCompany: asOptionalString(raw.commissionCompany),
    customer: {
      fullName: String(customer?.fullName ?? ""),
      nationalId: String(customer?.nationalId ?? ""),
      passportNo: String(customer?.passportNo ?? ""),
      phone: String(customer?.phone ?? ""),
      email: asOptionalString(customer?.email),
      birthDate: asOptionalString(customer?.birthDate)?.slice(0, 10),
      driverLicenseNo: asOptionalString(customer?.driverLicenseNo),
      driverLicenseImageDataUrl: asOptionalString(customer?.driverLicenseImageDataUrl),
      passportImageDataUrl: asOptionalString(customer?.passportImageDataUrl),
    },
    additionalDrivers: additionalDrivers?.length ? additionalDrivers : undefined,
    photos,
    accidentReports: accidentReports?.length ? accidentReports : undefined,
  };

  if (feedbackRaw && feedbackRaw.at != null && feedbackRaw.text != null) {
    session.feedback = {
      at: typeof feedbackRaw.at === "string" ? feedbackRaw.at : String(feedbackRaw.at),
      text: String(feedbackRaw.text),
    };
  }

  return session;
}

const PAYMENT_STATUS = new Set<PaymentLogStatus>(["completed", "pending", "failed", "refunded"]);

function mapPaymentStatus(raw: unknown): PaymentLogStatus {
  if (typeof raw === "string" && PAYMENT_STATUS.has(raw as PaymentLogStatus)) return raw as PaymentLogStatus;
  return "pending";
}

export function mapPaymentFromApi(raw: Record<string, unknown>): PaymentLog {
  const amount = raw.amountTry;
  const amountTry = typeof amount === "number" ? amount : Number(amount);
  return {
    id: String(raw.id),
    createdAt:
      raw.createdAt != null
        ? typeof raw.createdAt === "string"
          ? raw.createdAt
          : String(raw.createdAt)
        : new Date().toISOString(),
    amountTry: Number.isFinite(amountTry) ? amountTry : 0,
    status: mapPaymentStatus(raw.status),
    method: String(raw.method ?? ""),
    plate: String(raw.plate ?? ""),
    vehicleId: raw.vehicleId != null ? String(raw.vehicleId) : "",
    customerName: String(raw.customerName ?? ""),
    reference: String(raw.reference ?? ""),
    note: raw.note != null ? String(raw.note) : undefined,
  };
}

const PANEL_ROLES = new Set<PanelUserRole>(["admin", "operator", "viewer"]);

function mapPanelRole(raw: unknown): PanelUserRole {
  if (typeof raw === "string" && PANEL_ROLES.has(raw as PanelUserRole)) return raw as PanelUserRole;
  return "viewer";
}

export function mapPanelUserFromApi(raw: Record<string, unknown>): PanelUser {
  return {
    id: String(raw.id),
    fullName: String(raw.fullName ?? ""),
    email: String(raw.email ?? ""),
    role: mapPanelRole(raw.role),
    lastActiveAt:
      raw.lastActiveAt != null
        ? typeof raw.lastActiveAt === "string"
          ? raw.lastActiveAt
          : String(raw.lastActiveAt)
        : new Date().toISOString(),
    active: Boolean(raw.active),
  };
}

export async function fetchVehiclesFromRentApi(): Promise<Vehicle[]> {
  const { data } = await rentClient().get<unknown[]>("/vehicles");
  if (!Array.isArray(data)) return [];
  return data.map((row) => mapVehicleFromApi(row as Record<string, unknown>));
}

export type VehicleOccupancySourceDto = "rental" | "rental_request";

export type VehicleOccupancyRangeApi = {
  id: string;
  source: VehicleOccupancySourceDto;
  startDate: string;
  endDate: string;
};

export type VehicleCalendarOccupancyApi = {
  from: string;
  to: string;
  ranges: VehicleOccupancyRangeApi[];
};

function mapVehicleOccupancyRangeFromApi(raw: Record<string, unknown>): VehicleOccupancyRangeApi | null {
  const startDate = String(raw.startDate ?? "");
  const endDate = String(raw.endDate ?? "");
  if (!startDate || !endDate) return null;
  const src = String(raw.source ?? "rental");
  const source: VehicleOccupancySourceDto = src === "rental_request" ? "rental_request" : "rental";
  return {
    id: String(raw.id ?? ""),
    source,
    startDate,
    endDate,
  };
}

/** Araç takvimi: iptal olmayan kiralamalar + pending/onaylı talepler (backend birleşik aralık). */
export async function fetchVehicleCalendarOccupancyFromRentApi(
  vehicleId: string,
  from: string,
  to: string,
): Promise<VehicleCalendarOccupancyApi> {
  const { data } = await rentClient().get<unknown>(
    `/vehicles/${encodeURIComponent(vehicleId)}/calendar/occupancy`,
    { params: { from, to } },
  );
  const o = (data ?? {}) as Record<string, unknown>;
  const rangesRaw = o.ranges;
  const ranges = Array.isArray(rangesRaw)
    ? rangesRaw
        .map((r) => mapVehicleOccupancyRangeFromApi(r as Record<string, unknown>))
        .filter((x): x is VehicleOccupancyRangeApi => x != null)
    : [];
  return {
    from: String(o.from ?? from),
    to: String(o.to ?? to),
    ranges,
  };
}

export async function fetchRentalsFromRentApi(params?: FetchRentalsParams): Promise<RentalSession[]> {
  const query: Record<string, string> = {};
  if (params?.vehicleId) query.vehicleId = params.vehicleId;
  if (params?.status) query.status = params.status;
  if (params?.startDate) query.startDate = params.startDate;
  if (params?.endDate) query.endDate = params.endDate;
  const { data } = await rentClient().get<unknown[]>("/rentals", { params: query });
  if (!Array.isArray(data)) return [];
  return data.map((row) => mapRentalFromApi(row as Record<string, unknown>));
}

export async function fetchRentalDashboardReport(
  params?: FetchRentalDashboardParams,
): Promise<RentalDashboardReport> {
  const q: Record<string, string> = {};
  if (params?.from) q.from = params.from;
  if (params?.to) q.to = params.to;
  if (params?.vehicleId) q.vehicleId = params.vehicleId;
  const { data } = await rentClient().get<RentalDashboardReport>("/reports/rentals/dashboard", { params: q });
  return data;
}

export async function fetchRentalByIdFromRentApi(id: string): Promise<RentalSession> {
  const { data } = await rentClient().get<unknown>(`/rentals/${id}`);
  return mapRentalFromApi(data as Record<string, unknown>);
}

export async function fetchPaymentsFromRentApi(): Promise<PaymentLog[]> {
  const { data } = await rentClient().get<unknown[]>("/payments");
  if (!Array.isArray(data)) return [];
  return data.map((row) => mapPaymentFromApi(row as Record<string, unknown>));
}

export async function fetchPanelUsersFromRentApi(): Promise<PanelUser[]> {
  const { data } = await rentClient().get<unknown[]>("/panel-users");
  if (!Array.isArray(data)) return [];
  return data.map((row) => mapPanelUserFromApi(row as Record<string, unknown>));
}

export async function deletePanelUserOnRentApi(id: string): Promise<void> {
  await rentClient().delete(`/panel-users/${encodeURIComponent(id)}`);
}

export async function fetchCountriesFromRentApi(): Promise<CountryRow[]> {
  const { data } = await rentClient().get<unknown[]>("/countries");
  if (!Array.isArray(data)) return [];
  return data.map((row) => mapCountryFromApi(row as Record<string, unknown>));
}

export async function fetchCitiesFromRentApi(countryId?: string): Promise<CityRow[]> {
  const q = countryId ? `?countryId=${encodeURIComponent(countryId)}` : "";
  const { data } = await rentClient().get<unknown[]>(`/cities${q}`);
  if (!Array.isArray(data)) return [];
  return data.map((row) => {
    const o = row as Record<string, unknown>;
    return {
      id: String(o.id ?? ""),
      name: String(o.name ?? ""),
      countryId: String(o.countryId ?? ""),
      countryCode: String(o.countryCode ?? "").toUpperCase(),
      countryName: String(o.countryName ?? ""),
    };
  });
}

export type CreateCityPayload = {
  name: string;
  countryId: string;
};

export async function createCityOnRentApi(payload: CreateCityPayload): Promise<CityRow> {
  const countryId = rentApiLongValue(payload.countryId);
  if (countryId == null) {
    throw new Error("Ülke kimliği geçersiz.");
  }
  const { data } = await rentClient().post<unknown>("/cities", {
    name: payload.name.trim(),
    countryId,
  });
  const o = data as Record<string, unknown>;
  return {
    id: String(o.id ?? ""),
    name: String(o.name ?? ""),
    countryId: String(o.countryId ?? ""),
    countryCode: String(o.countryCode ?? "").toUpperCase(),
    countryName: String(o.countryName ?? ""),
  };
}

function mapHandoverLocationRow(raw: unknown): HandoverLocationApiRow {
  const o = raw as Record<string, unknown>;
  const cityIdRaw = o.cityId;
  const sur = o.surchargeEur;
  const surchargeEur =
    typeof sur === "number" && Number.isFinite(sur)
      ? sur
      : typeof sur === "string"
        ? Number(sur)
        : 0;
  return {
    id: String(o.id ?? ""),
    kind: String(o.kind ?? ""),
    name: String(o.name ?? ""),
    description: o.description != null ? String(o.description) : undefined,
    cityId: cityIdRaw != null && String(cityIdRaw).length > 0 ? String(cityIdRaw) : undefined,
    cityName: o.cityName != null ? String(o.cityName) : undefined,
    countryCode: o.countryCode != null ? String(o.countryCode) : undefined,
    lineOrder: typeof o.lineOrder === "number" ? o.lineOrder : Number(o.lineOrder) || 0,
    active: o.active == null ? true : Boolean(o.active),
    surchargeEur: Number.isFinite(surchargeEur) ? surchargeEur : 0,
  };
}

function sortVehicleCatalogRowsByOrder(rows: VehicleCatalogRow[]): VehicleCatalogRow[] {
  return [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.labelTr.localeCompare(b.labelTr, "tr"));
}

function mapVehicleOptionTemplateFromApiRow(row: unknown): VehicleOptionTemplateApiRow {
  const o = row as Record<string, unknown>;
  const price = typeof o.price === "number" ? o.price : Number(o.price);
  return {
    id: String(o.id ?? ""),
    title: String(o.title ?? ""),
    description: o.description != null ? String(o.description) : undefined,
    price: Number.isFinite(price) ? price : 0,
    icon: o.icon != null ? String(o.icon) : undefined,
    lineOrder: typeof o.lineOrder === "number" ? o.lineOrder : Number(o.lineOrder) || 0,
    active: o.active == null ? true : Boolean(o.active),
  };
}

function mapVehicleFormCatalog(raw: Record<string, unknown>): VehicleFormCatalog {
  const brandsRaw = Array.isArray(raw.brands) ? raw.brands : [];
  const brands: VehicleFormCatalogBrandRow[] = brandsRaw.map((b) => {
    const o = b as Record<string, unknown>;
    const modelsRaw = Array.isArray(o.models) ? o.models : [];
    const models: VehicleFormCatalogModelRow[] = modelsRaw.map((m) => {
      const r = m as Record<string, unknown>;
      return {
        id: String(r.id ?? ""),
        name: String(r.name ?? ""),
        sortOrder: typeof r.sortOrder === "number" ? r.sortOrder : Number(r.sortOrder) || 0,
      };
    });
    models.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "tr"));
    return {
      id: String(o.id ?? ""),
      name: String(o.name ?? ""),
      sortOrder: typeof o.sortOrder === "number" ? o.sortOrder : Number(o.sortOrder) || 0,
      models,
    };
  });
  brands.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "tr"));

  const fuelTypes = Array.isArray(raw.fuelTypes)
    ? sortVehicleCatalogRowsByOrder(raw.fuelTypes.map((x) => mapVehicleCatalogRow(x as Record<string, unknown>)))
    : [];
  const transmissionTypes = Array.isArray(raw.transmissionTypes)
    ? sortVehicleCatalogRowsByOrder(raw.transmissionTypes.map((x) => mapVehicleCatalogRow(x as Record<string, unknown>)))
    : [];
  const bodyStyles = Array.isArray(raw.bodyStyles)
    ? sortVehicleCatalogRowsByOrder(raw.bodyStyles.map((x) => mapVehicleCatalogRow(x as Record<string, unknown>)))
    : [];

  const vehicleStatuses = Array.isArray(raw.vehicleStatuses)
    ? (raw.vehicleStatuses as Record<string, unknown>[])
        .map((o) => ({
          id: String(o.id ?? ""),
          code: String(o.code ?? ""),
          labelTr: String(o.labelTr ?? ""),
          sortOrder: typeof o.sortOrder === "number" ? o.sortOrder : Number(o.sortOrder) || 0,
        }))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.labelTr.localeCompare(b.labelTr, "tr"))
    : [];

  const countries = Array.isArray(raw.countries)
    ? (raw.countries as Record<string, unknown>[]).map((c) => mapCountryFromApi(c))
    : [];

  const pickupHandoverLocations = Array.isArray(raw.pickupHandoverLocations)
    ? raw.pickupHandoverLocations.map((x) => mapHandoverLocationRow(x)).filter((r) => r.active !== false)
    : [];
  const returnHandoverLocations = Array.isArray(raw.returnHandoverLocations)
    ? raw.returnHandoverLocations.map((x) => mapHandoverLocationRow(x)).filter((r) => r.active !== false)
    : [];

  const optionTemplates = Array.isArray(raw.optionTemplates)
    ? raw.optionTemplates.map((row) => mapVehicleOptionTemplateFromApiRow(row)).filter((t) => t.active)
    : [];

  return {
    brands,
    fuelTypes,
    transmissionTypes,
    bodyStyles,
    vehicleStatuses,
    countries,
    pickupHandoverLocations,
    returnHandoverLocations,
    optionTemplates,
  };
}

export async function fetchVehicleFormCatalogFromRentApi(): Promise<VehicleFormCatalog> {
  const { data } = await rentClient().get<Record<string, unknown>>("/vehicles/form-catalog");
  return mapVehicleFormCatalog(data ?? {});
}

export async function fetchHandoverLocationsFromRentApi(
  kind?: "PICKUP" | "RETURN",
  opts?: { includeInactive?: boolean },
): Promise<HandoverLocationApiRow[]> {
  const q = new URLSearchParams();
  if (kind) q.set("kind", kind);
  if (opts?.includeInactive) q.set("includeInactive", "true");
  const suffix = q.toString();
  const { data } = await rentClient().get<unknown[]>(`/handover-locations${suffix ? `?${suffix}` : ""}`);
  if (!Array.isArray(data)) return [];
  return data.map((row) => mapHandoverLocationRow(row));
}

export async function createHandoverLocationOnRentApi(payload: CreateHandoverLocationPayload): Promise<HandoverLocationApiRow> {
  const { data } = await rentClient().post<unknown>("/handover-locations", {
    kind: payload.kind,
    name: payload.name.trim(),
    description: payload.description?.trim() || undefined,
    cityId: payload.cityId?.trim() || undefined,
    active: payload.active,
    lineOrder: payload.lineOrder,
    surchargeEur: payload.surchargeEur,
  });
  return mapHandoverLocationRow(data);
}

export async function updateHandoverLocationOnRentApi(
  id: string,
  payload: UpdateHandoverLocationPayload,
): Promise<HandoverLocationApiRow> {
  const body: Record<string, unknown> = {};
  if (payload.kind != null) body.kind = payload.kind;
  if (payload.name != null) body.name = payload.name.trim();
  if (payload.description !== undefined) body.description = payload.description.trim() || null;
  if (payload.cityId !== undefined) body.cityId = payload.cityId.trim() || null;
  if (payload.clearCity === true) body.clearCity = true;
  if (payload.active != null) body.active = payload.active;
  if (payload.lineOrder != null) body.lineOrder = payload.lineOrder;
  if (payload.surchargeEur !== undefined) body.surchargeEur = payload.surchargeEur;
  const { data } = await rentClient().patch<unknown>(`/handover-locations/${encodeURIComponent(id)}`, body);
  return mapHandoverLocationRow(data);
}

export async function deleteHandoverLocationOnRentApi(id: string): Promise<void> {
  await rentClient().delete(`/handover-locations/${encodeURIComponent(id)}`);
}

export async function fetchVehicleOptionTemplatesFromRentApi(opts?: {
  includeInactive?: boolean;
}): Promise<VehicleOptionTemplateApiRow[]> {
  const q = opts?.includeInactive ? "?includeInactive=true" : "";
  const { data } = await rentClient().get<unknown[]>(`/vehicle-option-templates${q}`);
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => mapVehicleOptionTemplateFromApiRow(row))
    .filter((t) => opts?.includeInactive === true || t.active);
}

export async function createVehicleOptionTemplateOnRentApi(
  payload: CreateVehicleOptionTemplatePayload,
): Promise<VehicleOptionTemplateApiRow> {
  const { data } = await rentClient().post<unknown>("/vehicle-option-templates", {
    title: payload.title.trim(),
    description: payload.description?.trim() || undefined,
    price: payload.price,
    icon: payload.icon?.trim() || undefined,
    lineOrder: payload.lineOrder,
    active: payload.active,
  });
  const o = data as Record<string, unknown>;
  const price = typeof o.price === "number" ? o.price : Number(o.price);
  return {
    id: String(o.id ?? ""),
    title: String(o.title ?? ""),
    description: o.description != null ? String(o.description) : undefined,
    price: Number.isFinite(price) ? price : 0,
    icon: o.icon != null ? String(o.icon) : undefined,
    lineOrder: typeof o.lineOrder === "number" ? o.lineOrder : 0,
    active: o.active == null ? true : Boolean(o.active),
  };
}

export async function updateVehicleOptionTemplateOnRentApi(
  id: string,
  payload: UpdateVehicleOptionTemplatePayload,
): Promise<VehicleOptionTemplateApiRow> {
  const body: Record<string, unknown> = {};
  if (payload.title != null) body.title = payload.title.trim();
  if (payload.description !== undefined) body.description = payload.description.trim() || null;
  if (payload.price != null) body.price = payload.price;
  if (payload.icon !== undefined) body.icon = payload.icon.trim() || null;
  if (payload.lineOrder != null) body.lineOrder = payload.lineOrder;
  if (payload.active != null) body.active = payload.active;
  const { data } = await rentClient().patch<unknown>(`/vehicle-option-templates/${encodeURIComponent(id)}`, body);
  const o = data as Record<string, unknown>;
  const price = typeof o.price === "number" ? o.price : Number(o.price);
  return {
    id: String(o.id ?? id),
    title: String(o.title ?? ""),
    description: o.description != null ? String(o.description) : undefined,
    price: Number.isFinite(price) ? price : 0,
    icon: o.icon != null ? String(o.icon) : undefined,
    lineOrder: typeof o.lineOrder === "number" ? o.lineOrder : 0,
    active: o.active == null ? true : Boolean(o.active),
  };
}

export async function deleteVehicleOptionTemplateOnRentApi(id: string): Promise<void> {
  await rentClient().delete(`/vehicle-option-templates/${encodeURIComponent(id)}`);
}

function mapReservationExtraOptionTemplateRow(row: Record<string, unknown>): ReservationExtraOptionTemplateApiRow {
  const priceRaw = row.price;
  const price = typeof priceRaw === "number" ? priceRaw : Number(priceRaw);
  return {
    id: String(row.id ?? ""),
    code: String(row.code ?? ""),
    title: String(row.title ?? ""),
    description: row.description != null ? String(row.description) : undefined,
    price: Number.isFinite(price) ? price : 0,
    icon: row.icon != null ? String(row.icon) : undefined,
    lineOrder: typeof row.lineOrder === "number" ? row.lineOrder : Number(row.lineOrder) || 0,
    active: row.active == null ? true : Boolean(row.active),
    requiresCoDriverDetails: Boolean(row.requiresCoDriverDetails),
  };
}

export async function fetchReservationExtraOptionTemplatesFromRentApi(opts?: {
  includeInactive?: boolean;
}): Promise<ReservationExtraOptionTemplateApiRow[]> {
  const q = opts?.includeInactive ? "?includeInactive=true" : "";
  const { data } = await rentClient().get<unknown[]>(`/reservation-extra-options${q}`);
  if (!Array.isArray(data)) return [];
  return data.map((row) => mapReservationExtraOptionTemplateRow(row as Record<string, unknown>));
}

export async function createReservationExtraOptionTemplateOnRentApi(
  payload: CreateReservationExtraOptionTemplatePayload,
): Promise<ReservationExtraOptionTemplateApiRow> {
  const { data } = await rentClient().post<unknown>("/reservation-extra-options", {
    code: payload.code.trim(),
    title: payload.title.trim(),
    description: payload.description?.trim() || undefined,
    price: payload.price,
    icon: payload.icon?.trim() || undefined,
    lineOrder: payload.lineOrder,
    active: payload.active,
    requiresCoDriverDetails: payload.requiresCoDriverDetails,
  });
  return mapReservationExtraOptionTemplateRow(data as Record<string, unknown>);
}

export async function updateReservationExtraOptionTemplateOnRentApi(
  id: string,
  payload: UpdateReservationExtraOptionTemplatePayload,
): Promise<ReservationExtraOptionTemplateApiRow> {
  const body: Record<string, unknown> = {};
  if (payload.code != null) body.code = payload.code.trim();
  if (payload.title != null) body.title = payload.title.trim();
  if (payload.description !== undefined) body.description = payload.description.trim() || null;
  if (payload.price != null) body.price = payload.price;
  if (payload.icon !== undefined) body.icon = payload.icon.trim() || null;
  if (payload.lineOrder != null) body.lineOrder = payload.lineOrder;
  if (payload.active != null) body.active = payload.active;
  if (payload.requiresCoDriverDetails != null) body.requiresCoDriverDetails = payload.requiresCoDriverDetails;
  const { data } = await rentClient().patch<unknown>(`/reservation-extra-options/${encodeURIComponent(id)}`, body);
  return mapReservationExtraOptionTemplateRow(data as Record<string, unknown>);
}

export async function deleteReservationExtraOptionTemplateOnRentApi(id: string): Promise<void> {
  await rentClient().delete(`/reservation-extra-options/${encodeURIComponent(id)}`);
}

export async function patchCountryColorOnRentApi(id: string, colorCode: string): Promise<CountryRow> {
  const { data } = await rentClient().patch<unknown>(`/countries/${id}`, { colorCode });
  return mapCountryFromApi(data as Record<string, unknown>);
}

export async function createCountryOnRentApi(payload: CreateCountryPayload): Promise<CountryRow> {
  const { data } = await rentClient().post<unknown>("/countries", {
    code: payload.code.trim().toUpperCase(),
    name: payload.name.trim(),
    colorCode: payload.colorCode.trim(),
  });
  return mapCountryFromApi(data as Record<string, unknown>);
}

export async function createVehicleOnRentApi(payload: CreateVehiclePayload): Promise<Vehicle> {
  const countryCode = payload.countryCode?.trim().toUpperCase();
  if (!countryCode || countryCode.length > 64) {
    throw new Error("Ülke kodu gerekli (en fazla 64 karakter).");
  }
  const pickupLong = rentApiLongValue(payload.defaultPickupHandoverLocationId);
  if (pickupLong == null) {
    throw new Error("Alış noktası kimliği geçersiz.");
  }
  const body: Record<string, unknown> = {
    plate: payload.plate,
    brand: payload.brand,
    model: payload.model,
    year: payload.year,
    maintenance: payload.maintenance,
    external: Boolean(payload.external),
    externalCompany: payload.externalCompany?.trim() || undefined,
    rentalDailyPrice: payload.rentalDailyPrice,
    countryCode,
    defaultPickupHandoverLocationId: pickupLong,
    ...(payload.returnHandoverLocationIds != null && payload.returnHandoverLocationIds.length > 0
      ? { returnHandoverLocationIds: rentApiLongArray(payload.returnHandoverLocationIds) ?? [] }
      : (() => {
          const dr = rentApiLongValue(payload.defaultReturnHandoverLocationId?.trim());
          return dr != null ? { defaultReturnHandoverLocationId: dr } : {};
        })()),
    commissionRatePercent:
      payload.external && payload.commissionRatePercent != null && Number.isFinite(payload.commissionRatePercent)
        ? payload.commissionRatePercent
        : undefined,
    commissionBrokerPhone: payload.external ? payload.commissionBrokerPhone?.trim() || undefined : undefined,
    images: payload.images && Object.keys(payload.images).length > 0 ? payload.images : undefined,
  };
  if (payload.optionTemplateIds && payload.optionTemplateIds.length > 0) {
    const tids = rentApiLongArray(payload.optionTemplateIds);
    if (tids && tids.length > 0) {
      body.optionTemplateIds = tids;
    }
  }
  if (payload.optionDefinitions && payload.optionDefinitions.length > 0) {
    body.optionDefinitions = payload.optionDefinitions.map((o, i) => ({
      title: o.title.trim(),
      description: o.description?.trim() || undefined,
      price: o.price,
      icon: o.icon?.trim() || undefined,
      lineOrder: o.lineOrder ?? i,
      active: o.active !== false,
    }));
  }
  if (payload.highlights != null && payload.highlights.length > 0) {
    body.highlights = payload.highlights.map((s) => s.trim()).filter((s) => s.length > 0).slice(0, 30);
  }
  const cityLong = rentApiLongValue(payload.cityId?.trim());
  if (cityLong != null) {
    body.cityId = cityLong;
  }
  if (payload.engine?.trim()) body.engine = payload.engine.trim();
  if (payload.fuelType?.trim()) body.fuelType = payload.fuelType.trim();
  if (payload.bodyColor?.trim()) body.bodyColor = payload.bodyColor.trim();
  if (payload.seats != null && Number.isFinite(payload.seats)) body.seats = payload.seats;
  if (payload.luggage != null && Number.isFinite(payload.luggage)) body.luggage = payload.luggage;
  if (payload.transmissionType?.trim()) body.transmissionType = payload.transmissionType.trim();
  if (payload.bodyStyleCode?.trim()) body.bodyStyleCode = payload.bodyStyleCode.trim();
  const { data } = await rentClient().post<unknown>("/vehicles", body);
  return mapVehicleFromApi(data as Record<string, unknown>);
}

export async function updateVehicleOnRentApi(id: string, payload: UpdateVehiclePayload): Promise<Vehicle> {
  const pickupLong = rentApiLongValue(payload.defaultPickupHandoverLocationId);
  const cityLong = rentApiLongValue(payload.cityId?.trim());
  const body: Record<string, unknown> = {
    plate: payload.plate?.trim() || undefined,
    brand: payload.brand?.trim() || undefined,
    model: payload.model?.trim() || undefined,
    year: payload.year,
    maintenance: payload.maintenance,
    external: payload.external,
    externalCompany: payload.externalCompany?.trim() || undefined,
    rentalDailyPrice: payload.rentalDailyPrice,
    commissionRatePercent: payload.commissionRatePercent,
    commissionBrokerPhone: payload.commissionBrokerPhone?.trim() || undefined,
    countryCode: payload.countryCode?.trim()?.toUpperCase() || undefined,
    cityId: cityLong,
    defaultPickupHandoverLocationId: pickupLong,
    images: payload.images && Object.keys(payload.images).length > 0 ? payload.images : undefined,
  };
  if (payload.returnHandoverLocationIds !== undefined) {
    body.returnHandoverLocationIds = rentApiLongArray(payload.returnHandoverLocationIds) ?? [];
  } else {
    const dr = rentApiLongValue(payload.defaultReturnHandoverLocationId?.trim());
    if (dr != null) {
      body.defaultReturnHandoverLocationId = dr;
    }
  }
  if (payload.optionTemplateIds !== undefined) {
    body.optionTemplateIds = rentApiLongArray(payload.optionTemplateIds) ?? [];
  }
  if (payload.optionDefinitions != null) {
    body.optionDefinitions = payload.optionDefinitions.map((o, i) => ({
      title: o.title.trim(),
      description: o.description?.trim() || undefined,
      price: o.price,
      icon: o.icon?.trim() || undefined,
      lineOrder: o.lineOrder ?? i,
      active: o.active !== false,
    }));
  }
  if (payload.highlights !== undefined) {
    body.highlights = payload.highlights.map((s) => s.trim()).filter((s) => s.length > 0).slice(0, 30);
  }
  if (payload.engine !== undefined) body.engine = payload.engine?.trim() || undefined;
  if (payload.fuelType !== undefined) body.fuelType = payload.fuelType?.trim() || undefined;
  if (payload.bodyColor !== undefined) body.bodyColor = payload.bodyColor?.trim() || undefined;
  if (payload.seats !== undefined) body.seats = payload.seats;
  if (payload.luggage !== undefined) body.luggage = payload.luggage;
  if (payload.transmissionType !== undefined) body.transmissionType = payload.transmissionType?.trim() || undefined;
  if (payload.bodyStyleCode !== undefined) body.bodyStyleCode = payload.bodyStyleCode?.trim() || undefined;
  const { data } = await rentClient().patch<unknown>(`/vehicles/${rentVehiclePathId(id)}`, body);
  return mapVehicleFromApi(data as Record<string, unknown>);
}

export async function deleteVehicleOnRentApi(id: string): Promise<void> {
  await rentClient().delete(`/vehicles/${rentVehiclePathId(id)}`);
}

/** Tek slot: data URL veya base64 gövde; sunucu object storage’a yükler. */
export async function replaceVehicleImageSlotOnRentApi(
  vehicleId: string,
  slot: VehicleImageSlot,
  imageDataUrl: string,
): Promise<Vehicle> {
  const { data } = await rentClient().put<unknown>(`/vehicles/${rentVehiclePathId(vehicleId)}/images/${slot}`, {
    image: imageDataUrl,
  });
  return mapVehicleFromApi(data as Record<string, unknown>);
}

export async function deleteVehicleImageSlotOnRentApi(vehicleId: string, slot: VehicleImageSlot): Promise<Vehicle> {
  const { data } = await rentClient().delete<unknown>(`/vehicles/${rentVehiclePathId(vehicleId)}/images/${slot}`);
  return mapVehicleFromApi(data as Record<string, unknown>);
}

export async function createRentalOnRentApi(payload: CreateRentalPayload): Promise<RentalSession> {
  const { data } = await rentClient().post<unknown>("/rentals", {
    vehicleId: payload.vehicleId,
    startDate: payload.startDate,
    endDate: payload.endDate,
    customer: {
      ...payload.customer,
      email: payload.customer.email?.trim() || undefined,
      birthDate: payload.customer.birthDate || undefined,
      passportNo: payload.customer.passportNo?.trim() ?? "",
      driverLicenseNo: payload.customer.driverLicenseNo?.trim() || undefined,
      driverLicenseImageDataUrl: payload.customer.driverLicenseImageDataUrl || undefined,
      passportImageDataUrl: payload.customer.passportImageDataUrl || undefined,
    },
    commissionAmount: payload.commissionAmount,
    commissionFlow: payload.commissionFlow,
    commissionCompany: payload.commissionCompany?.trim() || undefined,
    additionalDrivers: payload.additionalDrivers?.map((d) => ({
      ...d,
      driverLicenseNo: d.driverLicenseNo?.trim() ?? "",
      passportNo: d.passportNo?.trim() ?? "",
    })),
    status: payload.status,
  });
  return mapRentalFromApi(data as Record<string, unknown>);
}

export async function updateRentalOnRentApi(id: string, payload: UpdateRentalPayload): Promise<RentalSession> {
  const { data } = await rentClient().patch<unknown>(`/rentals/${id}`, {
    startDate: payload.startDate,
    endDate: payload.endDate,
    commissionAmount:
      payload.commissionAmount != null && Number.isFinite(payload.commissionAmount)
        ? payload.commissionAmount
        : undefined,
    commissionFlow: payload.commissionFlow,
    commissionCompany: payload.commissionCompany?.trim() || undefined,
    status: payload.status,
    customer: payload.customer
      ? {
          fullName: payload.customer.fullName?.trim() || undefined,
          nationalId: payload.customer.nationalId?.trim() || undefined,
          passportNo: payload.customer.passportNo?.trim() || undefined,
          phone: payload.customer.phone?.trim() || undefined,
          email: payload.customer.email?.trim() || undefined,
          birthDate: payload.customer.birthDate || undefined,
          driverLicenseNo: payload.customer.driverLicenseNo?.trim() || undefined,
          passportImageDataUrl: payload.customer.passportImageDataUrl?.trim() || undefined,
          driverLicenseImageDataUrl: payload.customer.driverLicenseImageDataUrl?.trim() || undefined,
        }
      : undefined,
  });
  return mapRentalFromApi(data as Record<string, unknown>);
}

function mapRentalRequestFromApi(raw: Record<string, unknown>): RentalRequestDto {
  const customerRaw = (raw.customer ?? {}) as Record<string, unknown>;
  const additionalRaw = raw.additionalDrivers as unknown[] | undefined;
  const green = asOptionalNumber(raw.greenInsuranceFee) ?? 0;
  return {
    id: String(raw.id),
    referenceNo: String(raw.referenceNo ?? ""),
    createdAt: asOptionalString(raw.createdAt ?? raw.created_at),
    status:
      raw.status === "approved" || raw.status === "rejected" || raw.status === "pending"
        ? (raw.status as RentalRequestStatus)
        : "pending",
    statusMessage: asOptionalString(raw.statusMessage),
    vehicleId: asOptionalString(raw.vehicleId),
    startDate: String(raw.startDate ?? "").slice(0, 10),
    endDate: String(raw.endDate ?? "").slice(0, 10),
    outsideCountryTravel: Boolean(raw.outsideCountryTravel),
    greenInsuranceFee: green,
    note: asOptionalString(raw.note),
    contractPdfPath: asOptionalString(raw.contractPdfPath),
    contractGenerationAvailable: (() => {
      const v = raw.contractGenerationAvailable;
      if (v === true || String(v) === "true") return true;
      if (v === false || String(v) === "false") return false;
      return undefined;
    })(),
    whatsappContractSentAt: asOptionalString(raw.whatsappContractSentAt),
    whatsappContractError: asOptionalString(raw.whatsappContractError),
    customer: {
      fullName: String(customerRaw.fullName ?? ""),
      phone: String(customerRaw.phone ?? ""),
      email: String(customerRaw.email ?? ""),
      birthDate: String(customerRaw.birthDate ?? "").slice(0, 10),
      nationalId: asOptionalString(customerRaw.nationalId),
      passportNo: String(customerRaw.passportNo ?? ""),
      driverLicenseNo: String(customerRaw.driverLicenseNo ?? ""),
      passportImageDataUrl: asOptionalString(customerRaw.passportImageDataUrl),
      driverLicenseImageDataUrl: asOptionalString(customerRaw.driverLicenseImageDataUrl),
    },
    additionalDrivers:
      Array.isArray(additionalRaw) && additionalRaw.length > 0
        ? additionalRaw.map((d) => {
            const row = d as Record<string, unknown>;
            return {
              id: asOptionalString(row.id),
              fullName: String(row.fullName ?? ""),
              birthDate: String(row.birthDate ?? "").slice(0, 10),
              driverLicenseNo: String(row.driverLicenseNo ?? ""),
              passportNo: String(row.passportNo ?? ""),
              passportImageDataUrl: asOptionalString(row.passportImageDataUrl),
              driverLicenseImageDataUrl: asOptionalString(row.driverLicenseImageDataUrl),
            };
          })
        : undefined,
  };
}

export async function createRentalRequestOnRentApi(payload: RentalRequestFormPayload): Promise<RentalRequestDto> {
  const { data } = await rentClient().post<unknown>("/rental-requests", payload);
  return mapRentalRequestFromApi(data as Record<string, unknown>);
}

export async function queryRentalRequestByReferenceOnRentApi(referenceNo: string): Promise<RentalRequestDto> {
  const ref = referenceNo.trim();
  const { data } = await rentClient().get<unknown>(`/rental-requests/reference/${encodeURIComponent(ref)}`);
  return mapRentalRequestFromApi(data as Record<string, unknown>);
}

export async function fetchRentalRequestsFromRentApi(params?: {
  vehicleId?: string;
}): Promise<RentalRequestDto[]> {
  const q: Record<string, string> = {};
  if (params?.vehicleId) q.vehicleId = params.vehicleId;
  const { data } = await rentClient().get<unknown[]>("/rental-requests", { params: q });
  if (!Array.isArray(data)) return [];
  return data.map((row) => mapRentalRequestFromApi(row as Record<string, unknown>));
}

export async function updateRentalRequestStatusOnRentApi(
  id: string,
  status: RentalRequestStatus,
  statusMessage?: string,
): Promise<RentalRequestDto> {
  const { data } = await rentClient().patch<unknown>(`/rental-requests/${id}/status`, {
    status,
    statusMessage: statusMessage?.trim() || undefined,
  });
  return mapRentalRequestFromApi(data as Record<string, unknown>);
}

/** Onaylı talep için PDF üretir (object storage + isteğe bağlı WhatsApp). */
export async function generateRentalRequestContractOnRentApi(id: string): Promise<RentalRequestDto> {
  const { data } = await rentClient().post<unknown>(`/rental-requests/${id}/contract`, {}, {
    timeout: 120_000,
  });
  return mapRentalRequestFromApi(data as Record<string, unknown>);
}

/** Mevcut sözleşme PDF baytları (yalnızca oluşturulmuş taleplerde). */
export async function fetchRentalRequestContractPdfBlob(id: string): Promise<Blob> {
  const { data } = await rentClient().get<ArrayBuffer>(`/rental-requests/${id}/contract.pdf`, {
    responseType: "arraybuffer",
    timeout: 90_000,
    headers: { Accept: "application/pdf" },
  });
  return new Blob([data], { type: "application/pdf" });
}

/** Müşteri e-postasına Thymeleaf şablonlu sözleşme bildirimi (Rabbit mail kuyruğu). */
export async function sendRentalRequestContractEmailOnRentApi(id: string): Promise<void> {
  await rentClient().post(`/rental-requests/${encodeURIComponent(id)}/send-contract-email`, {});
}

export type CustomerRecordStatePayload = {
  recordKey: string;
  active: boolean;
};

export type CustomerRecordDeletionPayload = {
  deletedRentals: number;
  deletedRentalRequests: number;
};

export async function fetchCustomerRecordStatesFromRentApi(): Promise<CustomerRecordStatePayload[]> {
  const { data } = await rentClient().get<unknown>("/customer-records");
  if (!Array.isArray(data)) return [];
  return data.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      recordKey: String(r.recordKey ?? ""),
      active: Boolean(r.active),
    };
  });
}

export async function patchCustomerRecordActiveOnRentApi(
  recordKey: string,
  active: boolean,
): Promise<CustomerRecordStatePayload> {
  const enc = encodeURIComponent(recordKey);
  const { data } = await rentClient().patch<unknown>(`/customer-records/${enc}`, { active });
  const r = data as Record<string, unknown>;
  return {
    recordKey: String(r.recordKey ?? recordKey),
    active: Boolean(r.active),
  };
}

export async function deleteCustomerRecordOnRentApi(recordKey: string): Promise<CustomerRecordDeletionPayload> {
  const enc = encodeURIComponent(recordKey);
  const { data } = await rentClient().delete<unknown>(`/customer-records/${enc}`);
  const r = data as Record<string, unknown>;
  return {
    deletedRentals: Number(r.deletedRentals ?? 0),
    deletedRentalRequests: Number(r.deletedRentalRequests ?? 0),
  };
}
