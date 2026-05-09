import type { VehicleImages } from "@/lib/vehicle-images";

export type VehicleStatusDto = "ACTIVE" | "PENDING" | "MAINTENANCE" | "RENTED";

export type HandoverLocationRefDto = {
  id: number;
  kind?: "PICKUP" | "RETURN";
  name?: string | null;
  description?: string | null;
  cityId?: number | null;
  cityName?: string | null;
  countryCode?: string | null;
  lineOrder?: number | null;
  active?: boolean | null;
  surchargeEur?: number | null;
};

export type VehicleOptionDefinitionDto = {
  id: number;
  title: string;
  description?: string | null;
  price: number;
  icon?: string | null;
  lineOrder: number;
  active: boolean;
};

export type VehicleDto = {
  id: number;
  vehicleModelId: number | null;
  transmissionTypeId: number | null;
  bodyStyleId: number | null;
  fuelTypeId: number | null;
  plate: string;
  brand: string;
  model: string;
  year: number;
  status: VehicleStatusDto;
  statusCode: string;
  external: boolean;
  externalCompany: string | null;
  rentalDailyPrice: number | null;
  commissionEnabled: boolean;
  commissionRatePercent: number | null;
  commissionBrokerFullName: string | null;
  commissionBrokerPhone: string | null;
  countryCode: string | null;
  cityId: number | null;
  engine: string | null;
  fuelType: string | null;
  bodyColor: string | null;
  seats: number | null;
  luggage: number | null;
  transmissionType: string | null;
  bodyStyleCode: string | null;
  bodyStyleLabel: string | null;
  defaultPickupHandoverLocation: HandoverLocationRefDto | null;
  defaultReturnHandoverLocation: HandoverLocationRefDto | null;
  returnHandoverLocations: HandoverLocationRefDto[];
  optionDefinitions: VehicleOptionDefinitionDto[];
  highlights: string[];
  images?: VehicleImages;
};

export function parseVehicleStatusDto(raw: unknown): VehicleStatusDto {
  const s = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (s === "ACTIVE" || s === "PENDING" || s === "MAINTENANCE" || s === "RENTED") {
    return s;
  }
  return "ACTIVE";
}

export function vehicleMaintenanceBlocked(v: VehicleDto): boolean {
  return v.status === "MAINTENANCE";
}

export function vehicleDtoDefaults(): Omit<VehicleDto, "id" | "plate" | "brand" | "model" | "year"> {
  return {
    vehicleModelId: null,
    transmissionTypeId: null,
    bodyStyleId: null,
    fuelTypeId: null,
    status: "ACTIVE",
    statusCode: "ACTIVE",
    external: false,
    externalCompany: null,
    rentalDailyPrice: null,
    commissionEnabled: false,
    commissionRatePercent: null,
    commissionBrokerFullName: null,
    commissionBrokerPhone: null,
    countryCode: null,
    cityId: null,
    engine: null,
    fuelType: null,
    bodyColor: null,
    seats: null,
    luggage: null,
    transmissionType: null,
    bodyStyleCode: null,
    bodyStyleLabel: null,
    defaultPickupHandoverLocation: null,
    defaultReturnHandoverLocation: null,
    returnHandoverLocations: [],
    optionDefinitions: [],
    highlights: [],
    images: undefined,
  };
}

export function createSeedVehicle(
  core: Pick<VehicleDto, "id" | "plate" | "brand" | "model" | "year"> & Partial<VehicleDto>,
): VehicleDto {
  return { ...vehicleDtoDefaults(), ...core };
}
