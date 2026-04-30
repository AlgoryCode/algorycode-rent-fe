import { differenceInCalendarDays, parseISO } from "date-fns";

import type { RentalSession, Vehicle } from "@/lib/mock-fleet";
import { mergeVehicleImagesWithDemo, type VehicleImageSlot } from "@/lib/vehicle-images";
import type { RentalStatus } from "@/lib/rental-status";

export const CARD_COVER_ORDER: VehicleImageSlot[] = ["front", "left", "right", "rear", "interiorDash", "interiorRear"];

export const PAGE_SIZE = 8;

export function vehicleCardCoverUrl(v: Vehicle): string | undefined {
  const merged = mergeVehicleImagesWithDemo(v.images, v.id);
  for (const key of CARD_COVER_ORDER) {
    const u = merged[key];
    if (typeof u === "string" && u.trim().length > 0) return u;
  }
  return undefined;
}

export function formatVehicleDailyRental(v: Vehicle): string {
  const p = v.rentalDailyPrice;
  if (p == null || !Number.isFinite(p)) return "—";
  return `${p.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₺`;
}

export function vehicleMatchesSearch(v: Vehicle, raw: string): boolean {
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

export function sessionStatus(s: RentalSession): RentalStatus {
  return s.status ?? "active";
}

export function rentalDayCount(startDate: string, endDate: string): number {
  const a = parseISO(startDate);
  const b = parseISO(endDate);
  return Math.max(1, differenceInCalendarDays(b, a) + 1);
}

function sessionOptionsTotal(session: RentalSession): number {
  if (!session.options?.length) return 0;
  return session.options.reduce((s, o) => s + (Number.isFinite(o.price) ? o.price : 0), 0);
}

function sessionGrossTotal(session: RentalSession, vehicle: Vehicle | undefined): number | undefined {
  const daily = vehicle?.rentalDailyPrice;
  if (daily == null || !Number.isFinite(daily)) return undefined;
  const days = rentalDayCount(session.startDate, session.endDate);
  return days * daily + sessionOptionsTotal(session);
}

export function sessionNetTotal(session: RentalSession, vehicle: Vehicle | undefined): number | undefined {
  if (session.netAmount != null) return session.netAmount;
  const gross = sessionGrossTotal(session, vehicle);
  if (gross == null) return undefined;
  const commission = session.commissionAmount ?? 0;
  const commissionSigned = session.commissionFlow === "pay" ? -commission : commission;
  return gross + commissionSigned;
}

export function sessionEstimatedTotal(session: RentalSession, vehicle: Vehicle | undefined): string {
  const total = sessionNetTotal(session, vehicle);
  if (total == null) return "—";
  return `${total.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₺`;
}

export function rentalLogStatusPillClass(st: RentalStatus): string {
  if (st === "active") return "bg-emerald-100 text-emerald-700";
  if (st === "pending") return "bg-sky-100 text-sky-700";
  if (st === "completed") return "bg-slate-100 text-slate-600";
  return "bg-rose-100 text-rose-700";
}
