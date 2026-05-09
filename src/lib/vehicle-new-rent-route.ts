export function vehicleDetailHref(vehicleId: string | number): string {
  return `/vehicles/${encodeURIComponent(String(vehicleId).trim())}`;
}

export function vehicleNewRentHref(vehicleId: string | number): string {
  return `/vehicles/${encodeURIComponent(String(vehicleId).trim())}/new-rent`;
}
