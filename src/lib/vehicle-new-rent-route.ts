export function vehicleNewRentHref(vehicleId: string): string {
  return `/vehicles/${encodeURIComponent(vehicleId)}/new-rent`;
}
