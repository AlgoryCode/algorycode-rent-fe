import {
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
} from "date-fns";
import type { RentalRequestDto } from "@/lib/rent-api";
import type { RentalSession, Vehicle } from "@/lib/mock-fleet";
import { normalizeRentalStatus, rentalCountsForCalendar } from "@/lib/rental-status";

/** Eski kayıtlarda `feedback` dizi olabilir; tek yoruma indirger. */
function normalizeRentalFeedback(raw: unknown): { at: string; text: string } | undefined {
  if (raw == null) return undefined;
  if (Array.isArray(raw)) {
    const first = raw[0] as { at?: string; text?: string } | undefined;
    if (first?.at != null && first.text != null) return { at: first.at, text: first.text };
    return undefined;
  }
  if (typeof raw === "object" && raw !== null && "at" in raw && "text" in raw) {
    const o = raw as { at: string; text: string };
    return { at: o.at, text: o.text };
  }
  return undefined;
}

export function normalizeRentalSession(s: RentalSession): RentalSession {
  const fb = normalizeRentalFeedback((s as { feedback?: unknown }).feedback);
  const status = normalizeRentalStatus((s as { status?: unknown }).status);
  const next = { ...s, feedback: fb, status } as RentalSession;
  if (fb === undefined) delete (next as { feedback?: unknown }).feedback;
  return next;
}

const STORAGE_KEY = "rent-fe-extra-sessions";
const VEHICLES_STORAGE_KEY = "rent-fe-extra-vehicles";

let extraCacheRaw: string | null = null;
let extraCacheParsed: RentalSession[] = [];

/** useSyncExternalStore için: aynı localStorage içeriğinde stabil dizi referansı. */
export function getExtraSessionsSnapshot(): RentalSession[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY) ?? "[]";
  if (raw === extraCacheRaw) return extraCacheParsed;
  extraCacheRaw = raw;
  try {
    const parsed = JSON.parse(raw) as unknown;
    extraCacheParsed = Array.isArray(parsed) ? (parsed as RentalSession[]).map(normalizeRentalSession) : [];
  } catch {
    extraCacheParsed = [];
  }
  return extraCacheParsed;
}

export function loadExtraSessions(): RentalSession[] {
  return getExtraSessionsSnapshot();
}

export function saveExtraSessions(sessions: RentalSession[]) {
  if (typeof window === "undefined") return;
  const json = JSON.stringify(sessions);
  localStorage.setItem(STORAGE_KEY, json);
  extraCacheRaw = json;
  extraCacheParsed = sessions;
}

export function invalidateExtraSessionsCache() {
  extraCacheRaw = null;
}

let vehiclesCacheRaw: string | null = null;
let vehiclesCacheParsed: Vehicle[] = [];

export function getExtraVehiclesSnapshot(): Vehicle[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(VEHICLES_STORAGE_KEY) ?? "[]";
  if (raw === vehiclesCacheRaw) return vehiclesCacheParsed;
  vehiclesCacheRaw = raw;
  try {
    const parsed = JSON.parse(raw) as unknown;
    vehiclesCacheParsed = Array.isArray(parsed) ? (parsed as Vehicle[]) : [];
  } catch {
    vehiclesCacheParsed = [];
  }
  return vehiclesCacheParsed;
}

export function saveExtraVehicles(vehicles: Vehicle[]) {
  if (typeof window === "undefined") return;
  const json = JSON.stringify(vehicles);
  localStorage.setItem(VEHICLES_STORAGE_KEY, json);
  vehiclesCacheRaw = json;
  vehiclesCacheParsed = vehicles;
}

export function invalidateExtraVehiclesCache() {
  vehiclesCacheRaw = null;
}

export function mergeVehicleLists(seed: Vehicle[], extra: Vehicle[]): Vehicle[] {
  const seen = new Set(seed.map((v) => v.id));
  return [...seed, ...extra.filter((v) => !seen.has(v.id))];
}

export { VEHICLES_STORAGE_KEY };

export function mergeSessions(seed: RentalSession[], extra: RentalSession[]): RentalSession[] {
  return [...seed, ...extra];
}

function sessionDays(s: RentalSession): Date[] {
  const start = startOfDay(parseISO(s.startDate));
  const end = startOfDay(parseISO(s.endDate));
  if (end < start) return [];
  return eachDayOfInterval({ start, end });
}

/** Araç için takvimde “dolu” günler. */
export function bookedDatesForVehicle(sessions: RentalSession[], vehicleId: string): Date[] {
  const set = new Map<number, Date>();
  for (const s of sessions) {
    if (s.vehicleId !== vehicleId || !rentalCountsForCalendar(s)) continue;
    for (const d of sessionDays(s)) {
      set.set(d.getTime(), d);
    }
  }
  return [...set.values()];
}

/** `GET /vehicles/{id}/calendar/occupancy` aralıkları → takvimde dolu günler (uçlar dahil). */
export function bookedDatesFromOccupancyRanges(ranges: { startDate: string; endDate: string }[]): Date[] {
  const set = new Map<number, Date>();
  for (const r of ranges) {
    let start: Date;
    let end: Date;
    try {
      start = startOfDay(parseISO(r.startDate));
      end = startOfDay(parseISO(r.endDate));
    } catch {
      continue;
    }
    if (end < start) continue;
    for (const d of eachDayOfInterval({ start, end })) {
      set.set(d.getTime(), d);
    }
  }
  return [...set.values()];
}

