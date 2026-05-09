import { expect, test } from "@playwright/test";

async function mockRentApi(page: import("@playwright/test").Page) {
  await page.route("**/rent/vehicles**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
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
        },
      ]),
    });
  });

  await page.route("**/rent/rentals**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.route("**/rent/rental-requests**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.route("**/rent/vehicles/*/calendar-occupancy**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ranges: [] }) });
  });
}

test("@mock desktop rental request flow renders", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chrome", "desktop scenario");
  await mockRentApi(page);
  await page.goto("/rental-request-form");
  await expect(page.getByText("Kiralama Talep Formu")).toBeVisible();
  await expect(page.getByRole("button", { name: /Talep oluşturma/i })).toBeVisible();
});

test("@mock mobile rental request flow renders", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome", "mobile scenario");
  await mockRentApi(page);
  await page.goto("/rental-request-form");
  await expect(page.getByText("Kiralama Talep Formu")).toBeVisible();
  await expect(page.getByRole("button", { name: /Talep sorgulama/i })).toBeVisible();
});

test("@staging smoke rental request page opens", async ({ page }) => {
  test.skip(process.env.RUN_STAGING_CONTRACT !== "true", "staging pipeline only");
  await page.goto("/rental-request-form");
  await expect(page.getByText("Kiralama Talep Formu")).toBeVisible();
});
