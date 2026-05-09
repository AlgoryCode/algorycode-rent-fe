import type { RentalStatus } from "@/lib/rental-status";
import type {
  HandoverLocationRefDto,
  VehicleDto,
  VehicleOptionDefinitionDto,
} from "@/models/rent-vehicle-dto";
import { createSeedVehicle } from "@/models/rent-vehicle-dto";

export type { RentalStatus } from "@/lib/rental-status";

export type Vehicle = VehicleDto;

export type VehicleHandoverRef = HandoverLocationRefDto;

export type VehicleOptionDefRow = VehicleOptionDefinitionDto;

export { createSeedVehicle, vehicleMaintenanceBlocked } from "@/models/rent-vehicle-dto";

/** Manuel / özet listede bireysel veya kurumsal müşteri ayrımı */
export type CustomerKind = "individual" | "corporate";

export type CustomerInfo = {
  fullName: string;
  nationalId: string;
  passportNo: string;
  phone: string;
  email?: string;
  birthDate?: string;
  driverLicenseNo?: string;
  driverLicenseImageDataUrl?: string;
  passportImageDataUrl?: string;
  kind?: CustomerKind;
};

export type AdditionalDriverInfo = {
  id?: string;
  fullName: string;
  birthDate: string;
  driverLicenseNo: string;
  passportNo: string;
  driverLicenseImageDataUrl?: string;
  passportImageDataUrl?: string;
};

export type RentalAccidentReport = {
  id: string;
  at: string;
  description: string;
  photos?: { id: string; url: string; caption?: string }[];
};

export type RentalOptionLine = {
  id: string;
  title: string;
  description?: string;
  price: number;
  icon?: string;
};

export type RentalSession = {
  id: string;
  vehicleId: string;
  startDate: string;
  endDate: string;
  createdAt?: string;
  status?: RentalStatus;
  commissionAmount?: number;
  commissionFlow?: "collect" | "pay";
  commissionCompany?: string;
  customer: CustomerInfo;
  additionalDrivers?: AdditionalDriverInfo[];
  feedback?: { at: string; text: string };
  photos: { id: string; url: string; caption?: string }[];
  accidentReports?: RentalAccidentReport[];
  options?: RentalOptionLine[];
  discountAmount?: number;
  discountType?: "PERCENT" | "AMOUNT";
  netAmount?: number;
  outsideCountryTravel?: boolean;
  greenInsuranceFee?: number;
  note?: string;
};

export type { VehicleImages } from "@/lib/vehicle-images";

export const seedVehicles: Vehicle[] = [
  createSeedVehicle({ id: 1, plate: "34 ABC 101", brand: "Toyota", model: "Corolla", year: 2023 }),
  createSeedVehicle({ id: 2, plate: "06 XYZ 202", brand: "Volkswagen", model: "Passat", year: 2022 }),
  createSeedVehicle({ id: 3, plate: "35 DEF 303", brand: "Renault", model: "Clio", year: 2024 }),
  createSeedVehicle({
    id: 4,
    plate: "16 GHI 404",
    brand: "Ford",
    model: "Focus",
    year: 2021,
    status: "MAINTENANCE",
    statusCode: "MAINTENANCE",
  }),
  createSeedVehicle({ id: 5, plate: "34 JKL 505", brand: "Hyundai", model: "i20", year: 2023 }),
];

export const seedSessions: RentalSession[] = [
  {
    id: "s1",
    vehicleId: "1",
    startDate: "2026-04-05",
    endDate: "2026-04-12",
    createdAt: "2026-04-04T09:15:00.000Z",
    customer: {
      fullName: "Ayşe Yılmaz",
      nationalId: "12345678901",
      passportNo: "U12345678",
      phone: "+90 532 111 2233",
    },
    status: "active",
    feedback: { at: "2026-04-06T10:00:00.000Z", text: "Araç temiz teslim edildi, yakıt tam doluydu." },
    photos: [
      { id: "p1", url: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400&q=80", caption: "Teslim öncesi" },
      { id: "p2", url: "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=400&q=80", caption: "İade" },
    ],
    accidentReports: [],
  },
  {
    id: "s2",
    vehicleId: "2",
    startDate: "2026-04-01",
    endDate: "2026-04-04",
    createdAt: "2026-03-28T14:22:00.000Z",
    customer: {
      fullName: "Mehmet Kaya",
      nationalId: "98765432109",
      passportNo: "U87654321",
      phone: "+90 533 444 5566",
    },
    status: "completed",
    feedback: { at: "2026-04-04T09:00:00.000Z", text: "Genel olarak memnun kaldık." },
    photos: [],
    accidentReports: [
      {
        id: "a1",
        at: "2026-04-02T16:40:00.000Z",
        description: "Otopark çıkışında hafif sıyrık; karşı araç plakası ve iletişim not alındı.",
        photos: [
          {
            id: "ap1",
            url: "https://images.unsplash.com/photo-1619642751033-062e0efcbc9a?w=400&q=80",
            caption: "Hasar görüntüsü",
          },
        ],
      },
    ],
  },
  {
    id: "s3",
    vehicleId: "3",
    startDate: "2026-04-10",
    endDate: "2026-04-15",
    createdAt: "2026-04-08T11:00:00.000Z",
    customer: {
      fullName: "Zeynep Demir",
      nationalId: "11122233344",
      passportNo: "P11223344",
      phone: "+90 534 777 8899",
    },
    status: "pending",
    photos: [{ id: "p3", url: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400&q=80" }],
    accidentReports: [],
  },
  {
    id: "s4",
    vehicleId: "5",
    startDate: "2026-04-20",
    endDate: "2026-04-25",
    createdAt: "2026-04-01T12:00:00.000Z",
    status: "cancelled",
    customer: {
      fullName: "Demo İptal",
      nationalId: "55566677788",
      passportNo: "P99887766",
      phone: "+90 500 000 0000",
    },
    photos: [],
    accidentReports: [],
  },
];
