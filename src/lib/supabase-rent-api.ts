/**
 * Rent domain — Supabase Postgres implementation (FE modelleri ile uyumlu).
 */
import type { Vehicle } from "@/lib/mock-fleet";
import type { PaymentLog } from "@/lib/mock-payments";
import type { PanelUser } from "@/lib/mock-users";
import {
  mapCountryFromApi,
  mapPanelUserFromApi,
  mapPaymentFromApi,
  mapRentalFromApi,
  mapVehicleFromApi,
  type RentCustomerRow,
  type RentCustomerUpsertPayload,
  type ValidateCouponResult,
  type VehicleCatalogKind,
  type CreateCouponPayload,
  type UpdateCouponPayload,
  type DiscountCouponRow,
} from "@/lib/rent-api-gateway";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { catalogKindToDb, idStr, randomReference, rowToRecord, toNumId } from "@/lib/supabase-rent-api-helpers";
import type {
  CityRow,
  CountryRow,
  CreateCityPayload,
  CreateCountryPayload,
  CreateHandoverLocationPayload,
  CreateRentalPayload,
  CreateReservationExtraOptionTemplatePayload,
  CreateVehicleOptionTemplatePayload,
  CreateVehiclePayload,
  CustomerRecordDeletionPayload,
  CustomerRecordStatePayload,
  FetchRentalDashboardParams,
  FetchRentalsParams,
  HandoverLocationApiRow,
  RentalDashboardReport,
  RentalRequestDto,
  RentalRequestFormPayload,
  RentalRequestStatus,
  ReservationExtraOptionTemplateApiRow,
  UpdateHandoverLocationPayload,
  UpdateRentalPayload,
  UpdateReservationExtraOptionTemplatePayload,
  UpdateVehicleOptionTemplatePayload,
  UpdateVehiclePayload,
  VehicleBodyStyleRow,
  VehicleCatalogCreatePayload,
  VehicleCatalogRow,
  VehicleCatalogUpdatePayload,
  VehicleFormCatalog,
  VehicleOptionTemplateApiRow,
} from "@/models";
import type { RentalSession } from "@/lib/mock-fleet";
import type { VehicleImageSlot } from "@/lib/vehicle-images";

function client() {
  return createSupabaseBrowserClient();
}