/** Reddedilmemiş talep, takvim / filo rozeti ile aynı mantıkta aracı meşgul sayılır. */
function rentalRequestBlocksFleet(req: RentalRequestDto): boolean {
  return req.status === "pending" || req.status === "approved";
}

export function bookedDatesFromRentalRequests(requests: RentalRequestDto[], vehicleId: string): Date[] {
  const set = new Map<number, Date>();
  for (const req of requests) {
    if ((req.vehicleId ?? "") !== vehicleId) continue;
    if (!rentalRequestBlocksFleet(req)) continue;
    let start: Date;
    let end: Date;
    try {
      start = startOfDay(parseISO(req.startDate));
      end = startOfDay(parseISO(req.endDate));
    } catch {
      continue;
    }
    if (end < start) continue;
    for (const d of eachDayOfInterval({ start, end })) {
      set.set(d.getTime(), d);
    }
  }
  return [...set.values()];
}

export function mergeBookedDateArrays(a: Date[], b: Date[]): Date[] {
  const map = new Map<number, Date>();
  for (const d of a) map.set(startOfDay(d).getTime(), startOfDay(d));
  for (const d of b) map.set(startOfDay(d).getTime(), startOfDay(d));
  return [...map.values()];
}

export function isDateBooked(sessions: RentalSession[], vehicleId: string, day: Date): boolean {
  return sessions.some((s) => {
    if (s.vehicleId !== vehicleId || !rentalCountsForCalendar(s)) return false;
    const start = startOfDay(parseISO(s.startDate));
    const end = startOfDay(parseISO(s.endDate));
    return isWithinInterval(startOfDay(day), { start, end });
  });
}

/**
 * Belirtilen günde araç rezerve mi: kesin kiralamalar + (opsiyonel) kiralama talepleri.
 * Talepler yalnızca {@code pending} ve {@code approved} için dikkate alınır; {@code rejected} hariç.
 */
export function isVehicleBookedOnDay(
  vehicleId: string,
  sessions: RentalSession[],
  requests: readonly RentalRequestDto[] | undefined,
  day: Date,
): boolean {
  const d = startOfDay(day);
  const fromRental = sessions.some((s) => {
    if (s.vehicleId !== vehicleId || !rentalCountsForCalendar(s)) return false;
    const start = startOfDay(parseISO(s.startDate));
    const end = startOfDay(parseISO(s.endDate));
    return isWithinInterval(d, { start, end });
  });
  if (fromRental) return true;
  if (!requests?.length) return false;
  return requests.some((req) => {
    if (!rentalRequestBlocksFleet(req)) return false;
    if ((req.vehicleId ?? "") !== vehicleId) return false;
    let start: Date;
    let end: Date;
    try {
      start = startOfDay(parseISO(req.startDate));
      end = startOfDay(parseISO(req.endDate));
    } catch {
      return false;
    }
    if (end < start) return false;
    return isWithinInterval(d, { start, end });
  });
}

/** Belirtilen günde devam eden kiralamalar (iptal hariç); süre uçlar dahil gün sayısı. */
export function rentalsActiveOnDay(sessions: RentalSession[], day: Date): { session: RentalSession; durationDays: number }[] {
  const d = startOfDay(day).getTime();
  const out: { session: RentalSession; durationDays: number }[] = [];
  for (const s of sessions) {
    if (!rentalCountsForCalendar(s)) continue;
    const start = startOfDay(parseISO(s.startDate)).getTime();
    const end = startOfDay(parseISO(s.endDate)).getTime();
    if (d < start || d > end) continue;
    const durationDays = differenceInCalendarDays(parseISO(s.endDate), parseISO(s.startDate)) + 1;
    out.push({ session: s, durationDays });
  }
  return out.sort((a, b) => a.session.startDate.localeCompare(b.session.startDate));
}

export type FleetStatus = "available" | "rented" | "maintenance";

export function resolveVehicleFleetUiStatus(
  v: Vehicle,
  sessions: RentalSession[],
  on: Date,
  requests?: readonly RentalRequestDto[],
): FleetStatus {
  if (v.maintenance) return "maintenance";
  const code = v.fleetStatusCode;
  if (code === "maintenance") return "maintenance";
  if (code === "available") return "available";
  if (code === "rented") return "rented";
  return vehicleFleetStatus(v, sessions, on, requests);
}

/**
 * Filo listesi / detay rozeti. {@code requests} verilirse onaylı veya bekleyen kiralama talepleri de
 * “kirada” sayılır (yalnızca {@code /rentals} kullanıldığında talep onaylı ama henüz kira oluşmamış
 * araçlar yanlışlıkla “Müsait” görünürdü).
 */
export function vehicleFleetStatus(
  v: Vehicle,
  sessions: RentalSession[],
  on: Date,
  requests?: readonly RentalRequestDto[],
): FleetStatus {
  if (v.maintenance) return "maintenance";
  return isVehicleBookedOnDay(v.id, sessions, requests, on) ? "rented" : "available";
}

export function sessionsForVehicle(sessions: RentalSession[], vehicleId: string): RentalSession[] {
  return sessions.filter((s) => s.vehicleId === vehicleId).sort((a, b) => parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime());
}

export function formatDay(d: Date) {
  return format(d, "yyyy-MM-dd");
}

/** ISO `yyyy-MM-dd` aralıkları çakışıyor mu (uçlar dahil). */
export function dateRangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}
