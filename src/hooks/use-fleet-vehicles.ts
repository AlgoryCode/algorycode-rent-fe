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
} from "@/lib/rent-api";
import type { CreateVehiclePayload, UpdateVehiclePayload } from "@/models";
import type { VehicleImageSlot } from "@/lib/vehicle-images";

export function useFleetVehicles() {
  const qc = useQueryClient();

  const { data: vehicles = [], isPending, error, refetch, isFetching } = useQuery({
    queryKey: rentKeys.vehicles(),
    queryFn: fetchVehiclesFromRentApi,
  });

  const addMutation = useMutation({
    mutationFn: (payload: CreateVehiclePayload) => createVehicleOnRentApi(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rentKeys.vehicles() });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateVehiclePayload }) => updateVehicleOnRentApi(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rentKeys.vehicles() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVehicleOnRentApi(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rentKeys.vehicles() });
    },
  });

  const replaceImageMutation = useMutation({
    mutationFn: ({ id, slot, image }: { id: string; slot: VehicleImageSlot; image: string }) =>
      replaceVehicleImageSlotOnRentApi(id, slot, image),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rentKeys.vehicles() });
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: ({ id, slot }: { id: string; slot: VehicleImageSlot }) => deleteVehicleImageSlotOnRentApi(id, slot),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rentKeys.vehicles() });
    },
  });

  const allVehicles = useMemo(() => vehicles, [vehicles]);

  return {
    allVehicles,
    addVehicle: addMutation.mutateAsync.bind(addMutation),
    updateVehicle: (id: string, payload: UpdateVehiclePayload) => updateMutation.mutateAsync({ id, payload }),
    deleteVehicle: deleteMutation.mutateAsync.bind(deleteMutation),
    replaceVehicleImageSlot: (id: string, slot: VehicleImageSlot, image: string) =>
      replaceImageMutation.mutateAsync({ id, slot, image }),
    deleteVehicleImageSlot: (id: string, slot: VehicleImageSlot) => deleteImageMutation.mutateAsync({ id, slot }),
    ready: !isPending,
    /** İlk yükleme bitti; arka planda sessiz yenileme olabilir */
    isRefreshing: isFetching && !isPending,
    error: error ? getRentApiErrorMessage(error) : null,
    refetch: () => refetch(),
  };
}
