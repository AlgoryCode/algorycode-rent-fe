/** Rent API React Query anahtarları — invalidate için aynı yapıyı kullanın. */
export const rentKeys = {
  all: ["rent"] as const,
  vehicles: () => [...rentKeys.all, "vehicles"] as const,
  rentals: () => [...rentKeys.all, "rentals"] as const,
  countries: () => [...rentKeys.all, "countries"] as const,
  payments: () => [...rentKeys.all, "payments"] as const,
  panelUsers: () => [...rentKeys.all, "panelUsers"] as const,
};