function mapCatalogRow(row: Record<string, unknown>): VehicleCatalogRow {
  return {
    id: idStr(row.id as number),
    code: String(row.code ?? ""),
    labelTr: String(row.label_tr ?? ""),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function mapHandoverRow(row: Record<string, unknown>): HandoverLocationApiRow {
  const r = rowToRecord(row) as HandoverLocationApiRow;
  return {
    id: idStr(row.id as number),
    kind: (r.kind as HandoverLocationApiRow["kind"]) ?? "pickup",
    name: String(row.name ?? ""),
    description: row.description != null ? String(row.description) : undefined,
    cityId: row.city_id != null ? idStr(row.city_id as number) : undefined,
    cityName: undefined,
    countryCode: undefined,
    lineOrder: Number(row.line_order ?? 0),
    active: Boolean(row.active ?? true),
    surchargeEur: row.surcharge_eur != null ? Number(row.surcharge_eur) : undefined,
  };
}

async function loadVehicleById(id: string): Promise<Vehicle> {
  const supabase = client();
  const vid = toNumId(id);
  const { data: row, error } = await supabase.from("rent_vehicles").select("*").eq("id", vid).single();
  if (error || !row) throw new Error(error?.message ?? "Araç bulunamadı");

  const { data: opts } = await supabase
    .from("rent_vehicle_option_definitions")
    .select("*")
    .eq("vehicle_id", vid)
    .order("line_order");

  const { data: retLocs } = await supabase
    .from("rent_vehicle_return_handover_locations")
    .select("handover_location_id, rent_handover_locations(*)")
    .eq("vehicle_id", vid);

  const returnHandoverLocations = (retLocs ?? [])
    .map((j) => {
      const raw = j as { rent_handover_locations?: Record<string, unknown> | Record<string, unknown>[] };
      const loc = raw.rent_handover_locations;
      const row = Array.isArray(loc) ? loc[0] : loc;
      return row ? mapHandoverRow(row) : null;
    })
    .filter((x): x is HandoverLocationApiRow => x != null);

  let defaultPickup = null;
  if (row.default_pickup_handover_location_id) {
    const { data: loc } = await supabase
      .from("rent_handover_locations")
      .select("*")
      .eq("id", row.default_pickup_handover_location_id)
      .maybeSingle();
    if (loc) defaultPickup = mapHandoverRow(loc);
  }

  return mapVehicleFromApi({
    ...rowToRecord(row as Record<string, unknown>),
    optionDefinitions: (opts ?? []).map((o) => rowToRecord(o as Record<string, unknown>)),
    defaultPickupHandoverLocation: defaultPickup,
    returnHandoverLocations,
  });
}

// --- Catalog ---
export async function fetchVehicleCatalogFromRentApi(kind: VehicleCatalogKind): Promise<VehicleCatalogRow[]> {
  const { data, error } = await client()
    .from("rent_vehicle_catalog")
    .select("*")
    .eq("kind", catalogKindToDb(kind))
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapCatalogRow(r as Record<string, unknown>));
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
  const code = (payload.code?.trim() || payload.labelTr.trim().toUpperCase().replace(/\s+/g, "_")).slice(0, 64);
  const { data, error } = await client()
    .from("rent_vehicle_catalog")
    .insert({
      kind: catalogKindToDb(kind),
      code,
      label_tr: payload.labelTr,
      sort_order: payload.sortOrder,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapCatalogRow(data as Record<string, unknown>);
}

export async function updateVehicleCatalogEntryOnRentApi(
  kind: VehicleCatalogKind,
  code: string,
  payload: VehicleCatalogUpdatePayload,
): Promise<VehicleCatalogRow> {
  const { data, error } = await client()
    .from("rent_vehicle_catalog")
    .update({
      label_tr: payload.labelTr,
      sort_order: payload.sortOrder,
    })
    .eq("kind", catalogKindToDb(kind))
    .eq("code", code)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapCatalogRow(data as Record<string, unknown>);
}

export async function deleteVehicleCatalogEntryOnRentApi(kind: VehicleCatalogKind, id: string): Promise<void> {
  const { error } = await client()
    .from("rent_vehicle_catalog")
    .delete()
    .eq("kind", catalogKindToDb(kind))
    .eq("id", toNumId(id));
  if (error) throw new Error(error.message);
}

export async function fetchVehicleStatusesFromRentApi(): Promise<VehicleCatalogRow[]> {
  const { data, error } = await client()
    .from("rent_vehicle_catalog")
    .select("*")
    .eq("kind", "vehicle_status")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapCatalogRow(r as Record<string, unknown>));
}

export async function fetchVehicleStatusByCodeFromRentApi(code: string): Promise<VehicleCatalogRow> {
  const { data, error } = await client()
    .from("rent_vehicle_catalog")
    .select("*")
    .eq("kind", "vehicle_status")
    .eq("code", code)
    .single();
  if (error) throw new Error(error.message);
  return mapCatalogRow(data as Record<string, unknown>);
}

export async function createVehicleStatusOnRentApi(payload: VehicleCatalogCreatePayload): Promise<VehicleCatalogRow> {
  const code = (payload.code?.trim() || payload.labelTr.trim().toUpperCase().replace(/\s+/g, "_")).slice(0, 64);
  const { data, error } = await client()
    .from("rent_vehicle_catalog")
    .insert({ kind: "vehicle_status", code, label_tr: payload.labelTr, sort_order: payload.sortOrder })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapCatalogRow(data as Record<string, unknown>);
}

export async function updateVehicleStatusOnRentApi(
  code: string,
  payload: VehicleCatalogUpdatePayload,
): Promise<VehicleCatalogRow> {
  const { data, error } = await client()
    .from("rent_vehicle_catalog")
    .update({ label_tr: payload.labelTr, sort_order: payload.sortOrder })
    .eq("kind", "vehicle_status")
    .eq("code", code)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapCatalogRow(data as Record<string, unknown>);
}

export async function deleteVehicleStatusOnRentApi(id: string): Promise<void> {
  const { error } = await client().from("rent_vehicle_catalog").delete().eq("id", toNumId(id));
  if (error) throw new Error(error.message);
}

// --- Vehicles ---
export async function fetchVehicleSnapshotsFromRentApi(): Promise<unknown[]> {
  const vehicles = await fetchVehiclesFromRentApi();
  return vehicles.map((v) => ({
    vehicleId: v.id,
    id: v.id,
    plate: v.plate,
    brand: v.brand,
    model: v.model,
    year: v.year,
    status: v.status,
    statusCode: v.statusCode,
    rentalDailyPrice: v.rentalDailyPrice,
    countryCode: v.countryCode,
    images: v.images,
  }));
}

export async function fetchVehiclesFromRentApi(): Promise<Vehicle[]> {
  const { data, error } = await client().from("rent_vehicles").select("*").order("id");
  if (error) throw new Error(error.message);
  const out: Vehicle[] = [];
  for (const row of data ?? []) {
    out.push(await loadVehicleById(idStr((row as { id: number }).id)));
  }
  return out;
}

export async function fetchVehicleCalendarOccupancyFromRentApi(
  vehicleId: string,
  from: string,
  to: string,
): Promise<{ from: string; to: string; ranges: { id: string; source: "rental" | "rental_request"; startDate: string; endDate: string }[] }> {
  const supabase = client();
  const vid = toNumId(vehicleId);
  let rentalQ = supabase
    .from("rent_rentals")
    .select("id, start_date, end_date, vehicle_id")
    .eq("vehicle_id", vid)
    .lte("start_date", to)
    .gte("end_date", from);
  const { data: rentals } = await rentalQ;

  let reqQ = supabase
    .from("rent_rental_requests")
    .select("id, start_date, end_date, vehicle_id, status")
    .eq("vehicle_id", vid)
    .in("status", ["pending", "approved"])
    .lte("start_date", to)
    .gte("end_date", from);
  const { data: requests } = await reqQ;

  const ranges = [
    ...(rentals ?? []).map((r) => ({
      id: idStr((r as { id: number }).id),
      source: "rental" as const,
      startDate: String((r as { start_date: string }).start_date).slice(0, 10),
      endDate: String((r as { end_date: string }).end_date).slice(0, 10),
    })),
    ...(requests ?? []).map((r) => ({
      id: idStr((r as { id: number }).id),
      source: "rental_request" as const,
      startDate: String((r as { start_date: string }).start_date).slice(0, 10),
      endDate: String((r as { end_date: string }).end_date).slice(0, 10),
    })),
  ];
  return { from, to, ranges };
}

// --- Rentals ---
async function mapRentalRow(row: Record<string, unknown>): Promise<RentalSession> {
  const supabase = client();
  const rid = Number(row.id);
  const { data: customer } = await supabase.from("rent_customers").select("*").eq("id", row.customer_id).single();
  const { data: drivers } = await supabase.from("rent_rental_additional_drivers").select("*").eq("rental_id", rid);
  const { data: options } = await supabase.from("rent_rental_option_lines").select("*").eq("rental_id", rid);

  return mapRentalFromApi({
    ...rowToRecord(row),
    customer: customer ? rowToRecord(customer as Record<string, unknown>) : {},
    additionalDrivers: (drivers ?? []).map((d) => rowToRecord(d as Record<string, unknown>)),
    options: (options ?? []).map((o) => rowToRecord(o as Record<string, unknown>)),
  });
}

export async function fetchRentalsFromRentApi(params?: FetchRentalsParams): Promise<RentalSession[]> {
  let q = client().from("rent_rentals").select("*").order("start_date", { ascending: false });
  if (params?.vehicleId) q = q.eq("vehicle_id", toNumId(params.vehicleId));
  if (params?.status) q = q.eq("status", params.status);
  if (params?.startDate) q = q.gte("end_date", params.startDate);
  if (params?.endDate) q = q.lte("start_date", params.endDate);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const out: RentalSession[] = [];
  for (const row of data ?? []) {
    out.push(await mapRentalRow(row as Record<string, unknown>));
  }
  return out;
}

export async function fetchRentalDashboardReport(params?: FetchRentalDashboardParams): Promise<RentalDashboardReport> {
  const rentals = await fetchRentalsFromRentApi();
  const from = params?.from ?? rentals[0]?.startDate ?? new Date().toISOString().slice(0, 10);
  const to = params?.to ?? new Date().toISOString().slice(0, 10);
  const filtered = rentals.filter((r) => {
    if (params?.vehicleId && r.vehicleId !== params.vehicleId) return false;
    return r.endDate >= from && r.startDate <= to;
  });
  const summary = {
    rentalCount: filtered.length,
    rentalDayBooked: filtered.reduce((acc, r) => {
      const days = Math.max(1, Math.ceil((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / 86400000));
      return acc + days;
    }, 0),
    totalRevenueEur: filtered.reduce((a, r) => a + (r.netAmount ?? 0), 0),
    totalBaseRentalEur: filtered.reduce((a, r) => a + (r.netAmount ?? 0), 0),
    totalOptionsEur: filtered.reduce((a, r) => a + (r.options?.reduce((s, o) => s + o.price, 0) ?? 0), 0),
    totalCommissionEur: filtered.reduce((a, r) => a + (r.commissionAmount ?? 0), 0),
    activeOrPendingCount: filtered.filter((r) => r.status === "active" || r.status === "pending").length,
    completedCount: filtered.filter((r) => r.status === "completed").length,
  };
  return {
    fromInclusive: from,
    toInclusive: to,
    timelineGranularity: "day",
    summary,
    byVehicle: [],
    timeline: [],
  };
}

export async function fetchRentalByIdFromRentApi(id: string): Promise<RentalSession> {
  const { data, error } = await client().from("rent_rentals").select("*").eq("id", toNumId(id)).single();
  if (error || !data) throw new Error(error?.message ?? "Kiralama bulunamadı");
  return mapRentalRow(data as Record<string, unknown>);
}

export async function createRentalOnRentApi(payload: CreateRentalPayload): Promise<RentalSession> {
  const { data, error } = await client()
    .from("rent_rentals")
    .insert({
      vehicle_id: toNumId(payload.vehicleId),
      customer_id: toNumId(payload.customerId),
      start_date: payload.startDate,
      end_date: payload.endDate,
      status: payload.status ?? "pending",
      pickup_handover_location_id: payload.pickupHandoverLocationId ?? null,
      return_handover_location_id: payload.returnHandoverLocationId ?? null,
      user_id: payload.userId ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return fetchRentalByIdFromRentApi(idStr((data as { id: number }).id));
}

export async function updateRentalOnRentApi(id: string, payload: UpdateRentalPayload): Promise<RentalSession> {
  const patch: Record<string, unknown> = {};
  if (payload.startDate) patch.start_date = payload.startDate;
  if (payload.endDate) patch.end_date = payload.endDate;
  if (payload.status) patch.status = payload.status;
  if (payload.discountAmount != null) patch.discount_amount = payload.discountAmount;
  if (payload.discountType) patch.discount_type = payload.discountType;
  const { error } = await client().from("rent_rentals").update(patch).eq("id", toNumId(id));
  if (error) throw new Error(error.message);
  if (payload.customer) {
    const rental = await fetchRentalByIdFromRentApi(id);
    const cid = rental.customer.id;
    if (cid) {
      await client()
        .from("rent_customers")
        .update({
          full_name: payload.customer.fullName,
          phone: payload.customer.phone,
          email: payload.customer.email,
          national_id: payload.customer.nationalId,
          passport_no: payload.customer.passportNo,
          birth_date: payload.customer.birthDate,
          driver_license_no: payload.customer.driverLicenseNo,
        })
        .eq("id", toNumId(cid));
    }
  }
  return fetchRentalByIdFromRentApi(id);
}

// --- Payments & panel users ---
export async function fetchPaymentsFromRentApi(): Promise<PaymentLog[]> {
  const { data, error } = await client().from("rent_payments").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapPaymentFromApi(rowToRecord(r as Record<string, unknown>)));
}

export async function fetchPanelUsersFromRentApi(): Promise<PanelUser[]> {
  const { data, error } = await client().from("rent_panel_users").select("*").order("id");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapPanelUserFromApi(rowToRecord(r as Record<string, unknown>)));
}

export async function deletePanelUserOnRentApi(id: string): Promise<void> {
  const { error } = await client().from("rent_panel_users").delete().eq("id", toNumId(id));
  if (error) throw new Error(error.message);
}

// --- Countries & cities ---
export async function fetchCountriesFromRentApi(): Promise<CountryRow[]> {
  const { data, error } = await client().from("rent_countries").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapCountryFromApi(rowToRecord(r as Record<string, unknown>)));
}

export async function fetchCitiesFromRentApi(countryId?: string): Promise<CityRow[]> {
  let q = client().from("rent_cities").select("*, rent_countries(code, name)").order("name");
  if (countryId) q = q.eq("country_id", toNumId(countryId));
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const country = r.rent_countries as { code?: string; name?: string } | null;
    return {
      id: idStr(r.id as number),
      name: String(r.name ?? ""),
      countryId: idStr(r.country_id as number),
      countryCode: String(country?.code ?? "").toUpperCase(),
      countryName: String(country?.name ?? ""),
    };
  });
}

