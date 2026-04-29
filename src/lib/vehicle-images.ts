export const VEHICLE_IMAGE_SLOTS = [
  { key: "front", label: "Ön" },
  { key: "rear", label: "Arka" },
  { key: "left", label: "Sol yan" },
  { key: "right", label: "Sağ yan" },
  { key: "interiorDash", label: "Kokpit" },
  { key: "interiorRear", label: "Arka koltuk" },
] as const;

export type VehicleImageSlot = (typeof VEHICLE_IMAGE_SLOTS)[number]["key"];

/** data URL (base64) — demo; üretimde sunucuya yüklenmeli */
export type VehicleImages = Partial<Record<VehicleImageSlot, string>>;

export const MAX_VEHICLE_IMAGE_BYTES = 50 * 1024 * 1024;

export function compactVehicleImages(images: VehicleImages): VehicleImages | undefined {
  const entries = Object.entries(images).filter(([, v]) => typeof v === "string" && v.length > 0) as [VehicleImageSlot, string][];
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries) as VehicleImages;
}

export function hasVehicleGalleryImages(images?: VehicleImages): boolean {
  return Boolean(images && VEHICLE_IMAGE_SLOTS.some(({ key }) => Boolean(images[key])));
}

/** Demo / örnek görseller (Unsplash); gerçek yükleme yoksa detay sayfasında kullanılır. */
const DEMO_SETS: VehicleImages[] = [
  {
    front: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=320&q=75",
    rear: "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=320&q=75",
    left: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=320&q=75",
    right: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=320&q=75",
    interiorDash: "https://images.unsplash.com/photo-1489827904928-61b9c3497f8b?w=320&q=75",
    interiorRear: "https://images.unsplash.com/photo-1502877338535-766e1452684a?w=320&q=75",
  },
  {
    front: "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=320&q=75",
    rear: "https://images.unsplash.com/photo-1617531653332-bd46c24f2068?w=320&q=75",
    left: "https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=320&q=75",
    right: "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=320&q=75",
    interiorDash: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=320&q=75",
    interiorRear: "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=320&q=75",
  },
  {
    front: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=320&q=75",
    rear: "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=320&q=75",
    left: "https://images.unsplash.com/photo-1553440569-bcc63803a83d?w=320&q=75",
    right: "https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=320&q=75",
    interiorDash: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=320&q=75",
    interiorRear: "https://images.unsplash.com/photo-1507131064678-87e6fcf6b31c?w=320&q=75",
  },
];

function demoSetIndexForVehicle(vehicleId: string): number {
  let h = 0;
  for (let i = 0; i < vehicleId.length; i++) h = (h * 31 + vehicleId.charCodeAt(i)) | 0;
  return Math.abs(h) % DEMO_SETS.length;
}

/**
 * Araç detayında gösterilecek görseller: kullanıcı/seed dolu alanlar korunur, boş slotlar demo URL ile doldurulur.
 */
export function mergeVehicleImagesWithDemo(images: VehicleImages | undefined, vehicleId: string): VehicleImages {
  const base = DEMO_SETS[demoSetIndexForVehicle(vehicleId)];
  const out: VehicleImages = { ...base };
  if (!images) return out;
  for (const { key } of VEHICLE_IMAGE_SLOTS) {
    const v = images[key];
    if (typeof v === "string" && v.length > 0) out[key] = v;
  }
  return out;
}
