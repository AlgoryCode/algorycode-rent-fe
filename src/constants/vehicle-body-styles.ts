import bodyStylesJson from "./catalog/body-styles.json";

export type VehicleBodyStyleStatic = (typeof bodyStylesJson)[number];

export const VEHICLE_BODY_STYLES_STATIC: VehicleBodyStyleStatic[] = bodyStylesJson;