export async function createCityOnRentApi(payload: CreateCityPayload): Promise<CityRow> {
  const { data, error } = await client()
    .from("rent_cities")
    .insert({ name: payload.name, country_id: toNumId(payload.countryId) })
    .select()
    .single();
  if (error) throw new Error(error.message);
  const cities = await fetchCitiesFromRentApi(idStr((data as { country_id: number }).country_id));
  return cities.find((c) => c.id === idStr((data as { id: number }).id))!;
}

export async function createCountryOnRentApi(payload: CreateCountryPayload): Promise<CountryRow> {
  const { data, error } = await client()
    .from("rent_countries")
    .insert({ code: payload.code.toUpperCase(), name: payload.name, color_code: payload.colorCode })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapCountryFromApi(rowToRecord(data as Record<string, unknown>));
}

export async function patchCountryColorOnRentApi(id: string, colorCode: string): Promise<CountryRow> {
  const { data, error } = await client()
    .from("rent_countries")
    .update({ color_code: colorCode })
    .eq("id", toNumId(id))
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapCountryFromApi(rowToRecord(data as Record<string, unknown>));
}

// --- Form catalog ---
export async function fetchVehicleFormCatalogFromRentApi(): Promise<VehicleFormCatalog> {
  const [brandsRes, statuses, countries, pickups, returns, templates] = await Promise.all([
    client().from("rent_vehicle_brands").select("*, rent_vehicle_models(*)").order("sort_order"),
    fetchVehicleStatusesFromRentApi(),
    fetchCountriesFromRentApi(),
    fetchHandoverLocationsFromRentApi("PICKUP"),
    fetchHandoverLocationsFromRentApi("RETURN"),
    fetchVehicleOptionTemplatesFromRentApi(),
  ]);
  if (brandsRes.error) throw new Error(brandsRes.error.message);
  const brands = (brandsRes.data ?? []).map((b) => {
    const row = b as Record<string, unknown>;
    const models = ((row.rent_vehicle_models as Record<string, unknown>[]) ?? []).map((m) => ({
      id: idStr(m.id as number),
      name: String(m.name ?? ""),
      sortOrder: Number(m.sort_order ?? 0),
    }));
    return { id: idStr(row.id as number), name: String(row.name ?? ""), sortOrder: Number(row.sort_order ?? 0), models };
  });
  return {
    brands,
    vehicleStatuses: statuses.map((s) => ({ ...s, id: s.id })),
    countries,
    pickupHandoverLocations: pickups,
    returnHandoverLocations: returns,
    optionTemplates: templates,
  };
}

