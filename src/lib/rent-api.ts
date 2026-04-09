import axios from "axios";

import { RENT_API_BASE } from "@/lib/config";
import type { AdditionalDriverInfo, RentalSession, Vehicle } from "@/lib/mock-fleet";
import type { PaymentLog, PaymentLogStatus } from "@/lib/mock-payments";
import type { PanelUser, PanelUserRole } from "@/lib/mock-users";
import { normalizeRentalStatus } from "@/lib/rental-status";
import { VEHICLE_IMAGE_SLOTS, type VehicleImageSlot } from "@/lib/vehicle-images";

const SLOT_KEYS = new Set<string>(VEHICLE_IMAGE_SLOTS.map((s) => s.key));

function rentClient() {
  if (!RENT_API_BASE) {
    throw new Error(
      "NEXT_PUBLIC_RENT_API_BASE ayarlı değil. Üretim build’inde .env.production veya hosting ortam değişkeni ile kök API URL’ini verin (örn. https://rent.algorycode.com veya /api/rent).",
    );
  }
  return axios.create({
    baseURL: RENT_API_BASE,
    timeout: 20_000,
    headers: { Accept: "application/json", "Content-Type": "application/json" },
  });
}

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
  /** ISO 3166-1 alpha-2 */
  countryCode?: string;
  images?: Record<string, string>;
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
  images?: Record<string, string>;
};

export type CountryRow = {
  id: string;
  code: string;
  name: string;
  colorCode: string;
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
    passportNo: string;
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
    driverLicenseNo: string;
    passportNo: string;
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
    passportNo: string;
    driverLicenseNo: string;
    passportImageDataUrl: string;
    driverLicenseImageDataUrl: string;
  };
  additionalDrivers?: {
    fullName: string;
    birthDate: string;
    driverLicenseNo: string;
    passportNo: string;
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

export function mapVehicleFromApi(raw: Record<string, unknown>): Vehicle {
  const cc = raw.countryCode;
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
    images: mapVehicleImages(raw.images),
  };
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

export async function fetchCountriesFromRentApi(): Promise<CountryRow[]> {
  const { data } = await rentClient().get<unknown[]>("/countries");
  if (!Array.isArray(data)) return [];
  return data.map((row) => mapCountryFromApi(row as Record<string, unknown>));
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
  const body: Record<string, unknown> = {
    plate: payload.plate,
    brand: payload.brand,
    model: payload.model,
    year: payload.year,
    maintenance: payload.maintenance,
    external: Boolean(payload.external),
    externalCompany: payload.externalCompany?.trim() || undefined,
    rentalDailyPrice: payload.rentalDailyPrice,
    commissionRatePercent:
      payload.external && payload.commissionRatePercent != null && Number.isFinite(payload.commissionRatePercent)
        ? payload.commissionRatePercent
        : undefined,
    commissionBrokerPhone: payload.external ? payload.commissionBrokerPhone?.trim() || undefined : undefined,
    images: payload.images && Object.keys(payload.images).length > 0 ? payload.images : undefined,
  };
  if (payload.countryCode && payload.countryCode.length === 2) {
    body.countryCode = payload.countryCode.toUpperCase();
  }
  const { data } = await rentClient().post<unknown>("/vehicles", body);
  return mapVehicleFromApi(data as Record<string, unknown>);
}

export async function updateVehicleOnRentApi(id: string, payload: UpdateVehiclePayload): Promise<Vehicle> {
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
    images: payload.images && Object.keys(payload.images).length > 0 ? payload.images : undefined,
  };
  const { data } = await rentClient().patch<unknown>(`/vehicles/${id}`, body);
  return mapVehicleFromApi(data as Record<string, unknown>);
}

export async function deleteVehicleOnRentApi(id: string): Promise<void> {
  await rentClient().delete(`/vehicles/${id}`);
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
      driverLicenseNo: payload.customer.driverLicenseNo?.trim() || undefined,
      driverLicenseImageDataUrl: payload.customer.driverLicenseImageDataUrl || undefined,
      passportImageDataUrl: payload.customer.passportImageDataUrl || undefined,
    },
    commissionAmount: payload.commissionAmount,
    commissionFlow: payload.commissionFlow,
    commissionCompany: payload.commissionCompany?.trim() || undefined,
    additionalDrivers: payload.additionalDrivers,
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
    createdAt: asOptionalString(raw.createdAt),
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

export async function fetchRentalRequestsFromRentApi(): Promise<RentalRequestDto[]> {
  const { data } = await rentClient().get<unknown[]>("/rental-requests");
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
