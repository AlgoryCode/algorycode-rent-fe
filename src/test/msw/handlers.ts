import { http, HttpResponse } from "msw";

const BASE = "https://gateway.algorycode.com/rent";

export const handlers = [
  http.get(`${BASE}/vehicles`, () =>
    HttpResponse.json([
      {
        id: "v1",
        plate: "34 ABC 123",
        brand: "Tesla",
        model: "Model 3",
        year: 2023,
        rentalDailyPrice: 120,
        commissionEnabled: false,
      },
    ]),
  ),
  http.get(`${BASE}/rentals`, () => HttpResponse.json([])),
  http.get(`${BASE}/rental-requests`, () => HttpResponse.json([])),
];
