import vehicleBrandsJson from "./catalog/vehicle-brands.json";
import vehicleModelsByBrandJson from "./catalog/vehicle-models-by-brand.json";

export type VehicleBrandModelStatic = {
  id: number;
  brandId: number;
  code: string;
  name: string;
  sortOrder: number;
};

export type VehicleBrandStatic = {
  id: number;
  code: string;
  name: string;
  sortOrder: number;
  models: VehicleBrandModelStatic[];
};

function buildVehicleBrandsWithModels(): VehicleBrandStatic[] {
  const byBrand = vehicleModelsByBrandJson as Record<string, VehicleBrandModelStatic[]>;
  return [...vehicleBrandsJson]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "tr"))
    .map((b) => ({
      ...b,
      models: [...(byBrand[b.code] ?? [])].sort(
        (m1, m2) => m1.sortOrder - m2.sortOrder || m1.name.localeCompare(m2.name, "tr"),
      ),
    }));
}

export const VEHICLE_BRANDS_MODELS_STATIC: VehicleBrandStatic[] = buildVehicleBrandsWithModels();

export function staticVehicleBrandSelectItems(): { value: string; label: string }[] {
  return VEHICLE_BRANDS_MODELS_STATIC.map((b) => ({ value: b.code, label: b.name }));
}

export function staticVehicleModelsForBrandId(brandCode: string): { value: string; label: string }[] {
  const b = VEHICLE_BRANDS_MODELS_STATIC.find((x) => x.code === brandCode);
  return (b?.models ?? []).map((m) => ({ value: m.code, label: m.name }));
}

export function resolveStaticBrandModelNames(
  brandCode: string,
  modelCode: string,
): { brand: string; model: string } | null {
  const b = VEHICLE_BRANDS_MODELS_STATIC.find((x) => x.code === brandCode);
  if (!b) return null;
  const m = b.models.find((x) => x.code === modelCode);
  if (!m) return null;
  return { brand: b.name, model: m.name };
}
