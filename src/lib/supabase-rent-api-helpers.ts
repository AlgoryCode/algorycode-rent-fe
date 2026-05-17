import type { VehicleCatalogKind } from "@/lib/rent-api-gateway";

export function catalogKindToDb(kind: VehicleCatalogKind): string {
  const map: Record<VehicleCatalogKind, string> = {
    bodyStyle: "body_style",
    fuelType: "fuel_type",
    transmissionType: "transmission_type",
  };
  return map[kind];
}

export function idStr(v: number | string | null | undefined): string {
  if (v == null) return "";
  return String(v);
}

export function toNumId(id: string): number {
  const n = Number(id);
  if (!Number.isFinite(n)) throw new Error(`Geçersiz id: ${id}`);
  return Math.trunc(n);
}

export function rowToRecord(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const camel = k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    out[camel] = v;
  }
  return out;
}

export function randomReference(prefix: string): string {
  const tail = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${tail}`;
}
