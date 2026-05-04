export type CreateRentalPayload = {
  vehicleId: string;
  startDate: string;
  endDate: string;
  /** Kiralama talebi (`/rental-requests`) ile aynı alan; rent-service oluşturmada beklenir */
  outsideCountryTravel?: boolean;
  note?: string;
  customer: {
    fullName: string;
    nationalId: string;
    passportNo?: string;
    phone: string;
    email?: string;
    birthDate?: string;
    driverLicenseNo?: string;
    driverLicenseImageDataUrl?: string;
    passportImageDataUrl?: string;
  };
  additionalDrivers?: {
    fullName: string;
    driverLicenseImageDataUrl: string;
    birthDate?: string;
    driverLicenseNo?: string;
    passportNo?: string;
    passportImageDataUrl?: string;
  }[];
  status?: string;
  reservationExtraOptionTemplateIds?: string[];
  vehicleOptionDefinitionIds?: string[];
};

export type FetchRentalsParams = {
  vehicleId?: string;
  status?: "active" | "pending" | "completed" | "cancelled";
  startDate?: string;
  endDate?: string;
};

export type RentalDashboardSummary = {
  rentalCount: number;
  rentalDayBooked: number;
  totalRevenueEur: number;
  totalBaseRentalEur: number;
  totalOptionsEur: number;
  totalCommissionEur: number;
  activeOrPendingCount: number;
  completedCount: number;
};

export type RentalDashboardVehicleRow = {
  vehicleId: string;
  plate: string;
  brand: string;
  model: string;
  rentalCount: number;
  rentalDayBooked: number;
  revenueEur: number;
  baseRentalEur: number;
  optionsEur: number;
};

export type RentalDashboardTimelineRow = {
  period: string;
  label: string;
  rentalStarts: number;
  revenueEur: number;
};

export type RentalDashboardReport = {
  fromInclusive: string;
  toInclusive: string;
  timelineGranularity: "day" | "month";
  summary: RentalDashboardSummary;
  byVehicle: RentalDashboardVehicleRow[];
  timeline: RentalDashboardTimelineRow[];
};

export type FetchRentalDashboardParams = {
  from?: string;
  to?: string;
  vehicleId?: string;
};

export type UpdateRentalPayload = {
  startDate?: string;
  endDate?: string;
  discountAmount?: number;
  discountType?: "PERCENT" | "AMOUNT";
  status?: "active" | "pending" | "completed" | "cancelled";
  customer?: {
    fullName?: string;
    nationalId?: string;
    passportNo?: string;
    phone?: string;
    email?: string;
    birthDate?: string;
    driverLicenseNo?: string;
    passportImageDataUrl?: string;
    driverLicenseImageDataUrl?: string;
  };
};

export type RentalRequestStatus = "pending" | "approved" | "rejected";

export type RentalRequestFormPayload = {
  vehicleId?: string;
  startDate: string;
  endDate: string;
  outsideCountryTravel: boolean;
  note?: string;
  customer: {
    fullName: string;
    phone: string;
    email: string;
    birthDate: string;
    nationalId?: string;
    passportNo?: string;
    driverLicenseNo?: string;
    passportImageDataUrl: string;
    driverLicenseImageDataUrl: string;
  };
  additionalDrivers?: {
    fullName: string;
    birthDate: string;
    driverLicenseNo?: string;
    passportNo?: string;
    passportImageDataUrl: string;
    driverLicenseImageDataUrl: string;
  }[];
};

export type RentalRequestDto = {
  id: string;
  referenceNo: string;
  createdAt?: string;
  status: RentalRequestStatus;
  statusMessage?: string;
  vehicleId?: string;
  startDate: string;
  endDate: string;
  outsideCountryTravel: boolean;
  greenInsuranceFee: number;
  note?: string;
  contractPdfPath?: string;
  contractGenerationAvailable?: boolean;
  whatsappContractSentAt?: string;
  whatsappContractError?: string;
  customer: {
    fullName: string;
    phone: string;
    email: string;
    birthDate: string;
    nationalId?: string;
    passportNo: string;
    driverLicenseNo: string;
    passportImageDataUrl?: string;
    driverLicenseImageDataUrl?: string;
  };
  additionalDrivers?: {
    id?: string;
    fullName: string;
    birthDate: string;
    driverLicenseNo: string;
    passportNo: string;
    passportImageDataUrl?: string;
    driverLicenseImageDataUrl?: string;
  }[];
};
