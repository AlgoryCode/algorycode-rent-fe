/** Rent API React Query anahtarları — invalidate için aynı yapıyı kullanın. */
export const rentKeys = {
  all: ["rent"] as const,
  vehicles: () => [...rentKeys.all, "vehicles"] as const,
  rentals: () => [...rentKeys.all, "rentals"] as const,
  /** Araç detayı günlüğü: `GET /rentals?vehicleId=` ile hizalı tam liste. */
  rentalsByVehicle: (vehicleId: string) => [...rentKeys.rentals(), "byVehicle", vehicleId] as const,
  rental: (id: string) => [...rentKeys.all, "rental", id] as const,
  rentalRequests: () => [...rentKeys.all, "rentalRequests"] as const,
  countries: () => [...rentKeys.all, "countries"] as const,
  payments: () => [...rentKeys.all, "payments"] as const,
  panelUsers: () => [...rentKeys.all, "panelUsers"] as const,
  customerRecords: () => [...rentKeys.all, "customerRecords"] as const,
  reportDashboard: (from?: string, to?: string, vehicleId?: string) =>
    [...rentKeys.all, "reportDashboard", from ?? "", to ?? "", vehicleId ?? ""] as const,
  /** Araç müsaitlik takvimi: `GET /vehicles/{id}/calendar/occupancy` */
  vehicleCalendarOccupancy: (vehicleId: string, from: string, to: string) =>
    [...rentKeys.all, "vehicleCalendarOccupancy", vehicleId, from, to] as const,
};
