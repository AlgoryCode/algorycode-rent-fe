import type { RentalSession } from "@/lib/mock-fleet";

export type RentalStatus = "active" | "pending" | "completed" | "cancelled";

export const RENTAL_STATUS_LABEL: Record<RentalStatus, string> = {
  active: "Aktif",
  pending: "Beklemede",
  completed: "Tamamlandı",
  cancelled: "İptal",
};

const VALID = new Set<RentalStatus>(["active", "pending", "completed", "cancelled"]);

export function normalizeRentalStatus(raw: unknown): RentalStatus {
  if (typeof raw !== "string") return "active";
  const s = raw.trim().toLowerCase() as RentalStatus;
  if (VALID.has(s)) return s;
  return "active";
}

export function rentalCountsForCalendar(s: RentalSession): boolean {
  const st = s.status ?? "active";
  if (st === "cancelled" || st === "completed") return false;
  return true;
}
