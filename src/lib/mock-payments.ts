export type PaymentLogStatus = "completed" | "pending" | "failed" | "refunded";

export type PaymentLog = {
  id: string;
  /** ISO 8601 */
  createdAt: string;
  /** Tutar (EUR gösterimi; alan adı API ile uyumlu) */
  amountTry: number;
  status: PaymentLogStatus;
  /** Ödeme kanalı */
  method: string;
  plate: string;
  vehicleId: string;
  customerName: string;
  /** İşlem / provizyon referansı */
  reference: string;
  note?: string;
};

/** Demo ödeme logları */
export const seedPaymentLogs: PaymentLog[] = [
  {
    id: "pay-1",
    createdAt: "2026-04-06T14:22:00.000Z",
    amountTry: 4200,
    status: "completed",
    method: "Kredi kartı (3D)",
    plate: "34 ABC 101",
    vehicleId: "1",
    customerName: "Ayşe Yılmaz",
    reference: "AUTH-9F2A-7741",
    note: "Kiralama ön ödeme",
  },
  {
    id: "pay-2",
    createdAt: "2026-04-05T09:10:00.000Z",
    amountTry: 850,
    status: "completed",
    method: "Havale / EFT",
    plate: "06 XYZ 202",
    vehicleId: "2",
    customerName: "Mehmet Kaya",
    reference: "EFT-20260405091",
  },
  {
    id: "pay-3",
    createdAt: "2026-04-08T11:45:00.000Z",
    amountTry: 2100,
    status: "pending",
    method: "Kredi kartı",
    plate: "35 DEF 303",
    vehicleId: "3",
    customerName: "Zeynep Demir",
    reference: "PEND-8831",
    note: "Provizyon bekleniyor",
  },
  {
    id: "pay-4",
    createdAt: "2026-04-03T16:00:00.000Z",
    amountTry: 1200,
    status: "failed",
    method: "Kredi kartı",
    plate: "34 ABC 101",
    vehicleId: "1",
    customerName: "Demo Kullanıcı",
    reference: "FAIL-1102",
    note: "Yetersiz bakiye",
  },
  {
    id: "pay-5",
    createdAt: "2026-04-01T08:30:00.000Z",
    amountTry: 500,
    status: "refunded",
    method: "Kredi kartı",
    plate: "34 JKL 505",
    vehicleId: "5",
    customerName: "Can Öztürk",
    reference: "REF-4455",
    note: "İptal iadesi",
  },
  {
    id: "pay-6",
    createdAt: "2026-04-07T10:05:00.000Z",
    amountTry: 3600,
    status: "completed",
    method: "POS / fiziki",
    plate: "34 ABC 101",
    vehicleId: "1",
    customerName: "Ayşe Yılmaz",
    reference: "POS-77821",
  },
];