// --- Handover ---
function handoverKindToDb(kind: "PICKUP" | "RETURN"): "pickup" | "return" {
  return kind === "PICKUP" ? "pickup" : "return";
}

export async function fetchHandoverLocationsFromRentApi(
  kind?: "PICKUP" | "RETURN",
  opts?: { includeInactive?: boolean },
): Promise<HandoverLocationApiRow[]> {
  let q = client().from("rent_handover_locations").select("*").order("line_order");
  if (kind) q = q.eq("kind", handoverKindToDb(kind));
  if (!opts?.includeInactive) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapHandoverRow(r as Record<string, unknown>));
}

export async function createHandoverLocationOnRentApi(
  payload: CreateHandoverLocationPayload,
): Promise<HandoverLocationApiRow> {
  const { data, error } = await client()
    .from("rent_handover_locations")
    .insert({
      kind: handoverKindToDb(payload.kind),
      name: payload.name,
      description: payload.description,
      city_id: payload.cityId ?? null,
      line_order: payload.lineOrder,
      active: payload.active ?? true,
      surcharge_eur: payload.surchargeEur,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapHandoverRow(data as Record<string, unknown>);
}

export async function updateHandoverLocationOnRentApi(
  id: string,
  payload: UpdateHandoverLocationPayload,
): Promise<HandoverLocationApiRow> {
  const patch: Record<string, unknown> = {};
  if (payload.kind) patch.kind = handoverKindToDb(payload.kind);
  if (payload.name) patch.name = payload.name;
  if (payload.description !== undefined) patch.description = payload.description;
  if (payload.cityId !== undefined) patch.city_id = payload.cityId;
  if (payload.clearCity) patch.city_id = null;
  if (payload.active !== undefined) patch.active = payload.active;
  if (payload.lineOrder !== undefined) patch.line_order = payload.lineOrder;
  if (payload.surchargeEur !== undefined) patch.surcharge_eur = payload.surchargeEur;
  const { data, error } = await client().from("rent_handover_locations").update(patch).eq("id", toNumId(id)).select().single();
  if (error) throw new Error(error.message);
  return mapHandoverRow(data as Record<string, unknown>);
}

export async function deleteHandoverLocationOnRentApi(id: string): Promise<void> {
  const { error } = await client().from("rent_handover_locations").delete().eq("id", toNumId(id));
  if (error) throw new Error(error.message);
}

// --- Option templates ---
function mapVehicleOptionTemplate(row: Record<string, unknown>): VehicleOptionTemplateApiRow {
  return {
    id: idStr(row.id as number),
    title: String(row.title ?? ""),
    description: row.description != null ? String(row.description) : undefined,
    price: Number(row.price ?? 0),
    icon: row.icon != null ? String(row.icon) : undefined,
    lineOrder: Number(row.line_order ?? 0),
    active: Boolean(row.active ?? true),
  };
}

export async function fetchVehicleOptionTemplatesFromRentApi(opts?: {
  includeInactive?: boolean;
}): Promise<VehicleOptionTemplateApiRow[]> {
  let q = client().from("rent_vehicle_option_templates").select("*").order("line_order");
  if (!opts?.includeInactive) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapVehicleOptionTemplate(r as Record<string, unknown>));
}

export async function createVehicleOptionTemplateOnRentApi(
  payload: CreateVehicleOptionTemplatePayload,
): Promise<VehicleOptionTemplateApiRow> {
  const { data, error } = await client()
    .from("rent_vehicle_option_templates")
    .insert({
      title: payload.title,
      description: payload.description,
      price: payload.price,
      icon: payload.icon,
      line_order: payload.lineOrder,
      active: payload.active ?? true,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapVehicleOptionTemplate(data as Record<string, unknown>);
}

export async function updateVehicleOptionTemplateOnRentApi(
  id: string,
  payload: UpdateVehicleOptionTemplatePayload,
): Promise<VehicleOptionTemplateApiRow> {
  const { data, error } = await client()
    .from("rent_vehicle_option_templates")
    .update({
      title: payload.title,
      description: payload.description,
      price: payload.price,
      icon: payload.icon,
      line_order: payload.lineOrder,
      active: payload.active,
    })
    .eq("id", toNumId(id))
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapVehicleOptionTemplate(data as Record<string, unknown>);
}

export async function deleteVehicleOptionTemplateOnRentApi(id: string): Promise<void> {
  const { error } = await client().from("rent_vehicle_option_templates").delete().eq("id", toNumId(id));
  if (error) throw new Error(error.message);
}

function mapReservationExtra(row: Record<string, unknown>): ReservationExtraOptionTemplateApiRow {
  return {
    id: idStr(row.id as number),
    code: String(row.code ?? ""),
    title: String(row.title ?? ""),
    description: row.description != null ? String(row.description) : undefined,
    price: Number(row.price ?? 0),
    icon: row.icon != null ? String(row.icon) : undefined,
    lineOrder: Number(row.line_order ?? 0),
    active: Boolean(row.active ?? true),
    requiresCoDriverDetails: Boolean(row.requires_co_driver_details ?? false),
  };
}

export async function fetchReservationExtraOptionTemplatesFromRentApi(opts?: {
  includeInactive?: boolean;
}): Promise<ReservationExtraOptionTemplateApiRow[]> {
  let q = client().from("rent_reservation_extra_option_templates").select("*").order("line_order");
  if (!opts?.includeInactive) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapReservationExtra(r as Record<string, unknown>));
}

export async function createReservationExtraOptionTemplateOnRentApi(
  payload: CreateReservationExtraOptionTemplatePayload,
): Promise<ReservationExtraOptionTemplateApiRow> {
  const { data, error } = await client()
    .from("rent_reservation_extra_option_templates")
    .insert({
      code: payload.code,
      title: payload.title,
      description: payload.description,
      price: payload.price,
      icon: payload.icon,
      line_order: payload.lineOrder,
      active: payload.active ?? true,
      requires_co_driver_details: payload.requiresCoDriverDetails ?? false,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapReservationExtra(data as Record<string, unknown>);
}

export async function updateReservationExtraOptionTemplateOnRentApi(
  id: string,
  payload: UpdateReservationExtraOptionTemplatePayload,
): Promise<ReservationExtraOptionTemplateApiRow> {
  const { data, error } = await client()
    .from("rent_reservation_extra_option_templates")
    .update({
      code: payload.code,
      title: payload.title,
      description: payload.description,
      price: payload.price,
      icon: payload.icon,
      line_order: payload.lineOrder,
      active: payload.active,
      requires_co_driver_details: payload.requiresCoDriverDetails,
    })
    .eq("id", toNumId(id))
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapReservationExtra(data as Record<string, unknown>);
}

export async function deleteReservationExtraOptionTemplateOnRentApi(id: string): Promise<void> {
  const { error } = await client().from("rent_reservation_extra_option_templates").delete().eq("id", toNumId(id));
  if (error) throw new Error(error.message);
}

// --- Vehicle CRUD ---
export async function createVehicleBrandOnRentApi(payload: {
  name: string;
  sortOrder: number;
}): Promise<{ id: string; name: string; sortOrder: number }> {
  const { data, error } = await client()
    .from("rent_vehicle_brands")
    .insert({ name: payload.name, sort_order: payload.sortOrder })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { id: idStr((data as { id: number }).id), name: payload.name, sortOrder: payload.sortOrder };
}

export async function createVehicleModelOnRentApi(
  brandId: string,
  payload: { name: string; sortOrder: number },
): Promise<{ id: string; name: string; sortOrder: number }> {
  const { data, error } = await client()
    .from("rent_vehicle_models")
    .insert({ brand_id: toNumId(brandId), name: payload.name, sort_order: payload.sortOrder })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { id: idStr((data as { id: number }).id), name: payload.name, sortOrder: payload.sortOrder };
}

export async function createVehicleOnRentApi(payload: CreateVehiclePayload): Promise<Vehicle> {
  const { data, error } = await client()
    .from("rent_vehicles")
    .insert({
      plate: payload.plate,
      brand: payload.brand,
      model: payload.model,
      year: payload.year,
      status: payload.maintenance ? "MAINTENANCE" : "ACTIVE",
      status_code: payload.maintenance ? "MAINTENANCE" : "ACTIVE",
      vehicle_model_id: payload.vehicleModelId ? toNumId(String(payload.vehicleModelId)) : null,
      rental_daily_price: payload.rentalDailyPrice,
      external: payload.external ?? false,
      external_company: payload.externalCompany,
      country_code: payload.countryCode,
      city_id: payload.cityId ? toNumId(String(payload.cityId)) : null,
      default_pickup_handover_location_id: payload.defaultPickupHandoverLocationId
        ? toNumId(String(payload.defaultPickupHandoverLocationId))
        : null,
      highlights: payload.highlights ?? [],
      images: payload.images ?? {},
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  const vid = idStr((data as { id: number }).id);
  if (payload.returnHandoverLocationIds?.length) {
    await client().from("rent_vehicle_return_handover_locations").insert(
      payload.returnHandoverLocationIds.map((hid) => ({
        vehicle_id: toNumId(vid),
        handover_location_id: toNumId(hid),
      })),
    );
  }
  return loadVehicleById(vid);
}

export async function updateVehicleOnRentApi(id: string, payload: UpdateVehiclePayload): Promise<Vehicle> {
  const patch: Record<string, unknown> = {};
  if (payload.plate) patch.plate = payload.plate;
  if (payload.brand) patch.brand = payload.brand;
  if (payload.model) patch.model = payload.model;
  if (payload.year != null) patch.year = payload.year;
  if (payload.maintenance != null) {
    patch.status = payload.maintenance ? "MAINTENANCE" : "ACTIVE";
    patch.status_code = patch.status;
  }
  if (payload.rentalDailyPrice != null) patch.rental_daily_price = payload.rentalDailyPrice;
  const { error } = await client().from("rent_vehicles").update(patch).eq("id", toNumId(id));
  if (error) throw new Error(error.message);
  return loadVehicleById(id);
}

export async function deleteVehicleOnRentApi(id: string): Promise<void> {
  const { error } = await client().from("rent_vehicles").delete().eq("id", toNumId(id));
  if (error) throw new Error(error.message);
}

export async function replaceVehicleImageSlotOnRentApi(
  vehicleId: string,
  slot: VehicleImageSlot,
  imageDataUrl: string,
): Promise<Vehicle> {
  const { data: row } = await client().from("rent_vehicles").select("images").eq("id", toNumId(vehicleId)).single();
  const images = { ...((row?.images as Record<string, string>) ?? {}), [slot]: imageDataUrl };
  await client().from("rent_vehicles").update({ images }).eq("id", toNumId(vehicleId));
  return loadVehicleById(vehicleId);
}

export async function deleteVehicleImageSlotOnRentApi(vehicleId: string, slot: VehicleImageSlot): Promise<Vehicle> {
  const { data: row } = await client().from("rent_vehicles").select("images").eq("id", toNumId(vehicleId)).single();
  const images = { ...((row?.images as Record<string, string>) ?? {}) };
  delete images[slot];
  await client().from("rent_vehicles").update({ images }).eq("id", toNumId(vehicleId));
  return loadVehicleById(vehicleId);
}

// --- Rental requests ---
function mapRentalRequest(row: Record<string, unknown>, drivers?: Record<string, unknown>[]): RentalRequestDto {
  return {
    id: idStr(row.id as number),
    referenceNo: String(row.reference_no ?? ""),
    createdAt: row.created_at != null ? String(row.created_at) : undefined,
    status: String(row.status ?? "pending") as RentalRequestStatus,
    statusMessage: row.status_message != null ? String(row.status_message) : undefined,
    vehicleId: row.vehicle_id != null ? idStr(row.vehicle_id as number) : undefined,
    startDate: String(row.start_date ?? "").slice(0, 10),
    endDate: String(row.end_date ?? "").slice(0, 10),
    outsideCountryTravel: Boolean(row.outside_country_travel),
    greenInsuranceFee: Number(row.green_insurance_fee ?? 0),
    note: row.note != null ? String(row.note) : undefined,
    contractPdfPath: row.contract_pdf_path != null ? String(row.contract_pdf_path) : undefined,
    contractGenerationAvailable: Boolean(row.contract_generation_available),
    customer: {
      fullName: String(row.customer_full_name ?? ""),
      phone: String(row.customer_phone ?? ""),
      email: String(row.customer_email ?? ""),
      birthDate: String(row.customer_birth_date ?? "").slice(0, 10),
      nationalId: row.customer_national_id != null ? String(row.customer_national_id) : undefined,
      passportNo: String(row.customer_passport_no ?? ""),
      driverLicenseNo: String(row.customer_driver_license_no ?? ""),
    },
    additionalDrivers: drivers?.map((d) => ({
      id: idStr(d.id as number),
      fullName: String(d.full_name ?? ""),
      birthDate: String(d.birth_date ?? "").slice(0, 10),
      driverLicenseNo: String(d.driver_license_no ?? ""),
      passportNo: String(d.passport_no ?? ""),
    })),
  };
}

export async function createRentalRequestOnRentApi(payload: RentalRequestFormPayload): Promise<RentalRequestDto> {
  const ref = randomReference("REQ");
  const { data, error } = await client()
    .from("rent_rental_requests")
    .insert({
      reference_no: ref,
      vehicle_id: payload.vehicleId ? toNumId(payload.vehicleId) : null,
      start_date: payload.startDate,
      end_date: payload.endDate,
      outside_country_travel: payload.outsideCountryTravel,
      note: payload.note,
      customer_full_name: payload.customer.fullName,
      customer_phone: payload.customer.phone,
      customer_email: payload.customer.email,
      customer_birth_date: payload.customer.birthDate,
      customer_national_id: payload.customer.nationalId,
      customer_passport_no: payload.customer.passportNo ?? "",
      customer_driver_license_no: payload.customer.driverLicenseNo ?? "",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  const rid = (data as { id: number }).id;
  if (payload.additionalDrivers?.length) {
    await client().from("rent_rental_request_additional_drivers").insert(
      payload.additionalDrivers.map((d) => ({
        rental_request_id: rid,
        full_name: d.fullName,
        birth_date: d.birthDate,
        driver_license_no: d.driverLicenseNo ?? "",
        passport_no: d.passportNo ?? "",
      })),
    );
  }
  return queryRentalRequestByReferenceOnRentApi(ref);
}

export async function queryRentalRequestByReferenceOnRentApi(referenceNo: string): Promise<RentalRequestDto> {
  const { data, error } = await client()
    .from("rent_rental_requests")
    .select("*")
    .eq("reference_no", referenceNo.trim())
    .single();
  if (error) throw new Error(error.message);
  const { data: drivers } = await client()
    .from("rent_rental_request_additional_drivers")
    .select("*")
    .eq("rental_request_id", (data as { id: number }).id);
  return mapRentalRequest(data as Record<string, unknown>, (drivers ?? []) as Record<string, unknown>[]);
}

export async function fetchRentalRequestsFromRentApi(params?: {
  vehicleId?: string;
}): Promise<RentalRequestDto[]> {
  let q = client().from("rent_rental_requests").select("*").order("created_at", { ascending: false });
  if (params?.vehicleId) q = q.eq("vehicle_id", toNumId(params.vehicleId));
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const out: RentalRequestDto[] = [];
  for (const row of data ?? []) {
    const { data: drivers } = await client()
      .from("rent_rental_request_additional_drivers")
      .select("*")
      .eq("rental_request_id", (row as { id: number }).id);
    out.push(mapRentalRequest(row as Record<string, unknown>, (drivers ?? []) as Record<string, unknown>[]));
  }
  return out;
}

export async function updateRentalRequestStatusOnRentApi(
  id: string,
  status: RentalRequestStatus,
  statusMessage?: string,
): Promise<RentalRequestDto> {
  const { data, error } = await client()
    .from("rent_rental_requests")
    .update({ status, status_message: statusMessage ?? null })
    .eq("id", toNumId(id))
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapRentalRequest(data as Record<string, unknown>);
}

export async function generateRentalRequestContractOnRentApi(id: string): Promise<RentalRequestDto> {
  const { data, error } = await client()
    .from("rent_rental_requests")
    .update({ contract_generation_available: true })
    .eq("id", toNumId(id))
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapRentalRequest(data as Record<string, unknown>);
}

export async function fetchRentalRequestContractPdfBlob(_id: string): Promise<Blob> {
  throw new Error("Sözleşme PDF için Supabase Storage bucket yapılandırın (rent-contracts).");
}

export async function sendRentalRequestContractEmailOnRentApi(id: string): Promise<void> {
  await client()
    .from("rent_rental_requests")
    .update({ whatsapp_contract_sent_at: new Date().toISOString() })
    .eq("id", toNumId(id));
}

// --- Customers ---
export async function fetchCustomersFromRentApi(): Promise<RentCustomerRow[]> {
  const { data, error } = await client().from("rent_customers").select("*").order("full_name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: idStr(row.id as number),
      fullName: String(row.full_name ?? ""),
      nationalId: row.national_id != null ? String(row.national_id) : undefined,
      passportNo: row.passport_no != null ? String(row.passport_no) : undefined,
      phone: String(row.phone ?? ""),
      email: row.email != null ? String(row.email) : "",
      birthDate: row.birth_date != null ? String(row.birth_date).slice(0, 10) : undefined,
      driverLicenseNo: row.driver_license_no != null ? String(row.driver_license_no) : undefined,
      driverLicenseImageUrl: row.driver_license_image_url != null ? String(row.driver_license_image_url) : undefined,
      passportImageUrl: row.passport_image_url != null ? String(row.passport_image_url) : undefined,
      createdAt: row.created_at != null ? String(row.created_at) : undefined,
      updatedAt: row.updated_at != null ? String(row.updated_at) : undefined,
    };
  });
}

export async function createCustomerOnRentApi(payload: RentCustomerUpsertPayload): Promise<RentCustomerRow> {
  const { data, error } = await client()
    .from("rent_customers")
    .insert({
      full_name: payload.fullName,
      national_id: payload.nationalId,
      passport_no: payload.passportNo,
      phone: payload.phone,
      email: payload.email,
      birth_date: payload.birthDate,
      driver_license_no: payload.driverLicenseNo,
      driver_license_image_url: payload.driverLicenseImageDataUrl,
      passport_image_url: payload.passportImageDataUrl,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  const rows = await fetchCustomersFromRentApi();
  return rows.find((c) => c.id === idStr((data as { id: number }).id))!;
}

export async function updateCustomerOnRentApi(id: string, payload: RentCustomerUpsertPayload): Promise<RentCustomerRow> {
  const { error } = await client()
    .from("rent_customers")
    .update({
      full_name: payload.fullName,
      national_id: payload.nationalId,
      passport_no: payload.passportNo,
      phone: payload.phone,
      email: payload.email,
      birth_date: payload.birthDate,
      driver_license_no: payload.driverLicenseNo,
    })
    .eq("id", toNumId(id));
  if (error) throw new Error(error.message);
  const rows = await fetchCustomersFromRentApi();
  return rows.find((c) => c.id === id)!;
}

export async function deleteCustomerOnRentApi(id: string): Promise<void> {
  const { error } = await client().from("rent_customers").delete().eq("id", toNumId(id));
  if (error) throw new Error(error.message);
}

export async function fetchCustomerRecordStatesFromRentApi(): Promise<CustomerRecordStatePayload[]> {
  const { data, error } = await client().from("rent_customer_record_states").select("*");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    recordKey: String((r as { record_key: string }).record_key),
    active: Boolean((r as { active: boolean }).active),
  }));
}

export async function patchCustomerRecordActiveOnRentApi(
  recordKey: string,
  active: boolean,
): Promise<CustomerRecordStatePayload> {
  const { error } = await client()
    .from("rent_customer_record_states")
    .upsert({ record_key: recordKey, active }, { onConflict: "record_key" });
  if (error) throw new Error(error.message);
  return { recordKey, active };
}

export async function deleteCustomerRecordOnRentApi(recordKey: string): Promise<CustomerRecordDeletionPayload> {
  await client().from("rent_customer_record_states").delete().eq("record_key", recordKey);
  return { deletedRentals: 0, deletedRentalRequests: 0 };
}

// --- Coupons ---
export async function fetchCouponsOnRentApi(): Promise<DiscountCouponRow[]> {
  const { data, error } = await client().from("rent_discount_coupons").select("*").order("code");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: idStr(row.id as number),
      code: String(row.code ?? ""),
      discountType: String(row.discount_type ?? "AMOUNT") as DiscountCouponRow["discountType"],
      discountValue: Number(row.discount_value ?? 0),
      description: row.description != null ? String(row.description) : undefined,
      active: Boolean(row.active ?? true),
      usageLimit: row.usage_limit != null ? Number(row.usage_limit) : undefined,
      usageCount: Number(row.usage_count ?? 0),
      expiresAt: row.expires_at != null ? String(row.expires_at) : undefined,
      createdAt: row.created_at != null ? String(row.created_at) : undefined,
      updatedAt: row.updated_at != null ? String(row.updated_at) : undefined,
    };
  });
}

export async function createCouponOnRentApi(payload: CreateCouponPayload): Promise<DiscountCouponRow> {
  const { data, error } = await client()
    .from("rent_discount_coupons")
    .insert({
      code: payload.code,
      discount_type: payload.discountType,
      discount_value: payload.discountValue,
      description: payload.description,
      active: payload.active ?? true,
      usage_limit: payload.usageLimit,
      expires_at: payload.expiresAt,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  const all = await fetchCouponsOnRentApi();
  return all.find((c) => c.id === idStr((data as { id: number }).id))!;
}

export async function updateCouponOnRentApi(id: string, payload: UpdateCouponPayload): Promise<DiscountCouponRow> {
  const { error } = await client()
    .from("rent_discount_coupons")
    .update({
      code: payload.code,
      discount_type: payload.discountType,
      discount_value: payload.discountValue,
      description: payload.description,
      active: payload.active,
      usage_limit: payload.usageLimit,
      expires_at: payload.expiresAt,
    })
    .eq("id", toNumId(id));
  if (error) throw new Error(error.message);
  const all = await fetchCouponsOnRentApi();
  return all.find((c) => c.id === id)!;
}

export async function deleteCouponOnRentApi(id: string): Promise<void> {
  const { error } = await client().from("rent_discount_coupons").delete().eq("id", toNumId(id));
  if (error) throw new Error(error.message);
}

export async function validateCouponOnRentApi(code: string): Promise<ValidateCouponResult> {
  const { data } = await client()
    .from("rent_discount_coupons")
    .select("*")
    .eq("code", code.trim())
    .eq("active", true)
    .maybeSingle();
  if (!data) return { valid: false, message: "Kupon bulunamadı" };
  const row = data as Record<string, unknown>;
  if (row.expires_at && new Date(String(row.expires_at)) < new Date()) {
    return { valid: false, message: "Kupon süresi dolmuş" };
  }
  if (row.usage_limit != null && Number(row.usage_count) >= Number(row.usage_limit)) {
    return { valid: false, message: "Kullanım limiti dolmuş" };
  }
  return {
    valid: true,
    discountType: String(row.discount_type) as ValidateCouponResult["discountType"],
    discountValue: Number(row.discount_value),
  };
}
