export type RentalStepValidationInput = {
  step: 1 | 2 | 3 | 4 | 5;
  pickStart: string;
  pickEnd: string;
  fullName: string;
  /** ISO yyyy-MM-dd; talep (`RentalRequestFormPayload`) ile aynı gereksinim */
  customerBirthDate: string;
  phoneLocal: string;
  customerEmail: string;
  driverLicenseImageDataUrl: string;
  passportImageDataUrl: string;
  additionalDrivers: Array<{
    fullName: string;
    driverLicenseImageDataUrl: string;
  }>;
};

export function validateRentalStepInput(input: RentalStepValidationInput): string | null {
  const {
    step,
    pickStart,
    pickEnd,
    fullName,
    customerBirthDate,
    phoneLocal,
    customerEmail,
    driverLicenseImageDataUrl,
    passportImageDataUrl,
    additionalDrivers,
  } = input;

  if (step === 1) {
    if (!pickStart || !pickEnd || pickEnd <= pickStart) {
      return "Çıkış ve dönüş tarihlerini seçin. Dönüş, çıkışla aynı gün olamaz; en az ertesi gün seçilmelidir.";
    }
    return null;
  }
  if (step === 2) {
    if (!fullName.trim() || !phoneLocal.trim()) return "İsim ve telefon zorunludur.";
    if (!customerBirthDate.trim()) return "Doğum tarihi zorunludur.";
    if (!customerEmail.trim()) return "E-posta zorunludur.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) return "Geçerli bir e-posta adresi girin.";
    return null;
  }
  if (step === 3) {
    if (!driverLicenseImageDataUrl || !passportImageDataUrl) return "Ehliyet ve pasaport görselleri zorunlu.";
    return null;
  }
  if (step === 4) {
    for (const d of additionalDrivers) {
      if (!d.fullName.trim() || !d.driverLicenseImageDataUrl) {
        return "Ek sürücü için isim soyisim ve ehliyet fotoğrafı zorunludur.";
      }
    }
    return null;
  }
  return null;
}
