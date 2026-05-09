import type { CustomerRecordStatePayload, RentCustomerRow } from "@/lib/rent-api";
import type { CustomerInfo, CustomerKind, RentalSession, Vehicle } from "@/lib/mock-fleet";

export type { CustomerKind };

export function resolveCustomerKind(c: CustomerInfo): CustomerKind {
  return c.kind === "corporate" ? "corporate" : "individual";
}

/** Kiralamalar arasında en güncel (tarihe göre) pasaport/ehliyet görsel URL’lerini seçer. */
function mergeCustomerFromRentals(rentals: RentalSession[]): CustomerInfo {
  const sorted = [...rentals].sort((a, b) => sessionCreatedAt(b).localeCompare(sessionCreatedAt(a)));
  const latest = sorted[0].customer;
  let passport: string | undefined;
  let license: string | undefined;
  for (const s of sorted) {
    if (!passport && s.customer.passportImageDataUrl) {
      passport = s.customer.passportImageDataUrl;
    }
    if (!license && s.customer.driverLicenseImageDataUrl) {
      license = s.customer.driverLicenseImageDataUrl;
    }
  }
  return {
    ...latest,
    passportImageDataUrl: passport ?? latest.passportImageDataUrl,
    driverLicenseImageDataUrl: license ?? latest.driverLicenseImageDataUrl,
  };
}

/** Eski kayıtlarda yoksa başlangıç günü varsayılan saat ile kullanılır. */
export function sessionCreatedAt(s: RentalSession): string {
  if (s.createdAt) return s.createdAt;
  return `${s.startDate}T12:00:00.000Z`;
}

export function customerRecordKey(c: CustomerInfo): string {
  const tc = c.nationalId.trim();
  if (tc) return `tc:${tc}`;
  return `ph:${c.phone.trim()}`;
}

export type CustomerAggregateRow = {
  key: string;
  customer: CustomerInfo;
  rentals: RentalSession[];
  totalRentals: number;
  lastActivity: string;
  /** Sunucu müşteri durumu; kayıt yoksa true. */
  recordActive: boolean;
  backendCustomerId?: string;
};

export function mergeCustomerDirectoryStates(
  rows: CustomerAggregateRow[],
  states?: CustomerRecordStatePayload[] | null,
): CustomerAggregateRow[] {
  if (!states?.length) {
    return rows.map((r) => ({ ...r, recordActive: true }));
  }
  const m = new Map(states.map((s) => [s.recordKey, s.active]));
  return rows.map((r) => ({ ...r, recordActive: m.get(r.key) ?? true }));
}

export function aggregateCustomersFromSessions(sessions: RentalSession[]): CustomerAggregateRow[] {
  const map = new Map<string, { customer: CustomerInfo; rentals: RentalSession[] }>();

  for (const s of sessions) {
    const k = customerRecordKey(s.customer);
    const cur = map.get(k);
    if (cur) cur.rentals.push(s);
    else map.set(k, { customer: s.customer, rentals: [s] });
  }

  const rows: CustomerAggregateRow[] = [];

  for (const [key, { rentals }] of map) {
    const sorted = [...rentals].sort((a, b) => sessionCreatedAt(b).localeCompare(sessionCreatedAt(a)));
    const lastActivity = sessionCreatedAt(sorted[0]);
    const customer = mergeCustomerFromRentals(sorted);
    rows.push({
      key,
      customer,
      rentals: sorted,
      totalRentals: sorted.length,
      lastActivity,
      recordActive: true,
    });
  }

  return rows.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
}

export function aggregateRowFromRentCustomer(row: RentCustomerRow): CustomerAggregateRow {
  const customer: CustomerInfo = {
    fullName: row.fullName,
    nationalId: (row.nationalId ?? "").trim(),
    passportNo: (row.passportNo ?? "").trim(),
    phone: row.phone,
    email: row.email,
    birthDate: row.birthDate,
    driverLicenseNo: row.driverLicenseNo,
  };
  const key = customerRecordKey(customer);
  const lastActivity = row.updatedAt ?? row.createdAt ?? new Date().toISOString();
  return {
    key,
    customer,
    rentals: [],
    totalRentals: 0,
    lastActivity,
    recordActive: true,
    backendCustomerId: row.id,
  };
}

export function mergeRentCustomerApiRowsIntoAggregates(
  existing: CustomerAggregateRow[],
  apiRows: RentCustomerRow[],
): CustomerAggregateRow[] {
  const keys = new Set(existing.map((r) => r.key));
  const additions: CustomerAggregateRow[] = [];
  for (const row of apiRows) {
    const agg = aggregateRowFromRentCustomer(row);
    if (keys.has(agg.key)) continue;
    keys.add(agg.key);
    additions.push(agg);
  }
  return [...additions, ...existing].sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
}

export function vehiclePlate(vehiclesById: Map<string, Vehicle>, vehicleId: string): string {
  return vehiclesById.get(vehicleId)?.plate ?? vehicleId;
}
