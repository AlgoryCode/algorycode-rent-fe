export type VehicleBodyStyleRow = {
  id: string;
  code: string;
  labelTr: string;
  sortOrder: number;
};

export type VehicleCatalogRow = VehicleBodyStyleRow;

export type VehicleCatalogCreatePayload = {
  code?: string;
  labelTr: string;
  sortOrder: number;
};

export type VehicleCatalogUpdatePayload = {
  labelTr?: string;
  sortOrder?: number;
};

export type VehicleOptionDefinitionPayload = {
  title: string;
  description?: string;
  price: number;
  icon?: string;
  lineOrder: number;
  active?: boolean;
};

export type CreateVehiclePayload = {
  plate: string;
  brand: string;
  model: string;
  year: number;
  maintenance: boolean;
  vehicleModelId?: string;
  vehicleStatusId?: string;
  external?: boolean;
  externalCompany?: string;
  rentalDailyPrice: number;
  commissionRatePercent?: number;
  commissionBrokerPhone?: string;
  countryCode: string;
  cityId?: string;
  defaultPickupHandoverLocationId: string;
  returnHandoverLocationIds?: string[];
  defaultReturnHandoverLocationId?: string;
  optionTemplateIds?: string[];
  optionDefinitions?: VehicleOptionDefinitionPayload[];
  highlights?: string[];
  images?: Record<string, string>;
  engine?: string;
  fuelType?: string;
  bodyColor?: string;
  seats?: number;
  luggage?: number;
  transmissionType?: string;
  bodyStyleCode?: string;
};

export type UpdateVehiclePayload = {
  plate?: string;
  brand?: string;
  model?: string;
  year?: number;
  maintenance?: boolean;
  external?: boolean;
  externalCompany?: string;
  rentalDailyPrice?: number;
  commissionRatePercent?: number;
  commissionBrokerPhone?: string;
  countryCode?: string;
  cityId?: string;
  defaultPickupHandoverLocationId?: string;
  returnHandoverLocationIds?: string[];
  defaultReturnHandoverLocationId?: string;
  optionTemplateIds?: string[];
  optionDefinitions?: VehicleOptionDefinitionPayload[];
  highlights?: string[];
  images?: Record<string, string>;
  engine?: string;
  fuelType?: string;
  bodyColor?: string;
  seats?: number;
  luggage?: number;
  transmissionType?: string;
  bodyStyleCode?: string;
};

export type CountryRow = {
  id: string;
  code: string;
  name: string;
  colorCode: string;
};

export type CityRow = {
  id: string;
  name: string;
  countryId: string;
  countryCode: string;
  countryName: string;
};

export type HandoverLocationApiRow = {
  id: string;
  kind: string;
  name: string;
  description?: string | null;
  cityId?: string | null;
  cityName?: string | null;
  countryCode?: string | null;
  lineOrder?: number;
  active?: boolean;
  surchargeEur?: number;
};

export type CreateHandoverLocationPayload = {
  kind: "PICKUP" | "RETURN";
  name: string;
  description?: string;
  cityId?: string;
  active?: boolean;
  lineOrder: number;
  surchargeEur?: number;
};

export type UpdateHandoverLocationPayload = {
  kind?: "PICKUP" | "RETURN";
  name?: string;
  description?: string;
  cityId?: string;
  clearCity?: boolean;
  active?: boolean;
  lineOrder?: number;
  surchargeEur?: number;
};

export type VehicleOptionTemplateApiRow = {
  id: string;
  title: string;
  description?: string | null;
  price: number;
  icon?: string | null;
  lineOrder: number;
  active: boolean;
};

export type VehicleFormCatalogModelRow = {
  id: string;
  name: string;
  sortOrder: number;
};

export type VehicleFormCatalogBrandRow = {
  id: string;
  name: string;
  sortOrder: number;
  models: VehicleFormCatalogModelRow[];
};

export type VehicleFormCatalogVehicleStatusRow = {
  id: string;
  code: string;
  labelTr: string;
  sortOrder: number;
};

export type VehicleFormCatalog = {
  brands: VehicleFormCatalogBrandRow[];
  fuelTypes: VehicleCatalogRow[];
  transmissionTypes: VehicleCatalogRow[];
  bodyStyles: VehicleCatalogRow[];
  vehicleStatuses: VehicleFormCatalogVehicleStatusRow[];
  countries: CountryRow[];
  pickupHandoverLocations: HandoverLocationApiRow[];
  returnHandoverLocations: HandoverLocationApiRow[];
  optionTemplates: VehicleOptionTemplateApiRow[];
};

export type CreateVehicleOptionTemplatePayload = {
  title: string;
  description?: string;
  price: number;
  icon?: string;
  lineOrder: number;
  active?: boolean;
};

export type UpdateVehicleOptionTemplatePayload = {
  title?: string;
  description?: string;
  price?: number;
  icon?: string;
  lineOrder?: number;
  active?: boolean;
};

export type ReservationExtraOptionTemplateApiRow = {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  price: number;
  icon?: string | null;
  lineOrder: number;
  active: boolean;
  requiresCoDriverDetails: boolean;
};

export type CreateReservationExtraOptionTemplatePayload = {
  code: string;
  title: string;
  description?: string;
  price: number;
  icon?: string;
  lineOrder: number;
  active?: boolean;
  requiresCoDriverDetails?: boolean;
};

export type UpdateReservationExtraOptionTemplatePayload = {
  code?: string;
  title?: string;
  description?: string;
  price?: number;
  icon?: string;
  lineOrder?: number;
  active?: boolean;
  requiresCoDriverDetails?: boolean;
};

export type CreateCountryPayload = {
  code: string;
  name: string;
  colorCode: string;
};

export type CreateCityPayload = {
  name: string;
  countryId: string;
};
