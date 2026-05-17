/** Rent API facade: Supabase veya Algory gateway. */
export { clearRentApiGatewayAuthCache } from "./rent-api-gateway";
export { getRentApiErrorMessage } from "./rent-api-gateway";
export { mapVehicleFromApi } from "./rent-api-gateway";
export { mapCountryFromApi } from "./rent-api-gateway";
export { mapRentalFromApi } from "./rent-api-gateway";
export { mapPaymentFromApi } from "./rent-api-gateway";
export { mapPanelUserFromApi } from "./rent-api-gateway";
export type * from "./rent-api-gateway";

import { isSupabaseDataEnabled } from "@/lib/data-source";
import * as gateway from "@/lib/rent-api-gateway";

export async function fetchVehicleCatalogFromRentApi(...args: Parameters<typeof gateway.fetchVehicleCatalogFromRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.fetchVehicleCatalogFromRentApi(...args);
  }
  return gateway.fetchVehicleCatalogFromRentApi(...args);
}

export async function fetchVehicleBodyStylesFromRentApi(...args: Parameters<typeof gateway.fetchVehicleBodyStylesFromRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.fetchVehicleBodyStylesFromRentApi(...args);
  }
  return gateway.fetchVehicleBodyStylesFromRentApi(...args);
}

export async function fetchVehicleFuelTypesFromRentApi(...args: Parameters<typeof gateway.fetchVehicleFuelTypesFromRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.fetchVehicleFuelTypesFromRentApi(...args);
  }
  return gateway.fetchVehicleFuelTypesFromRentApi(...args);
}

export async function fetchVehicleTransmissionTypesFromRentApi(...args: Parameters<typeof gateway.fetchVehicleTransmissionTypesFromRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.fetchVehicleTransmissionTypesFromRentApi(...args);
  }
  return gateway.fetchVehicleTransmissionTypesFromRentApi(...args);
}

export async function createVehicleCatalogEntryOnRentApi(...args: Parameters<typeof gateway.createVehicleCatalogEntryOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.createVehicleCatalogEntryOnRentApi(...args);
  }
  return gateway.createVehicleCatalogEntryOnRentApi(...args);
}

export async function updateVehicleCatalogEntryOnRentApi(...args: Parameters<typeof gateway.updateVehicleCatalogEntryOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.updateVehicleCatalogEntryOnRentApi(...args);
  }
  return gateway.updateVehicleCatalogEntryOnRentApi(...args);
}

export async function deleteVehicleCatalogEntryOnRentApi(...args: Parameters<typeof gateway.deleteVehicleCatalogEntryOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.deleteVehicleCatalogEntryOnRentApi(...args);
  }
  return gateway.deleteVehicleCatalogEntryOnRentApi(...args);
}

export async function fetchVehicleStatusesFromRentApi(...args: Parameters<typeof gateway.fetchVehicleStatusesFromRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.fetchVehicleStatusesFromRentApi(...args);
  }
  return gateway.fetchVehicleStatusesFromRentApi(...args);
}

export async function fetchVehicleStatusByCodeFromRentApi(...args: Parameters<typeof gateway.fetchVehicleStatusByCodeFromRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.fetchVehicleStatusByCodeFromRentApi(...args);
  }
  return gateway.fetchVehicleStatusByCodeFromRentApi(...args);
}

export async function createVehicleStatusOnRentApi(...args: Parameters<typeof gateway.createVehicleStatusOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.createVehicleStatusOnRentApi(...args);
  }
  return gateway.createVehicleStatusOnRentApi(...args);
}

export async function updateVehicleStatusOnRentApi(...args: Parameters<typeof gateway.updateVehicleStatusOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.updateVehicleStatusOnRentApi(...args);
  }
  return gateway.updateVehicleStatusOnRentApi(...args);
}

export async function deleteVehicleStatusOnRentApi(...args: Parameters<typeof gateway.deleteVehicleStatusOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.deleteVehicleStatusOnRentApi(...args);
  }
  return gateway.deleteVehicleStatusOnRentApi(...args);
}

export async function fetchVehicleSnapshotsFromRentApi(...args: Parameters<typeof gateway.fetchVehicleSnapshotsFromRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.fetchVehicleSnapshotsFromRentApi(...args);
  }
  return gateway.fetchVehicleSnapshotsFromRentApi(...args);
}

export async function fetchVehiclesFromRentApi(...args: Parameters<typeof gateway.fetchVehiclesFromRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.fetchVehiclesFromRentApi(...args);
  }
  return gateway.fetchVehiclesFromRentApi(...args);
}

