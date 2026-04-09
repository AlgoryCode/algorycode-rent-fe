import type { RentalSession } from "@/lib/mock-fleet";
import type { RentalStatus } from "@/lib/rental-status";
import { sessionCreatedAt } from "@/lib/rental-metadata";

export type RentalLogFilterValues = {
  customerQuery: string;
  /** yyyy-MM-dd; boş = başlangıç yok */
  rangeStart: string;
  /** yyyy-MM-dd; boş = bitiş yok */
  rangeEnd: string;
  /** Sadece global log sayfası — plaka parçası */
  vehicleQuery?: string;
  /** Kiralama statüsü; all = filtre yok */
  status: "all" | RentalStatus;
};

export const emptyRentalLogFilters = (): RentalLogFilterValues => ({
  customerQuery: "",
  rangeStart: "",
  rangeEnd: "",
  vehicleQuery: "",
  status: "all",
});

/** Müşteri metni + isteğe bağlı tarih aralığı + statü filtresi. */
export function filterRentalLogSessions(sessions: RentalSession[], f: RentalLogFilterValues): RentalSession[] {
  let out = sessions;
  const q = f.customerQuery.trim().toLowerCase();
  if (q) {
    out = out.filter(
      (s) =>
        s.customer.fullName.toLowerCase().includes(q) ||
        s.customer.nationalId.toLowerCase().includes(q),
    );
  }
  const rangeStartMs = f.rangeStart ? new Date(`${f.rangeStart}T00:00:00`).getTime() : Number.NaN;
  const rangeEndMs = f.rangeEnd ? new Date(`${f.rangeEnd}T23:59:59`).getTime() : Number.NaN;
  if (Number.isFinite(rangeStartMs) || Number.isFinite(rangeEndMs)) {
    out = out.filter((s) => {
      const rentalStartMs = new Date(`${s.startDate}T00:00:00`).getTime();
      const rentalEndMs = new Date(`${s.endDate}T23:59:59`).getTime();
      const startsBeforeOrAtEnd = !Number.isFinite(rangeEndMs) || rentalStartMs <= rangeEndMs;
      const endsAfterOrAtStart = !Number.isFinite(rangeStartMs) || rentalEndMs >= rangeStartMs;
      return startsBeforeOrAtEnd && endsAfterOrAtStart;
    });
  }
  if (f.status !== "all") {
    out = out.filter((s) => (s.status ?? "active") === f.status);
  }
  return out;
}

export function sortSessionsByLogTimeDesc(sessions: RentalSession[]): RentalSession[] {
  return [...sessions].sort((a, b) => sessionCreatedAt(b).localeCompare(sessionCreatedAt(a)));
}
