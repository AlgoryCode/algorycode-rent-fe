import axios from "axios";

import { RENT_API_BASE } from "@/lib/config";
import type { RentalSession, Vehicle } from "@/lib/mock-fleet";
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
  /** ISO 3166-1 alpha-2 */
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
  };
  status?: string;
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

export function mapVehicleFromApi(raw: Record<string, unknown>): Vehicle {
  const cc = raw.countryCode;
  return {
    id: String(raw.id),
    plate: String(raw.plate),
    brand: String(raw.brand),
    model: String(raw.model),
    year: Number(raw.year),
    maintenance: Boolean(raw.maintenance),
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

export function mapRentalFromApi(raw: Record<string, unknown>): RentalSession {
  const customer = raw.customer as Record<string, unknown> | null | undefined;
  const feedbackRaw = raw.feedback as Record<string, unknown> | null | undefined;
  const photos = Array.isArray(raw.photos) ? raw.photos.map((p) => mapRentalPhoto(p as Record<string, unknown>)) : [];
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
    customer: {
      fullName: String(customer?.fullName ?? ""),
      nationalId: String(customer?.nationalId ?? ""),
      passportNo: String(customer?.passportNo ?? ""),
      phone: String(customer?.phone ?? ""),
    },
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

export async function fetchRentalsFromRentApi(): Promise<RentalSession[]> {
  const { data } = await rentClient().get<unknown[]>("/rentals");
  if (!Array.isArray(data)) return [];
  return data.map((row) => mapRentalFromApi(row as Record<string, unknown>));
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
    images: payload.images && Object.keys(payload.images).length > 0 ? payload.images : undefined,
  };
  if (payload.countryCode && payload.countryCode.length === 2) {
    body.countryCode = payload.countryCode.toUpperCase();
  }
  const { data } = await rentClient().post<unknown>("/vehicles", body);
  return mapVehicleFromApi(data as Record<string, unknown>);
}

export async function createRentalOnRentApi(payload: CreateRentalPayload): Promise<RentalSession> {
  const { data } = await rentClient().post<unknown>("/rentals", {
    vehicleId: payload.vehicleId,
    startDate: payload.startDate,
    endDate: payload.endDate,
    customer: payload.customer,
    status: payload.status,
  });
  return mapRentalFromApi(data as Record<string, unknown>);
}