export async function fetchVehicleCalendarOccupancyFromRentApi(...args: Parameters<typeof gateway.fetchVehicleCalendarOccupancyFromRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.fetchVehicleCalendarOccupancyFromRentApi(...args);
  }
  return gateway.fetchVehicleCalendarOccupancyFromRentApi(...args);
}

export async function fetchRentalsFromRentApi(...args: Parameters<typeof gateway.fetchRentalsFromRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.fetchRentalsFromRentApi(...args);
  }
  return gateway.fetchRentalsFromRentApi(...args);
}

export async function fetchRentalDashboardReport(...args: Parameters<typeof gateway.fetchRentalDashboardReport>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.fetchRentalDashboardReport(...args);
  }
  return gateway.fetchRentalDashboardReport(...args);
}

export async function fetchRentalByIdFromRentApi(...args: Parameters<typeof gateway.fetchRentalByIdFromRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.fetchRentalByIdFromRentApi(...args);
  }
  return gateway.fetchRentalByIdFromRentApi(...args);
}

export async function fetchPaymentsFromRentApi(...args: Parameters<typeof gateway.fetchPaymentsFromRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.fetchPaymentsFromRentApi(...args);
  }
  return gateway.fetchPaymentsFromRentApi(...args);
}

export async function fetchPanelUsersFromRentApi(...args: Parameters<typeof gateway.fetchPanelUsersFromRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.fetchPanelUsersFromRentApi(...args);
  }
  return gateway.fetchPanelUsersFromRentApi(...args);
}

export async function deletePanelUserOnRentApi(...args: Parameters<typeof gateway.deletePanelUserOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.deletePanelUserOnRentApi(...args);
  }
  return gateway.deletePanelUserOnRentApi(...args);
}

export async function fetchCountriesFromRentApi(...args: Parameters<typeof gateway.fetchCountriesFromRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.fetchCountriesFromRentApi(...args);
  }
  return gateway.fetchCountriesFromRentApi(...args);
}

export async function fetchCitiesFromRentApi(...args: Parameters<typeof gateway.fetchCitiesFromRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.fetchCitiesFromRentApi(...args);
  }
  return gateway.fetchCitiesFromRentApi(...args);
}

export async function createCityOnRentApi(...args: Parameters<typeof gateway.createCityOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.createCityOnRentApi(...args);
  }
  return gateway.createCityOnRentApi(...args);
}

export async function fetchVehicleFormCatalogFromRentApi(...args: Parameters<typeof gateway.fetchVehicleFormCatalogFromRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.fetchVehicleFormCatalogFromRentApi(...args);
  }
  return gateway.fetchVehicleFormCatalogFromRentApi(...args);
}

export async function fetchHandoverLocationsFromRentApi(...args: Parameters<typeof gateway.fetchHandoverLocationsFromRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.fetchHandoverLocationsFromRentApi(...args);
  }
  return gateway.fetchHandoverLocationsFromRentApi(...args);
}

export async function createHandoverLocationOnRentApi(...args: Parameters<typeof gateway.createHandoverLocationOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.createHandoverLocationOnRentApi(...args);
  }
  return gateway.createHandoverLocationOnRentApi(...args);
}

export async function updateHandoverLocationOnRentApi(...args: Parameters<typeof gateway.updateHandoverLocationOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.updateHandoverLocationOnRentApi(...args);
  }
  return gateway.updateHandoverLocationOnRentApi(...args);
}

export async function deleteHandoverLocationOnRentApi(...args: Parameters<typeof gateway.deleteHandoverLocationOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.deleteHandoverLocationOnRentApi(...args);
  }
  return gateway.deleteHandoverLocationOnRentApi(...args);
}

export async function fetchVehicleOptionTemplatesFromRentApi(...args: Parameters<typeof gateway.fetchVehicleOptionTemplatesFromRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.fetchVehicleOptionTemplatesFromRentApi(...args);
  }
  return gateway.fetchVehicleOptionTemplatesFromRentApi(...args);
}

export async function createVehicleOptionTemplateOnRentApi(...args: Parameters<typeof gateway.createVehicleOptionTemplateOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.createVehicleOptionTemplateOnRentApi(...args);
  }
  return gateway.createVehicleOptionTemplateOnRentApi(...args);
}

