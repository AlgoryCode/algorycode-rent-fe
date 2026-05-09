import { http, HttpResponse } from "msw";

const BASE = "https://gateway.algorycode.com/rent";

const mockVehicleJson = {
  id: 1,
  vehicleModelId: null,
  transmissionTypeId: null,
  bodyStyleId: null,
  fuelTypeId: null,
  plate: "34 ABC 123",
  brand: "Tesla",
  model: "Model 3",
  year: 2023,
  status: "ACTIVE",
  statusCode: "ACTIVE",
  external: false,
  externalCompany: null,
  rentalDailyPrice: 120,
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
};

export const handlers = [
  http.get(`${BASE}/vehicles`, () => HttpResponse.json([mockVehicleJson])),
  http.get(`${BASE}/rentals`, () => HttpResponse.json([])),
  http.get(`${BASE}/rental-requests`, () => HttpResponse.json([])),
];
