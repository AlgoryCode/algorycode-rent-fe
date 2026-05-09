"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { rentKeys } from "@/lib/rent-query-keys";
import {
  createVehicleOnRentApi,
  deleteVehicleImageSlotOnRentApi,
  deleteVehicleOnRentApi,
  fetchVehiclesFromRentApi,
  getRentApiErrorMessage,
  replaceVehicleImageSlotOnRentApi,
  updateVehicleOnRentApi,
} from "@/features/vehicles/api/vehicles.api";
import type { CreateVehiclePayload, UpdateVehiclePayload } from "@/models";
import type { VehicleImageSlot } from "@/lib/vehicle-images";

function shouldRetryVehicleMutation(attempt: number, error: unknown): boolean {
  if (attempt >= 2) return false;
  const message = getRentApiErrorMessage(error).toLowerCase();
  if (!message) return false;
  if (
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("temporarily") ||
    message.includes("temporarily unavailable") ||
    message.includes("failed to fetch") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504")
  ) {
    return true;
  }
  return false;
}

export function useFleetVehicles() {
  const qc = useQueryClient();

  const { data: vehicles = [], isPending, error, refetch, isFetching } = useQuery({
    queryKey: rentKeys.vehicles(),
    queryFn: fetchVehiclesFromRentApi,
  });

  const addMutation = useMutation({
    mutationFn: (payload: CreateVehiclePayload) => createVehicleOnRentApi(payload),
    retry: shouldRetryVehicleMutation,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rentKeys.vehicles() });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string | number; payload: UpdateVehiclePayload }) =>
      updateVehicleOnRentApi(String(id), payload),
    retry: shouldRetryVehicleMutation,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rentKeys.vehicles() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => deleteVehicleOnRentApi(String(id)),
    retry: shouldRetryVehicleMutation,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rentKeys.vehicles() });
    },
  });

  const replaceImageMutation = useMutation({
    mutationFn: ({ id, slot, image }: { id: string | number; slot: VehicleImageSlot; image: string }) =>
      replaceVehicleImageSlotOnRentApi(String(id), slot, image),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rentKeys.vehicles() });
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: ({ id, slot }: { id: string | number; slot: VehicleImageSlot }) =>
      deleteVehicleImageSlotOnRentApi(String(id), slot),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rentKeys.vehicles() });
    },
  });

  const allVehicles = useMemo(() => vehicles, [vehicles]);

  return {
    allVehicles,
    addVehicle: addMutation.mutateAsync.bind(addMutation),
    updateVehicle: (id: string | number, payload: UpdateVehiclePayload) => updateMutation.mutateAsync({ id, payload }),
    deleteVehicle: (id: string | number) => deleteMutation.mutateAsync(id),
    replaceVehicleImageSlot: (id: string | number, slot: VehicleImageSlot, image: string) =>
      replaceImageMutation.mutateAsync({ id, slot, image }),
    deleteVehicleImageSlot: (id: string | number, slot: VehicleImageSlot) =>
      deleteImageMutation.mutateAsync({ id, slot }),
    ready: !isPending,
    isRefreshing: isFetching && !isPending,
    error: error ? getRentApiErrorMessage(error) : null,
    refetch: () => refetch(),
  };
}
