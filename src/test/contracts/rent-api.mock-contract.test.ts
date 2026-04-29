import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  fetchRentalsFromRentApi,
  fetchRentalRequestsFromRentApi,
  fetchVehiclesFromRentApi,
} from "@/lib/rent-api";

const vehicleSchema = z.object({
  id: z.string().min(1),
  plate: z.string().min(1),
  brand: z.string().min(1),
  model: z.string().min(1),
  year: z.number(),
});

const rentalSchema = z.object({
  id: z.string(),
  vehicleId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
});

const rentalRequestSchema = z.object({
  id: z.string().or(z.number()).optional(),
  referenceNo: z.string().optional(),
  vehicleId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.string().optional(),
});

describe("rent-api contracts (mock)", () => {
  it("validates vehicles response shape", async () => {
    const rows = await fetchVehiclesFromRentApi();
    expect(Array.isArray(rows)).toBe(true);
    rows.forEach((row) => vehicleSchema.parse(row));
  });

  it("validates rentals response shape", async () => {
    const rows = await fetchRentalsFromRentApi();
    expect(Array.isArray(rows)).toBe(true);
    rows.forEach((row) => rentalSchema.partial().parse(row));
  });

  it("validates rental requests response shape", async () => {
    const rows = await fetchRentalRequestsFromRentApi();
    expect(Array.isArray(rows)).toBe(true);
    rows.forEach((row) => rentalRequestSchema.parse(row));
  });
});
