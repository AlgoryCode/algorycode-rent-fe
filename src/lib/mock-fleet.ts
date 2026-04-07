import type { VehicleImages } from "@/lib/vehicle-images";

export type CustomerInfo = {
  fullName: string;
  nationalId: string;
  passportNo: string;
  phone: string;
};

export type RentalAccidentReport = {
  id: string;
  /** Olay zamanı (ISO 8601) */
  at: string;
  description: string;
  photos?: { id: string; url: string; caption?: string }[];
};

export type RentalSession = {
  id: string;
  vehicleId: string;
  startDate: string;
  endDate: string;
  /** Kiralama kaydının oluşturulma zamanı (ISO 8601) */
  createdAt?: string;
  customer: CustomerInfo;
  /** Kiralama başına en fazla bir müşteri yorumu */
  feedback?: { at: string; text: string };
  photos: { id: string; url: string; caption?: string }[];
  /** Bu kiralamaya özel kaza / hasar bildirimleri */
  accidentReports?: RentalAccidentReport[];
};

export type Vehicle = {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  /** Bakımda — kiralanamaz */
  maintenance?: boolean;
  /** Açıdan görüntüler (data URL, demo saklama) */
  images?: VehicleImages;
};

export type { VehicleImages } from "@/lib/vehicle-images";

export const seedVehicles: Vehicle[] = [
  { id: "v1", plate: "34 ABC 101", brand: "Toyota", model: "Corolla", year: 2023 },
  { id: "v2", plate: "06 XYZ 202", brand: "Volkswagen", model: "Passat", year: 2022 },
  { id: "v3", plate: "35 DEF 303", brand: "Renault", model: "Clio", year: 2024 },
  { id: "v4", plate: "16 GHI 404", brand: "Ford", model: "Focus", year: 2021, maintenance: true },
  { id: "v5", plate: "34 JKL 505", brand: "Hyundai", model: "i20", year: 2023 },
];

/** Örnek kiralama seansları (geri bildirim + foto ile). Tarihler demo için 2026 civarı. */
export const seedSessions: RentalSession[] = [
  {
    id: "s1",
    vehicleId: "v1",
    startDate: "2026-04-05",
    endDate: "2026-04-12",
    createdAt: "2026-04-04T09:15:00.000Z",
    customer: {
      fullName: "Ayşe Yılmaz",
      nationalId: "12345678901",
      passportNo: "U12345678",
      phone: "+90 532 111 2233",
    },
    feedback: { at: "2026-04-06T10:00:00.000Z", text: "Araç temiz teslim edildi, yakıt tam doluydu." },
    photos: [
      { id: "p1", url: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400&q=80", caption: "Teslim öncesi" },
      { id: "p2", url: "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=400&q=80", caption: "İade" },
    ],
    accidentReports: [],
  },
  {
    id: "s2",
    vehicleId: "v2",
    startDate: "2026-04-01",
    endDate: "2026-04-04",
    createdAt: "2026-03-28T14:22:00.000Z",
    customer: {
      fullName: "Mehmet Kaya",
      nationalId: "98765432109",
      passportNo: "U87654321",
      phone: "+90 533 444 5566",
    },
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
    vehicleId: "v3",
    startDate: "2026-04-10",
    endDate: "2026-04-15",
    createdAt: "2026-04-08T11:00:00.000Z",
    customer: {
      fullName: "Zeynep Demir",
      nationalId: "11122233344",
      passportNo: "P11223344",
      phone: "+90 534 777 8899",
    },
    photos: [{ id: "p3", url: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400&q=80" }],
    accidentReports: [],
  },
];
