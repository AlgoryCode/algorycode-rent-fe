"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { rentKeys } from "@/lib/rent-query-keys";
import {
  createVehicleOnRentApi,
  fetchVehiclesFromRentApi,
  getRentApiErrorMessage,
  type CreateVehiclePayload,
} from "@/lib/rent-api";

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

  const allVehicles = useMemo(() => vehicles, [vehicles]);

  return {
    allVehicles,
    addVehicle: addMutation.mutateAsync.bind(addMutation),
    ready: !isPending,
    /** İlk yükleme bitti; arka planda sessiz yenileme olabilir */
    isRefreshing: isFetching && !isPending,
    error: error ? getRentApiErrorMessage(error) : null,
    refetch: () => refetch(),
  };
}
