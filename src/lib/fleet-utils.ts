import { eachDayOfInterval, format, isWithinInterval, parseISO, startOfDay } from "date-fns";
import type { RentalSession, Vehicle } from "@/lib/mock-fleet";

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
  const next = { ...s, feedback: fb } as RentalSession;
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
    if (s.vehicleId !== vehicleId) continue;
    for (const d of sessionDays(s)) {
      set.set(d.getTime(), d);
    }
  }
  return [...set.values()];
}

export function isDateBooked(sessions: RentalSession[], vehicleId: string, day: Date): boolean {
  return sessions.some((s) => {
    if (s.vehicleId !== vehicleId) return false;
    const start = startOfDay(parseISO(s.startDate));
    const end = startOfDay(parseISO(s.endDate));
    return isWithinInterval(startOfDay(day), { start, end });
  });
}

export type FleetStatus = "available" | "rented" | "maintenance";

export function vehicleFleetStatus(v: Vehicle, sessions: RentalSession[], on: Date): FleetStatus {
  if (v.maintenance) return "maintenance";
  const day = startOfDay(on);
  const active = sessions.some(
    (s) =>
      s.vehicleId === v.id &&
      isWithinInterval(day, { start: startOfDay(parseISO(s.startDate)), end: startOfDay(parseISO(s.endDate)) }),
  );
  return active ? "rented" : "available";
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
