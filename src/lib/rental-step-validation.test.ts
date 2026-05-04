import { describe, expect, it } from "vitest";

import { validateRentalStepInput } from "@/lib/rental-step-validation";

const base = {
  pickStart: "2026-04-29",
  pickEnd: "2026-04-30",
  fullName: "Test User",
  customerBirthDate: "1990-01-15",
  phoneLocal: "5551112233",
  customerEmail: "a@b.co",
  driverLicenseImageDataUrl: "dl",
  passportImageDataUrl: "pp",
  additionalDrivers: [] as Array<{
    fullName: string;
    driverLicenseImageDataUrl: string;
  }>,
};

describe("validateRentalStepInput", () => {
  it("rejects invalid date range on step 1", () => {
    const err = validateRentalStepInput({ ...base, step: 1, pickEnd: "" });
    expect(err).toBe("Çıkış ve dönüş tarihlerini seçin. Dönüş, çıkışla aynı gün olamaz; en az ertesi gün seçilmelidir.");
  });

  it("rejects same-day pickup and return on step 1", () => {
    const err = validateRentalStepInput({ ...base, step: 1, pickEnd: base.pickStart });
    expect(err).toBe(
      "Çıkış ve dönüş tarihlerini seçin. Dönüş, çıkışla aynı gün olamaz; en az ertesi gün seçilmelidir.",
    );
  });

  it("requires birth date on step 2", () => {
    const empty = validateRentalStepInput({ ...base, step: 2, customerBirthDate: "" });
    expect(empty).toBe("Doğum tarihi zorunludur.");
  });

  it("requires email on step 2", () => {
    const empty = validateRentalStepInput({ ...base, step: 2, customerEmail: "  " });
    expect(empty).toBe("E-posta zorunludur.");
    const invalid = validateRentalStepInput({ ...base, step: 2, customerEmail: "not-an-email" });
    expect(invalid).toBe("Geçerli bir e-posta adresi girin.");
  });

  it("requires document images on step 3", () => {
    const err = validateRentalStepInput({
      ...base,
      step: 3,
      driverLicenseImageDataUrl: "",
    });
    expect(err).toBe("Ehliyet ve pasaport görselleri zorunlu.");
  });

  it("allows step 4 without additional driver entry", () => {
    expect(validateRentalStepInput({ ...base, step: 4 })).toBeNull();
  });

  it("requires name and licence photo when additional driver slot is added", () => {
    const err = validateRentalStepInput({
      ...base,
      step: 4,
      additionalDrivers: [{ fullName: "", driverLicenseImageDataUrl: "" }],
    });
    expect(err).toBe("Ek sürücü için isim soyisim ve ehliyet fotoğrafı zorunludur.");
  });

  it("allows step 5 (özet) without blocking", () => {
    expect(validateRentalStepInput({ ...base, step: 5 })).toBeNull();
  });
});