export async function updateVehicleOptionTemplateOnRentApi(...args: Parameters<typeof gateway.updateVehicleOptionTemplateOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.updateVehicleOptionTemplateOnRentApi(...args);
  }
  return gateway.updateVehicleOptionTemplateOnRentApi(...args);
}

export async function deleteVehicleOptionTemplateOnRentApi(...args: Parameters<typeof gateway.deleteVehicleOptionTemplateOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.deleteVehicleOptionTemplateOnRentApi(...args);
  }
  return gateway.deleteVehicleOptionTemplateOnRentApi(...args);
}

export async function fetchReservationExtraOptionTemplatesFromRentApi(...args: Parameters<typeof gateway.fetchReservationExtraOptionTemplatesFromRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.fetchReservationExtraOptionTemplatesFromRentApi(...args);
  }
  return gateway.fetchReservationExtraOptionTemplatesFromRentApi(...args);
}

export async function createReservationExtraOptionTemplateOnRentApi(...args: Parameters<typeof gateway.createReservationExtraOptionTemplateOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.createReservationExtraOptionTemplateOnRentApi(...args);
  }
  return gateway.createReservationExtraOptionTemplateOnRentApi(...args);
}

export async function updateReservationExtraOptionTemplateOnRentApi(...args: Parameters<typeof gateway.updateReservationExtraOptionTemplateOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.updateReservationExtraOptionTemplateOnRentApi(...args);
  }
  return gateway.updateReservationExtraOptionTemplateOnRentApi(...args);
}

export async function deleteReservationExtraOptionTemplateOnRentApi(...args: Parameters<typeof gateway.deleteReservationExtraOptionTemplateOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.deleteReservationExtraOptionTemplateOnRentApi(...args);
  }
  return gateway.deleteReservationExtraOptionTemplateOnRentApi(...args);
}

export async function patchCountryColorOnRentApi(...args: Parameters<typeof gateway.patchCountryColorOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.patchCountryColorOnRentApi(...args);
  }
  return gateway.patchCountryColorOnRentApi(...args);
}

export async function createCountryOnRentApi(...args: Parameters<typeof gateway.createCountryOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.createCountryOnRentApi(...args);
  }
  return gateway.createCountryOnRentApi(...args);
}

export async function createVehicleBrandOnRentApi(...args: Parameters<typeof gateway.createVehicleBrandOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.createVehicleBrandOnRentApi(...args);
  }
  return gateway.createVehicleBrandOnRentApi(...args);
}

export async function createVehicleModelOnRentApi(...args: Parameters<typeof gateway.createVehicleModelOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.createVehicleModelOnRentApi(...args);
  }
  return gateway.createVehicleModelOnRentApi(...args);
}

export async function createVehicleOnRentApi(...args: Parameters<typeof gateway.createVehicleOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.createVehicleOnRentApi(...args);
  }
  return gateway.createVehicleOnRentApi(...args);
}

export async function updateVehicleOnRentApi(...args: Parameters<typeof gateway.updateVehicleOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.updateVehicleOnRentApi(...args);
  }
  return gateway.updateVehicleOnRentApi(...args);
}

export async function deleteVehicleOnRentApi(...args: Parameters<typeof gateway.deleteVehicleOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.deleteVehicleOnRentApi(...args);
  }
  return gateway.deleteVehicleOnRentApi(...args);
}

export async function replaceVehicleImageSlotOnRentApi(...args: Parameters<typeof gateway.replaceVehicleImageSlotOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.replaceVehicleImageSlotOnRentApi(...args);
  }
  return gateway.replaceVehicleImageSlotOnRentApi(...args);
}

export async function deleteVehicleImageSlotOnRentApi(...args: Parameters<typeof gateway.deleteVehicleImageSlotOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.deleteVehicleImageSlotOnRentApi(...args);
  }
  return gateway.deleteVehicleImageSlotOnRentApi(...args);
}

export async function createRentalOnRentApi(...args: Parameters<typeof gateway.createRentalOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.createRentalOnRentApi(...args);
  }
  return gateway.createRentalOnRentApi(...args);
}

export async function updateRentalOnRentApi(...args: Parameters<typeof gateway.updateRentalOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.updateRentalOnRentApi(...args);
  }
  return gateway.updateRentalOnRentApi(...args);
}

export async function createRentalRequestOnRentApi(...args: Parameters<typeof gateway.createRentalRequestOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.createRentalRequestOnRentApi(...args);
  }
  return gateway.createRentalRequestOnRentApi(...args);
}

