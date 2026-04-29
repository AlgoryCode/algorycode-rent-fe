export type RentalStepValidationInput = {
  step: 1 | 2 | 3 | 4 | 5;
  pickStart: string;
  pickEnd: string;
  fullName: string;
  phoneLocal: string;
  saveNewCustomerProfile: boolean;
  newCustomerEmail: string;
  driverLicenseImageDataUrl: string;
  passportImageDataUrl: string;
  additionalDrivers: Array<{
    fullName: string;
    birthDate: string;
    driverLicenseImageDataUrl: string;
    passportImageDataUrl: string;
  }>;
};

export function validateRentalStepInput(input: RentalStepValidationInput): string | null {
  const {
    step,
    pickStart,
    pickEnd,
    fullName,
    phoneLocal,
    saveNewCustomerProfile,
    newCustomerEmail,
    driverLicenseImageDataUrl,
    passportImageDataUrl,
    additionalDrivers,
  } = input;

  if (step === 1) {
    if (!pickStart || !pickEnd || pickEnd < pickStart) {
      return "Takvimde başlangıç ve bitiş gününü ayrı ayrı seçin; bitiş tarihi zorunludur.";
    }
    return null;
  }
  if (step === 2) {
    if (!fullName.trim() || !phoneLocal.trim()) return "İsim ve telefon zorunludur.";
    if (saveNewCustomerProfile && !newCustomerEmail.trim()) return "Yeni müşteri kaydı için e-posta zorunludur.";
    if (saveNewCustomerProfile && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newCustomerEmail.trim())) return "Geçerli bir e-posta adresi girin.";
    return null;
  }
  if (step === 3) {
    if (!driverLicenseImageDataUrl || !passportImageDataUrl) return "Ehliyet ve pasaport görselleri zorunlu.";
    return null;
  }
  if (step === 4) {
    for (const d of additionalDrivers) {
      if (!d.fullName.trim() || !d.birthDate || !d.driverLicenseImageDataUrl || !d.passportImageDataUrl) {
        return "Ek sürücü için isim, doğum tarihi ve iki belge fotoğrafı zorunludur.";
      }
    }
    return null;
  }
  return null;
}
