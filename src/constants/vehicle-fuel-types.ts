import fuelTypesJson from "./catalog/fuel-types.json";

export type VehicleFuelTypeStatic = (typeof fuelTypesJson)[number];

export const VEHICLE_FUEL_TYPES_STATIC: VehicleFuelTypeStatic[] = fuelTypesJson;