export async function queryRentalRequestByReferenceOnRentApi(...args: Parameters<typeof gateway.queryRentalRequestByReferenceOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.queryRentalRequestByReferenceOnRentApi(...args);
  }
  return gateway.queryRentalRequestByReferenceOnRentApi(...args);
}

export async function fetchRentalRequestsFromRentApi(...args: Parameters<typeof gateway.fetchRentalRequestsFromRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.fetchRentalRequestsFromRentApi(...args);
  }
  return gateway.fetchRentalRequestsFromRentApi(...args);
}

export async function updateRentalRequestStatusOnRentApi(...args: Parameters<typeof gateway.updateRentalRequestStatusOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.updateRentalRequestStatusOnRentApi(...args);
  }
  return gateway.updateRentalRequestStatusOnRentApi(...args);
}

export async function generateRentalRequestContractOnRentApi(...args: Parameters<typeof gateway.generateRentalRequestContractOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.generateRentalRequestContractOnRentApi(...args);
  }
  return gateway.generateRentalRequestContractOnRentApi(...args);
}

export async function fetchRentalRequestContractPdfBlob(...args: Parameters<typeof gateway.fetchRentalRequestContractPdfBlob>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.fetchRentalRequestContractPdfBlob(...args);
  }
  return gateway.fetchRentalRequestContractPdfBlob(...args);
}

export async function sendRentalRequestContractEmailOnRentApi(...args: Parameters<typeof gateway.sendRentalRequestContractEmailOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.sendRentalRequestContractEmailOnRentApi(...args);
  }
  return gateway.sendRentalRequestContractEmailOnRentApi(...args);
}

export async function fetchCustomersFromRentApi(...args: Parameters<typeof gateway.fetchCustomersFromRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.fetchCustomersFromRentApi(...args);
  }
  return gateway.fetchCustomersFromRentApi(...args);
}

export async function createCustomerOnRentApi(...args: Parameters<typeof gateway.createCustomerOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.createCustomerOnRentApi(...args);
  }
  return gateway.createCustomerOnRentApi(...args);
}

export async function updateCustomerOnRentApi(...args: Parameters<typeof gateway.updateCustomerOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.updateCustomerOnRentApi(...args);
  }
  return gateway.updateCustomerOnRentApi(...args);
}

export async function deleteCustomerOnRentApi(...args: Parameters<typeof gateway.deleteCustomerOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.deleteCustomerOnRentApi(...args);
  }
  return gateway.deleteCustomerOnRentApi(...args);
}

export async function fetchCustomerRecordStatesFromRentApi(...args: Parameters<typeof gateway.fetchCustomerRecordStatesFromRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.fetchCustomerRecordStatesFromRentApi(...args);
  }
  return gateway.fetchCustomerRecordStatesFromRentApi(...args);
}

export async function patchCustomerRecordActiveOnRentApi(...args: Parameters<typeof gateway.patchCustomerRecordActiveOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.patchCustomerRecordActiveOnRentApi(...args);
  }
  return gateway.patchCustomerRecordActiveOnRentApi(...args);
}

export async function deleteCustomerRecordOnRentApi(...args: Parameters<typeof gateway.deleteCustomerRecordOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.deleteCustomerRecordOnRentApi(...args);
  }
  return gateway.deleteCustomerRecordOnRentApi(...args);
}

export async function fetchCouponsOnRentApi(...args: Parameters<typeof gateway.fetchCouponsOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.fetchCouponsOnRentApi(...args);
  }
  return gateway.fetchCouponsOnRentApi(...args);
}

export async function createCouponOnRentApi(...args: Parameters<typeof gateway.createCouponOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.createCouponOnRentApi(...args);
  }
  return gateway.createCouponOnRentApi(...args);
}

export async function updateCouponOnRentApi(...args: Parameters<typeof gateway.updateCouponOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.updateCouponOnRentApi(...args);
  }
  return gateway.updateCouponOnRentApi(...args);
}

export async function deleteCouponOnRentApi(...args: Parameters<typeof gateway.deleteCouponOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.deleteCouponOnRentApi(...args);
  }
  return gateway.deleteCouponOnRentApi(...args);
}

export async function validateCouponOnRentApi(...args: Parameters<typeof gateway.validateCouponOnRentApi>) {
  if (isSupabaseDataEnabled()) {
    const sb = await import("@/lib/supabase-rent-api");
    return sb.validateCouponOnRentApi(...args);
  }
  return gateway.validateCouponOnRentApi(...args);
}
