import { describe, expect, it } from "vitest";

import { validateRentalStepInput } from "@/lib/rental-step-validation";

const base = {
  pickStart: "2026-04-29",
  pickEnd: "2026-04-30",
  fullName: "Test User",
  phoneLocal: "5551112233",
  saveNewCustomerProfile: false,
  newCustomerEmail: "",
  driverLicenseImageDataUrl: "dl",
  passportImageDataUrl: "pp",
  additionalDrivers: [] as Array<{
    fullName: string;
    birthDate: string;
    driverLicenseImageDataUrl: string;
    passportImageDataUrl: string;
  }>,
};

describe("validateRentalStepInput", () => {
  it("rejects invalid date range on step 1", () => {
    const err = validateRentalStepInput({ ...base, step: 1, pickEnd: "" });
    expect(err).toBe("Takvimde başlangıç ve bitiş gününü ayrı ayrı seçin; bitiş tarihi zorunludur.");
  });

  it("requires valid email when saving new customer on step 2", () => {
    const err = validateRentalStepInput({
      ...base,
      step: 2,
      saveNewCustomerProfile: true,
      newCustomerEmail: "not-an-email",
    });
    expect(err).toBe("Geçerli bir e-posta adresi girin.");
  });

  it("requires document images on step 3", () => {
    const err = validateRentalStepInput({
      ...base,
      step: 3,
      driverLicenseImageDataUrl: "",
    });
    expect(err).toBe("Ehliyet ve pasaport görselleri zorunlu.");
  });

  it("requires complete additional driver data on step 4", () => {
    const err = validateRentalStepInput({
      ...base,
      step: 4,
      additionalDrivers: [{ fullName: "Ek", birthDate: "", driverLicenseImageDataUrl: "a", passportImageDataUrl: "b" }],
    });
    expect(err).toBe("Ek sürücü için isim, doğum tarihi ve iki belge fotoğrafı zorunludur.");
  });

  it("returns null on valid final step", () => {
    const err = validateRentalStepInput({ ...base, step: 5 });
    expect(err).toBeNull();
  });
});
