import transmissionTypesJson from "./catalog/transmission-types.json";

export type VehicleTransmissionTypeStatic = (typeof transmissionTypesJson)[number];

export const VEHICLE_TRANSMISSION_TYPES_STATIC: VehicleTransmissionTypeStatic[] = transmissionTypesJson;
