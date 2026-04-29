import { describe, expect, it } from "vitest";
import { z } from "zod";

import { fetchVehiclesFromRentApi } from "@/lib/rent-api";

const runStaging = process.env.RUN_STAGING_CONTRACT === "true";

const vehicleSchema = z.object({
  id: z.string().min(1),
  plate: z.string().min(1),
  brand: z.string().min(1),
  model: z.string().min(1),
  year: z.number(),
});

const suite = runStaging ? describe : describe.skip;

suite("rent-api contracts (staging)", () => {
  it("validates vehicle payload contract from staging BE", async () => {
    const rows = await fetchVehiclesFromRentApi();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row) => vehicleSchema.parse(row));
  });
});
